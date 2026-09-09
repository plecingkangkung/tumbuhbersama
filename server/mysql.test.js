import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
// Explicit opt-in: uses the configured local database and deletes only its own fixture accounts.
test(
  "MySQL registration, authorization, durable records and logout",
  { skip: process.env.TEST_MYSQL !== "true" },
  async () => {
    process.env.DEMO_MODE = "false";
    const { app, closeDatabase } = await import("./index.js");
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = `http://127.0.0.1:${server.address().port}/api`,
      ids = [];
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    async function req(path, body, cookie) {
      const r = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return {
        status: r.status,
        data: await r.json(),
        cookie: r.headers.get("set-cookie")?.split(";")[0],
      };
    }
    try {
      const email = `test-${randomUUID()}@example.test`,
        password = " test-password-123 ";
      const a = await req("/register", {
        name: "Test Parent",
        email,
        password,
      });
      assert.equal(a.status, 201);
      ids.push(a.data.user.id);
      const b = await req("/register", {
        name: "Second Parent",
        email: `test-${randomUUID()}@example.test`,
        password,
      });
      assert.equal(b.status, 201);
      ids.push(b.data.user.id);
      assert.equal(
        (await req("/register", { name: "Duplicate", email, password })).status,
        409,
      );
      assert.equal(
        (await req("/login", { email, password: "wrong-password" })).status,
        401,
      );
      const child = await req(
        "/children",
        { name: "Test Child", dob: "2026-01-01", sex: "female" },
        a.cookie,
      );
      assert.equal(child.status, 201);
      const endpoint = `/children/${child.data.id}/records`;
      assert.equal((await req(endpoint, undefined, b.cookie)).status, 404);
      assert.equal(
        (
          await req(
            endpoint,
            {
              kind: "journal",
              date: "2026-02-01",
              title: "Unauthorized",
              category: "Momen lainnya",
            },
            b.cookie,
          )
        ).status,
        404,
      );
      const measurement = {
        kind: "measurement",
        date: "2026-02-01",
        weight: 4.2,
        height: 54,
        head: 37,
      };
      assert.equal((await req(endpoint, measurement, a.cookie)).status, 201);
      assert.equal((await req(endpoint, measurement, a.cookie)).status, 409);
      assert.equal(
        (
          await req(
            endpoint,
            {
              kind: "journal",
              date: "2026-02-01",
              title: "Momen",
              category: "Momen lainnya",
              notes: "Catatan",
            },
            a.cookie,
          )
        ).status,
        201,
      );
      assert.equal(
        (
          await req(
            endpoint,
            { kind: "visit", date: "2027-01-01", title: "Posyandu" },
            a.cookie,
          )
        ).status,
        201,
      );
      const [rows] = await db.execute(
        "SELECT COUNT(*) AS n FROM records WHERE child_id=?",
        [child.data.id],
      );
      assert.equal(rows[0].n, 3);
      await req("/logout", {}, a.cookie);
      assert.equal((await req("/children", undefined, a.cookie)).status, 401);
      const login = await req("/login", { email, password });
      assert.equal(login.status, 200);
      assert.equal(
        (await req(endpoint, undefined, login.cookie)).data.length,
        3,
      );
      assert.equal(
        (await req("/children", undefined, login.cookie)).data[0].name,
        "Test Child",
      );
      const [stored] = await db.execute(
        "SELECT password_hash FROM users WHERE id=?",
        [ids[0]],
      );
      assert.notEqual(stored[0].password_hash, password);
    } finally {
      for (const id of ids)
        await db.execute("DELETE FROM users WHERE id=?", [id]);
      await db.end();
      await new Promise((r) => server.close(r));
      await closeDatabase();
    }
  },
);
