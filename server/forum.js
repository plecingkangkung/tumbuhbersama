import { Router } from "express";
import { randomUUID } from "node:crypto";
import rateLimit from "express-rate-limit";
export const forumCategories = [
  "Cerita sehari-hari",
  "Tumbuh kembang",
  "MPASI & nutrisi",
  "Tidur & kesehatan",
  "Dukungan untuk mom",
];
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const content = (v, max) => {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    throw fail(`Isian wajib diisi dan maksimal ${max} karakter.`);
  return v.trim();
};
const pageNumber = (v) => {
  if (v === undefined) return 1;
  if (!/^\d+$/.test(String(v)) || Number(v) < 1 || Number(v) > 10000)
    throw fail("Halaman tidak valid.");
  return Number(v);
};
// Only public display names are selected. Emails and child records never enter forum responses.
export function forumRouter({ query, demo }) {
  const router = Router();
  router.use((req, res, next) =>
    demo
      ? res
          .status(503)
          .json({
            error:
              "Forum bersama tersedia pada mode akun MySQL. Keluar dari demo dan gunakan akun biasa.",
          })
      : next(),
  );
  const writeLimit = rateLimit({
    windowMs: 60000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Terlalu banyak kiriman. Tunggu satu menit sebelum mencoba lagi.",
    },
  });
  const selectTopic = `SELECT t.id,t.title,t.category,t.body,t.created_at,u.name AS author_name,(t.user_id=?) AS is_owner,(SELECT COUNT(*) FROM forum_comments c WHERE c.topic_id=t.id) AS comment_count FROM forum_topics t JOIN users u ON u.id=t.user_id`;
  const topic = async (id, user) => {
    const row = (await query(selectTopic + " WHERE t.id=?", [user.id, id]))[0];
    if (!row) throw fail("Diskusi tidak ditemukan atau sudah dihapus.", 404);
    return row;
  };
  router.get("/", async (req, res) => {
    const page = pageNumber(req.query.page),
      search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (search.length > 120) throw fail("Pencarian maksimal 120 karakter.");
    const category = req.query.category || "";
    if (category && !forumCategories.includes(category))
      throw fail("Kategori tidak valid.");
    const where = [],
      params = [];
    if (category) {
      where.push("t.category=?");
      params.push(category);
    }
    if (search) {
      where.push("(LOCATE(?,t.title)>0 OR LOCATE(?,t.body)>0)");
      params.push(search, search);
    }
    const clause = where.length ? " WHERE " + where.join(" AND ") : "";
    const total = (
      await query(
        "SELECT COUNT(*) AS total FROM forum_topics t" + clause,
        params,
      )
    )[0].total;
    const items = await query(
      selectTopic +
        clause +
        ` ORDER BY t.created_at DESC,t.id DESC LIMIT 20 OFFSET ${(page - 1) * 20}`,
      [req.user.id, ...params],
    );
    res.json({
      items: items.map(({ body, ...item }) => ({
        ...item,
        excerpt: body.slice(0, 180),
      })),
      total,
      page,
      pageSize: 20,
      categories: forumCategories,
    });
  });
  router.post("/", writeLimit, async (req, res) => {
    const title = content(req.body.title, 160),
      body = content(req.body.body, 5000),
      category = req.body.category;
    if (!forumCategories.includes(category))
      throw fail("Pilih kategori diskusi yang tersedia.");
    const id = randomUUID();
    await query(
      "INSERT INTO forum_topics(id,user_id,title,category,body) VALUES(?,?,?,?,?)",
      [id, req.user.id, title, category, body],
    );
    res.status(201).json(await topic(id, req.user));
  });
  router.get("/:id", async (req, res) =>
    res.json(await topic(req.params.id, req.user)),
  );
  router.delete("/:id", writeLimit, async (req, res) => {
    const row = await topic(req.params.id, req.user);
    if (!row.is_owner)
      throw fail("Kamu hanya dapat menghapus diskusimu sendiri.", 403);
    await query("DELETE FROM forum_topics WHERE id=? AND user_id=?", [
      req.params.id,
      req.user.id,
    ]);
    res.json({ ok: true });
  });
  router.get("/:id/comments", async (req, res) => {
    await topic(req.params.id, req.user);
    const page = pageNumber(req.query.page);
    const total = (
      await query(
        "SELECT COUNT(*) AS total FROM forum_comments WHERE topic_id=?",
        [req.params.id],
      )
    )[0].total;
    const items = await query(
      `SELECT c.id,c.body,c.created_at,u.name AS author_name,(c.user_id=?) AS is_owner FROM forum_comments c JOIN users u ON u.id=c.user_id WHERE c.topic_id=? ORDER BY c.created_at,c.id LIMIT 50 OFFSET ${(page - 1) * 50}`,
      [req.user.id, req.params.id],
    );
    res.json({ items, total, page, pageSize: 50 });
  });
  router.post("/:id/comments", writeLimit, async (req, res) => {
    await topic(req.params.id, req.user);
    const body = content(req.body.body, 2000),
      id = randomUUID();
    try {
      await query(
        "INSERT INTO forum_comments(id,topic_id,user_id,body) VALUES(?,?,?,?)",
        [id, req.params.id, req.user.id, body],
      );
    } catch (e) {
      if (e.code === "ER_NO_REFERENCED_ROW_2")
        throw fail("Diskusi sudah dihapus.", 404);
      throw e;
    }
    res.status(201).json({ id });
  });
  router.delete("/:id/comments/:commentId", writeLimit, async (req, res) => {
    const row = (
      await query(
        "SELECT user_id FROM forum_comments WHERE id=? AND topic_id=?",
        [req.params.commentId, req.params.id],
      )
    )[0];
    if (!row) throw fail("Komentar tidak ditemukan.", 404);
    if (row.user_id !== req.user.id)
      throw fail("Kamu hanya dapat menghapus komentarmu sendiri.", 403);
    await query("DELETE FROM forum_comments WHERE id=? AND user_id=?", [
      req.params.commentId,
      req.user.id,
    ]);
    res.json({ ok: true });
  });
  return router;
}
