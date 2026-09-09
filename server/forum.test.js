import { captchaBody } from "./captchaTestHelper.js";
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
test(
  "forum: shared discussions, comments, privacy, pagination and ownership",
  { skip: process.env.TEST_MYSQL !== "true" },
  async () => {
    process.env.DEMO_MODE = "false";
    const live = process.env.TEST_LIVE_FORUM === "true";
    let server, closeDatabase;
    if (!live) {
      const mod = await import("./index.js");
      closeDatabase = mod.closeDatabase;
      server = mod.app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
    }
    const base = live
      ? "http://127.0.0.1:5173/api"
      : `http://127.0.0.1:${server.address().port}/api`;
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const users = [];
    async function req(path, method = "GET", body, cookie) {
      body = await captchaBody(db, path, body);
      const r = await fetch(base + path, {
        method,
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
      assert.equal((await req("/forum")).status, 401);
      const accounts = [];
      for (const name of ["Mom A", "Mom B"]) {
        const a = await req("/register", "POST", {
          name,
          email: `forum-${randomUUID()}@example.test`,
          password: randomUUID(),
        });
        assert.equal(a.status, 201);
        users.push(a.data.user.id);
        accounts.push(a);
      }
      const [a, b] = accounts,
        unique = randomUUID();
      assert.equal(
        (
          await req(
            "/forum",
            "POST",
            { title: " ", body: "Text", category: "Cerita sehari-hari" },
            a.cookie,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await req(
            "/forum",
            "POST",
            { title: "Hello", body: "Text", category: "Unknown" },
            a.cookie,
          )
        ).status,
        400,
      );
      const created = await req(
        "/forum",
        "POST",
        {
          title: `Forum test ${unique}`,
          body: "Cerita <script>alert(1)</script>",
          category: "Cerita sehari-hari",
        },
        a.cookie,
      );
      assert.equal(created.status, 201);
      assert.equal(created.data.is_owner, 1);
      const topicId = created.data.id;
      const likesPath = "/forum/" + topicId + "/like";
      assert.equal((await req(likesPath, "PUT", { liked: true })).status, 401);
      assert.equal(
        (await req(likesPath, "PUT", { liked: "yes" }, a.cookie)).status,
        400,
      );
      assert.equal(created.data.like_count, 0);
      const first = await req(likesPath, "PUT", { liked: true }, a.cookie);
      assert.equal(first.status, 200);
      assert.equal(first.data.liked, true);
      assert.equal(first.data.like_count, 1);
      const duplicates = await Promise.all([
        req(likesPath, "PUT", { liked: true }, a.cookie),
        req(likesPath, "PUT", { liked: true }, a.cookie),
      ]);
      for (const r of duplicates) assert.equal(r.data.like_count, 1);
      const second = await req(likesPath, "PUT", { liked: true }, b.cookie);
      assert.equal(second.data.like_count, 2);
      assert.equal((await req("/notifications")).status, 401);
      const inbox = await req("/notifications", "GET", undefined, a.cookie);
      assert.equal(inbox.status, 200);
      assert.equal(inbox.data.total, 1);
      assert.equal(inbox.data.unread, 1);
      assert.equal(inbox.data.items[0].kind, "like");
      assert.equal(inbox.data.items[0].actor_name, "Mom B");
      assert.equal(inbox.data.items[0].topic_id, topicId);
      assert.equal(inbox.data.items[0].actor_id, undefined);
      assert.equal(
        (await req("/notifications", "GET", undefined, b.cookie)).data.total,
        0,
      );
      const notificationId = inbox.data.items[0].id;
      assert.equal(
        (
          await req(
            "/notifications/" + notificationId + "/read",
            "PUT",
            {},
            b.cookie,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await req(
            "/notifications/" + notificationId + "/read",
            "PUT",
            {},
            a.cookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (await req("/notifications", "GET", undefined, a.cookie)).data.unread,
        0,
      );
      await req(likesPath, "PUT", { liked: true }, b.cookie);
      assert.equal(
        (await req("/notifications", "GET", undefined, a.cookie)).data.total,
        1,
      );
      const unlike = await req(likesPath, "PUT", { liked: false }, a.cookie);
      assert.equal(unlike.data.like_count, 1);
      assert.equal(unlike.data.liked, false);
      assert.equal(
        (await req(likesPath, "PUT", { liked: false }, a.cookie)).data
          .like_count,
        1,
      );
      const persisted = await req(
        "/forum/" + topicId,
        "GET",
        undefined,
        b.cookie,
      );
      assert.equal(persisted.data.liked, 1);
      assert.equal(persisted.data.like_count, 1);
      const listing = await req(
        "/forum?q=" + unique,
        "GET",
        undefined,
        a.cookie,
      );
      assert.equal(listing.data.items[0].liked, 0);
      assert.equal(listing.data.items[0].like_count, 1);
      const read = await req("/forum/" + topicId, "GET", undefined, b.cookie);
      assert.equal(read.status, 200);
      assert.equal(read.data.is_owner, 0);
      assert.equal(read.data.author_name, "Mom A");
      assert.equal(read.data.email, undefined);
      assert.equal(read.data.user_id, undefined);
      const results = await req(
        "/forum?q=" + unique,
        "GET",
        undefined,
        b.cookie,
      );
      assert.equal(results.data.total, 1);
      assert.equal(results.data.items[0].body, undefined);
      assert.equal(
        (await req("/forum?page=-1", "GET", undefined, a.cookie)).status,
        400,
      );
      assert.equal(
        (await req("/forum/" + topicId, "DELETE", {}, b.cookie)).status,
        403,
      );
      const comment = await req(
        "/forum/" + topicId + "/comments",
        "POST",
        { body: "Semangat mom!" },
        b.cookie,
      );
      assert.equal(comment.status, 201);
      const commentInbox = await req(
        "/notifications",
        "GET",
        undefined,
        a.cookie,
      );
      assert.equal(commentInbox.data.total, 2);
      assert.equal(commentInbox.data.unread, 1);
      assert.equal(commentInbox.data.items[0].kind, "comment");
      await req("/notifications/read-all", "PUT", {}, b.cookie);
      assert.equal(
        (await req("/notifications", "GET", undefined, a.cookie)).data.unread,
        1,
      );
      await req("/notifications/read-all", "PUT", {}, a.cookie);
      assert.equal(
        (await req("/notifications", "GET", undefined, a.cookie)).data.unread,
        0,
      );
      const thread = await req(
        "/forum/" + topicId + "/comments",
        "GET",
        undefined,
        a.cookie,
      );
      assert.equal(thread.data.items[0].author_name, "Mom B");
      assert.equal(thread.data.items[0].is_owner, 0);
      assert.equal(thread.data.items[0].email, undefined);
      assert.equal(
        (
          await req(
            "/forum/" + topicId + "/comments/" + comment.data.id,
            "DELETE",
            {},
            a.cookie,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await req(
            "/forum/" + topicId + "/comments/" + comment.data.id,
            "DELETE",
            {},
            b.cookie,
          )
        ).status,
        200,
      );
      const batch = Array.from({ length: 51 }, () => [
        randomUUID(),
        topicId,
        users[1],
        "Pagination fixture",
      ]);
      await db.query(
        "INSERT INTO forum_comments(id,topic_id,user_id,body) VALUES ?",
        [batch],
      );
      const page = await req(
        "/forum/" + topicId + "/comments?page=2",
        "GET",
        undefined,
        a.cookie,
      );
      assert.equal(page.data.total, 51);
      assert.equal(page.data.items.length, 1);
      assert.equal(
        (await req("/forum/" + topicId, "GET", undefined, b.cookie)).data
          .comment_count,
        51,
      );
      assert.equal(
        (await req("/forum/" + topicId, "DELETE", {}, a.cookie)).status,
        200,
      );
      assert.equal(
        (await req("/forum/" + topicId, "GET", undefined, b.cookie)).status,
        404,
      );
      assert.equal(
        (
          await req(
            "/forum/" + topicId + "/comments",
            "POST",
            { body: "Too late" },
            b.cookie,
          )
        ).status,
        404,
      );
      const [remaining] = await db.execute(
        "SELECT COUNT(*) AS n FROM forum_comments WHERE topic_id=?",
        [topicId],
      );
      assert.equal(remaining[0].n, 0);
      const [remainingLikes] = await db.execute(
        "SELECT COUNT(*) AS n FROM forum_likes WHERE topic_id=?",
        [topicId],
      );
      assert.equal(remainingLikes[0].n, 0);
      const emptyInbox = await req(
        "/notifications",
        "GET",
        undefined,
        a.cookie,
      );
      assert.equal(emptyInbox.data.total, 0);
      assert.equal(emptyInbox.data.unread, 0);
      assert.equal(
        (await req(likesPath, "PUT", { liked: true }, b.cookie)).status,
        404,
      );
    } finally {
      for (const id of users)
        await db.execute("DELETE FROM users WHERE id=?", [id]);
      await db.end();
      if (server) await new Promise((r) => server.close(r));
      if (closeDatabase) await closeDatabase();
    }
  },
);
