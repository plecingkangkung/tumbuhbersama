import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { captchaBody } from "./captchaTestHelper.js";

test(
  "CAPTCHA required, wrong answers consumed, expiry, concurrent reuse and actual SVG endpoint",
  { skip: process.env.TEST_MYSQL !== "true" },
  async () => {
    process.env.DEMO_MODE = "false";
    const { app, closeDatabase } = await import("./index.js");
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base =
      process.env.TEST_LIVE_CAPTCHA === "true"
        ? "http://127.0.0.1:5173"
        : `http://127.0.0.1:${server.address().port}`;
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const ids = [];
    const post = (path, body) =>
      fetch(base + "/api" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const fixture = async () => {
      const b = await captchaBody(db, "/login", {});
      ids.push(b.captcha_id);
      return b;
    };
    try {
      for (const path of ["/login", "/register"]) {
        const r = await post(path, {});
        assert.equal(r.status, 400);
        assert.match((await r.json()).error, /Kode verifikasi/);
      }
      let r = await fetch(base + "/api/captcha");
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("cache-control"), "no-store");
      const c = await r.json();
      ids.push(c.id);
      assert.equal(c.expiresIn, 300);
      assert.equal(c.answer, undefined);
      assert.equal(c.text, undefined);
      assert.ok(c.image.startsWith("data:image/svg+xml;base64,"));
      const svg = Buffer.from(c.image.split(",")[1], "base64").toString();
      assert.match(svg, /<svg/);
      assert.match(svg, /<path/);
      assert.doesNotMatch(svg, /<text/);
      const wrong = await fixture();
      r = await post("/login", { ...wrong, captcha_answer: "XXXXX" });
      assert.equal(r.status, 400);
      assert.match((await r.json()).error, /Kode verifikasi/);
      r = await post("/login", wrong);
      assert.match((await r.json()).error, /Kode verifikasi/);
      const expired = await fixture();
      await db.execute(
        "UPDATE auth_captchas SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE id=?",
        [expired.captcha_id],
      );
      r = await post("/register", expired);
      assert.match((await r.json()).error, /Kode verifikasi/);
      const valid = await fixture();
      r = await post("/login", { ...valid, captcha_answer: " ab234 " });
      assert.doesNotMatch((await r.json()).error, /Kode verifikasi/);
      r = await post("/login", valid);
      assert.match((await r.json()).error, /Kode verifikasi/);
      const race = await fixture();
      const responses = await Promise.all([
        post("/login", race),
        post("/login", race),
      ]);
      const results = await Promise.all(responses.map((r) => r.json()));
      assert.equal(
        results.filter((r) => /Kode verifikasi/.test(r.error)).length,
        1,
      );
      const invalid = await fixture();
      r = await post("/login", { ...invalid, captcha_answer: [] });
      assert.match((await r.json()).error, /Kode verifikasi/);
    } finally {
      for (const id of ids)
        await db.execute("DELETE FROM auth_captchas WHERE id=?", [id]);
      await db.end();
      await new Promise((r) => server.close(r));
      await closeDatabase();
    }
  },
);
