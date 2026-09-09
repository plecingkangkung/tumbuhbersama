import { captchaBody } from "./captchaTestHelper.js";
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

test(
  "forum media: authenticated multipart, replies, validation, ranges and cascade deletion",
  { skip: process.env.TEST_MYSQL !== "true" },
  async () => {
    process.env.DEMO_MODE = "false";
    const { createAppServer, closeDatabase } = await import("./index.js");
    const { server, realtime } = createAppServer();
    server.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base =
      process.env.TEST_LIVE_MEDIA === "true"
        ? "http://127.0.0.1:5173/api"
        : `http://127.0.0.1:${server.address().port}/api`;
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const users = [];
    const api = async (path, body, cookie, method = body ? "POST" : "GET") => {
      body = await captchaBody(db, path, body);
      return fetch(base + path, {
        method,
        headers: {
          ...(body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
          ...(cookie ? { cookie } : {}),
        },
        body:
          body instanceof FormData
            ? body
            : body
              ? JSON.stringify(body)
              : undefined,
      });
    };
    const photo = await readFile(
      new URL("../public/images/articles/play.jpg", import.meta.url),
    );
    function form(files = [photo], extras = {}) {
      const f = new FormData();
      for (const [k, v] of Object.entries({
        title: "Media test",
        category: "Cerita sehari-hari",
        body: "Lampiran untuk diskusi",
        ...extras,
      }))
        f.append(k, v);
      for (const data of files)
        f.append("media", new Blob([data], { type: "image/jpeg" }), "foto.jpg");
      return f;
    }
    try {
      const accounts = [];
      for (const name of ["Media mom A", "Media mom B"]) {
        const r = await api("/register", {
          name,
          email: `media-${randomUUID()}@example.test`,
          password: randomUUID(),
        });
        assert.equal(r.status, 201);
        const data = await r.json();
        users.push(data.user.id);
        accounts.push(r.headers.get("set-cookie").split(";")[0]);
      }
      const [a, b] = accounts;
      assert.equal((await api("/forum", form())).status, 401);
      let r = await api("/forum", form(), a);
      assert.equal(r.status, 201);
      const topic = await r.json();
      assert.equal(topic.media.length, 1);
      assert.equal(topic.media[0].mime, "image/jpeg");
      const url = "/forum/media/" + topic.media[0].id;
      assert.equal((await api(url)).status, 401);
      r = await api(url, undefined, b);
      assert.equal(r.status, 200);
      assert.deepEqual(Buffer.from(await r.arrayBuffer()), photo);
      r = await fetch(base + url, {
        headers: { cookie: b, range: "bytes=0-15" },
      });
      assert.equal(r.status, 206);
      assert.equal(
        r.headers.get("content-range"),
        `bytes 0-15/${photo.length}`,
      );
      assert.deepEqual(
        Buffer.from(await r.arrayBuffer()),
        photo.subarray(0, 16),
      );
      r = await fetch(base + url, {
        headers: { cookie: b, range: "bytes=-10" },
      });
      assert.equal(r.status, 206);
      assert.deepEqual(Buffer.from(await r.arrayBuffer()), photo.subarray(-10));
      assert.equal(
        (
          await fetch(base + url, {
            headers: { cookie: b, range: "bytes=999999999-" },
          })
        ).status,
        416,
      );
      const video = Buffer.concat([
        Buffer.from([0, 0, 0, 24]),
        Buffer.from("ftypisom"),
        Buffer.alloc(4),
        Buffer.from("isommp42"),
      ]); // MP4 container signature fixture; range transport tested, not codec playback.
      r = await api(`/forum/${topic.id}/comments`, form([video]), b);
      assert.equal(r.status, 201);
      const comment = await r.json();
      const nested = new FormData();
      nested.append("body", "Balasan foto");
      nested.append("parent_id", comment.id);
      nested.append("media", new Blob([photo]), "foto.jpg");
      r = await api(`/forum/${topic.id}/comments`, nested, a);
      assert.equal(r.status, 201);
      let comments = await (
        await api(`/forum/${topic.id}/comments`, undefined, a)
      ).json();
      assert.equal(comments.items.length, 2);
      assert.equal(comments.items[0].media[0].mime, "video/mp4");
      assert.equal(comments.items[1].parent_id, comment.id);
      assert.equal(comments.items[1].media.length, 1);
      const commentUrl = "/forum/media/" + comments.items[0].media[0].id;
      assert.equal(
        (
          await api(
            "/forum",
            form([Buffer.from("<script>invalid</script>")]),
            a,
          )
        ).status,
        400,
      );
      assert.equal(
        (await api("/forum", form([photo, photo, photo, photo, photo]), a))
          .status,
        413,
      );
      assert.equal(
        (
          await api(
            "/forum",
            form([Buffer.concat([photo, Buffer.alloc(5 * 1024 * 1024)])]),
            a,
          )
        ).status,
        413,
      );
      assert.equal(
        (await api("/forum", form([Buffer.alloc(10 * 1024 * 1024 + 1)]), a))
          .status,
        413,
      );
      assert.equal(
        (await api("/forum", form([photo], { category: "invalid" }), a)).status,
        400,
      );
      const [count] = await db.query(
        "SELECT COUNT(*) AS total FROM forum_topics WHERE user_id=?",
        [users[0]],
      );
      assert.equal(count[0].total, 1);
      assert.equal(
        (await api(`/forum/${topic.id}`, {}, b, "DELETE")).status,
        403,
      );
      assert.equal(
        (
          await api(
            `/forum/${topic.id}/comments/${comment.id}`,
            {},
            b,
            "DELETE",
          )
        ).status,
        200,
      );
      assert.equal((await api(commentUrl, undefined, a)).status, 404);
      comments = await (
        await api(`/forum/${topic.id}/comments`, undefined, a)
      ).json();
      assert.equal(comments.items.length, 1);
      assert.equal(comments.items[0].media.length, 1);
      assert.equal(
        (await api(`/forum/${topic.id}`, {}, a, "DELETE")).status,
        200,
      );
      assert.equal((await api(url, undefined, b)).status, 404);
      const [remaining] = await db.query(
        "SELECT COUNT(*) AS total FROM forum_media WHERE topic_id=?",
        [topic.id],
      );
      assert.equal(remaining[0].total, 0);
    } finally {
      for (const id of users)
        await db.execute("DELETE FROM users WHERE id=?", [id]);
      await db.end();
      await new Promise((r) => realtime.io.close(r));
      await closeDatabase();
    }
  },
);
