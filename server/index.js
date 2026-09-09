import { notificationRouter } from "./notifications.js";
import { forumRouter } from "./forum.js";
import { articles, articleSummaries } from "./articles.js";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { fileURLToPath } from "node:url";
import path from "node:path";
export const demo = process.env.DEMO_MODE === "true";
const production = process.env.NODE_ENV === "production";
if (demo && production)
  throw new Error("Demo sementara hanya tersedia untuk pengembangan lokal.");
const db = demo
  ? null
  : mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || "tumbuh_bersama",
      dateStrings: true,
      connectionLimit: 5,
    });
const sessions = new Map(),
  children = new Map(),
  records = new Map();
const ttl = 24 * 60 * 60 * 1000;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const nowDate = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const text = (v, max, optional = false) => {
  if (optional && (v === undefined || v === "")) return "";
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    throw fail("Isian teks tidak valid atau terlalu panjang.");
  return v.trim();
};
const validDate = (v) => {
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    throw fail("Tanggal tidak valid.");
  return v;
};
const numeric = (v, min, max) => {
  if (
    v === "" ||
    v == null ||
    !["string", "number"].includes(typeof v) ||
    !Number.isFinite(Number(v)) ||
    Number(v) < min ||
    Number(v) > max
  )
    throw fail("Nilai pengukuran berada di luar batas isian.");
  return Number(v);
};
async function query(sql, params = []) {
  const [rows] = await db.execute(sql, params);
  return rows;
}
async function owned(id, user) {
  const c = demo
    ? children.get(id)
    : (
        await query("SELECT * FROM children WHERE id=? AND user_id=?", [
          id,
          user.id,
        ])
      )[0];
  if (!c || c.user_id !== user.id)
    throw fail("Profil anak tidak ditemukan.", 404);
  return c;
}
function tokenFrom(req) {
  return (req.headers.cookie || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("tb_session="))
    ?.slice(11);
}
async function dropSession(req) {
  const token = tokenFrom(req);
  if (!token) return;
  if (demo) {
    const previous = sessions.get(hash(token));
    if (previous) {
      for (const [id, c] of children)
        if (c.user_id === previous.user.id) {
          children.delete(id);
          for (const [rid, r] of records)
            if (r.child_id === id) records.delete(rid);
        }
    }
    sessions.delete(hash(token));
  } else await query("DELETE FROM sessions WHERE token_hash=?", [hash(token)]);
}
async function login(req, res, user) {
  await dropSession(req);
  const token = randomBytes(32).toString("hex"),
    expires = Date.now() + ttl;
  if (demo) sessions.set(hash(token), { user, expires });
  else
    await query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
      [hash(token), user.id, new Date(expires)],
    );
  res.cookie("tb_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: production,
    maxAge: ttl,
    path: "/",
  });
  return user;
}
export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "32kb" }));
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin"),
      allowed = process.env.APP_ORIGIN || "http://127.0.0.1:5173";
    if (origin && origin !== allowed)
      return res
        .status(403)
        .json({ error: "Asal permintaan tidak diizinkan." });
    if (!req.is("application/json"))
      return res.status(415).json({ error: "Gunakan JSON." });
  }
  next();
});
app.use("/api", async (req, res, next) => {
  try {
    const token = tokenFrom(req);
    if (token) {
      if (demo) {
        const s = sessions.get(hash(token));
        if (s && s.expires > Date.now()) req.user = s.user;
      } else {
        const row = (
          await query(
            "SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>NOW()",
            [hash(token)],
          )
        )[0];
        if (row) req.user = row;
      }
    }
    next();
  } catch (e) {
    next(e);
  }
});
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." },
});
app.get("/api/me", (req, res) => res.json({ user: req.user || null, demo }));
app.post("/api/register", authLimit, async (req, res) => {
  if (demo) throw fail("Gunakan tombol demo untuk mencoba.", 403);
  const name = text(req.body.name, 80),
    email = text(req.body.email, 254).toLowerCase(),
    password = req.body.password;
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password) > 72
  )
    throw fail("Email tidak valid atau kata sandi harus 8–72 byte.");
  const user = { id: randomUUID(), name, email };
  try {
    await query(
      "INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)",
      [user.id, name, email, await bcrypt.hash(password, 12)],
    );
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") throw fail("Email sudah terdaftar.", 409);
    throw e;
  }
  await login(req, res, user);
  res.status(201).json({ user });
});
app.post("/api/login", authLimit, async (req, res) => {
  if (demo) throw fail("Gunakan tombol demo untuk mencoba.", 403);
  const email = text(req.body.email, 254).toLowerCase(),
    password = req.body.password;
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password) > 72
  )
    throw fail("Email atau kata sandi salah.", 401);
  const row = (await query("SELECT * FROM users WHERE email=?", [email]))[0];
  if (!row || !(await bcrypt.compare(password, row.password_hash)))
    throw fail("Email atau kata sandi salah.", 401);
  const user = { id: row.id, name: row.name, email: row.email };
  await login(req, res, user);
  res.json({ user });
});
app.post("/api/demo", authLimit, async (req, res) => {
  if (!demo) throw fail("Demo tidak tersedia.", 404);
  const user = { id: randomUUID(), name: "Nadia", demo: true };
  await login(req, res, user);
  const shift = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  };
  const child = {
    id: randomUUID(),
    user_id: user.id,
    name: "Alya",
    dob: shift(-260),
    sex: "female",
  };
  children.set(child.id, child);
  [6.2, 6.5, 6.8, 7.1, 7.4, 7.7].forEach((weight, i) => {
    const r = {
      id: randomUUID(),
      child_id: child.id,
      kind: "measurement",
      date: shift(-155 + i * 30),
      weight,
      height: 62 + i * 1.2,
      head: 40 + i * 0.5,
    };
    records.set(r.id, r);
  });
  for (const r of [
    {
      kind: "journal",
      date: shift(-4),
      title: "Meraih mainan favorit",
      category: "Gerak tubuh",
      notes: "Alya meraih boneka kecilnya saat bermain bersama.",
    },
    {
      kind: "journal",
      date: shift(-12),
      title: "Menyapa dengan celoteh",
      category: "Komunikasi",
      notes: "Pagi ini banyak suara baru saat diajak berbicara.",
    },
    {
      kind: "visit",
      date: shift(10),
      title: "Kunjungan posyandu",
      notes: "Bawa buku KIA dan catatan pengukuran.",
    },
  ]) {
    r.id = randomUUID();
    r.child_id = child.id;
    records.set(r.id, r);
  }
  res.json({ user });
});
app.post("/api/logout", async (req, res) => {
  await dropSession(req);
  res.clearCookie("tb_session", {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: production,
  });
  res.json({ ok: true });
});
app.use("/api", (req, res, next) =>
  req.user
    ? next()
    : res.status(401).json({ error: "Silakan masuk terlebih dahulu." }),
);
app.use("/api/notifications", notificationRouter({ query, demo }));
app.use("/api/forum", forumRouter({ query, demo }));
app.get("/api/articles", (req, res) => res.json(articleSummaries));
app.get("/api/articles/:slug", (req, res) => {
  const article = articles.find((item) => item.slug === req.params.slug);
  if (!article)
    return res.status(404).json({ error: "Artikel tidak ditemukan." });
  res.json(article);
});
app.get("/api/children", async (req, res) =>
  res.json(
    demo
      ? [...children.values()].filter((c) => c.user_id === req.user.id)
      : await query(
          "SELECT * FROM children WHERE user_id=? ORDER BY created_at,id",
          [req.user.id],
        ),
  ),
);
app.post("/api/children", async (req, res) => {
  const name = text(req.body.name, 80),
    dob = validDate(req.body.dob),
    sex = req.body.sex;
  if (
    dob > nowDate() ||
    dob < "1900-01-01" ||
    !["female", "male"].includes(sex)
  )
    throw fail("Tanggal lahir atau jenis kelamin tidak valid.");
  const c = { id: randomUUID(), user_id: req.user.id, name, dob, sex };
  if (demo) children.set(c.id, c);
  else
    await query(
      "INSERT INTO children(id,user_id,name,dob,sex) VALUES(?,?,?,?,?)",
      [c.id, c.user_id, name, dob, sex],
    );
  res.status(201).json(c);
});
app.get("/api/children/:id/records", async (req, res) => {
  await owned(req.params.id, req.user);
  res.json(
    demo
      ? [...records.values()].filter((r) => r.child_id === req.params.id)
      : await query(
          "SELECT * FROM records WHERE child_id=? ORDER BY date,created_at,id",
          [req.params.id],
        ),
  );
});
app.post("/api/children/:id/records", async (req, res) => {
  const child = await owned(req.params.id, req.user),
    b = req.body,
    date = validDate(b.date),
    kind = b.kind;
  if (
    !["measurement", "journal", "visit"].includes(kind) ||
    date < child.dob ||
    (kind !== "visit" && date > nowDate())
  )
    throw fail(
      "Tanggal harus setelah kelahiran dan tidak boleh di masa depan untuk pengukuran/jurnal.",
    );
  const r = {
    id: randomUUID(),
    child_id: child.id,
    kind,
    date,
    weight: null,
    height: null,
    head: null,
    title: null,
    category: null,
    notes: null,
  };
  if (kind === "measurement") {
    r.weight = numeric(b.weight, 0.1, 150);
    r.height = numeric(b.height, 10, 220);
    r.head = numeric(b.head, 10, 100);
    const existing = demo
      ? [...records.values()].find(
          (x) => x.child_id === child.id && x.kind === kind && x.date === date,
        )
      : (
          await query(
            "SELECT id FROM records WHERE child_id=? AND kind=? AND date=?",
            [child.id, kind, date],
          )
        )[0];
    if (existing) throw fail("Pengukuran pada tanggal ini sudah ada.", 409);
  } else {
    r.title = text(b.title, 150);
    r.notes = text(b.notes, 2000, true);
    if (kind === "journal") {
      r.category = text(b.category, 40);
      if (
        ![
          "Gerak tubuh",
          "Komunikasi",
          "Interaksi sosial",
          "Kemandirian",
          "Momen lainnya",
        ].includes(r.category)
      )
        throw fail("Kategori tidak valid.");
    }
  }
  if (demo) records.set(r.id, r);
  else {
    try {
      await query(
        "INSERT INTO records(id,child_id,kind,date,weight,height,head,title,category,notes) VALUES(?,?,?,?,?,?,?,?,?,?)",
        Object.values(r),
      );
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY")
        throw fail("Pengukuran pada tanggal ini sudah ada.", 409);
      throw e;
    }
  }
  res.status(201).json(r);
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Endpoint tidak ditemukan." }),
);
const dist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);
app.use(express.static(dist));
app.get("/{*path}", (req, res) => res.sendFile(path.join(dist, "index.html")));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (!err.status) console.error("API error:", err.code || err.message);
  res.status(err.status || 500).json({
    error: err.status
      ? err.message
      : "Server belum dapat memproses data. Periksa koneksi database.",
  });
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (db) await query("SELECT 1");
  app.listen(Number(process.env.PORT || 3001), "127.0.0.1", () =>
    console.log(
      `API ready: http://127.0.0.1:${process.env.PORT || 3001} (${demo ? "temporary demo" : "MySQL"})`,
    ),
  );
}
export async function closeDatabase() {
  if (db) await db.end();
}
