import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { io } from "socket.io-client";
import { threadComments } from "../src/forumThreads.js";
const event = (s, name) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      s.off(name, done);
      reject(new Error("No event: " + name));
    }, 5000);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    s.once(name, done);
  });
test("reply grouping retains parents, nested replies and pagination context", () => {
  const result = threadComments([
    { id: "a" },
    { id: "b" },
    { id: "c", parent_id: "a", is_reply: 1 },
    { id: "d", parent_id: "c", is_reply: 1 },
    { id: "e", parent_id: "off-page", is_reply: 1 },
  ]);
  assert.deepEqual(
    result.map((c) => c.id),
    ["a", "c", "d", "b", "e"],
  );
  assert.deepEqual(
    result.map((c) => c.depth),
    [0, 1, 2, 0, 1],
  );
});
test(
  "nested mentions, valid recipients, deletion and realtime reply notification",
  { skip: process.env.TEST_MYSQL !== "true" },
  async () => {
    process.env.DEMO_MODE = "false";
    const live = process.env.TEST_LIVE_REPLIES === "true";
    let server, realtime, closeDatabase;
    if (!live) {
      const mod = await import("./index.js");
      ({ server, realtime } = mod.createAppServer());
      closeDatabase = mod.closeDatabase;
      server.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
    }
    const base = live
      ? "http://127.0.0.1:5173"
      : `http://127.0.0.1:${server.address().port}`;
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const users = [],
      sockets = [];
    async function api(
      path,
      body,
      cookie,
      method = body === undefined ? "GET" : "POST",
    ) {
      const r = await fetch(base + "/api" + path, {
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
      const accounts = [];
      for (const name of ["Owner", "Mom B", "Mom C"]) {
        const a = await api("/register", {
          name,
          email: `reply-${randomUUID()}@example.test`,
          password: randomUUID(),
        });
        assert.equal(a.status, 201);
        users.push(a.data.user.id);
        accounts.push(a);
      }
      const [a, b, c] = accounts;
      for (const account of [b, c]) {
        const s = io(base, {
          transports: ["websocket"],
          autoConnect: false,
          reconnection: false,
          extraHeaders: {
            Origin: process.env.APP_ORIGIN,
            Cookie: account.cookie,
          },
        });
        sockets.push(s);
        const ready = event(s, "connect");
        s.connect();
        await ready;
      }
      const create = {
        title: "Reply test",
        category: "Cerita sehari-hari",
        body: "Discussion",
      };
      const topic = await api("/forum", create, a.cookie),
        other = await api("/forum", create, a.cookie);
      assert.equal(topic.status, 201);
      const path = "/forum/" + topic.data.id + "/comments";
      const root = await api(path, { body: "Pertanyaan mom B" }, b.cookie);
      assert.equal(root.status, 201);
      const bNotified = event(sockets[0], "notifications:changed");
      const reply = await api(
        path,
        {
          body: "Jawaban untuk B",
          parent_id: root.data.id,
          reply_to_user_id: a.data.user.id,
        },
        c.cookie,
      );
      assert.equal(reply.status, 201);
      await bNotified;
      const inboxB = await api("/notifications", undefined, b.cookie);
      assert.equal(inboxB.data.total, 1);
      assert.equal(inboxB.data.items[0].kind, "reply");
      assert.equal(inboxB.data.items[0].actor_name, "Mom C");
      const cNotified = event(sockets[1], "notifications:changed");
      const nested = await api(
        path,
        { body: "Terima kasih C", parent_id: reply.data.id },
        b.cookie,
      );
      assert.equal(nested.status, 201);
      await cNotified;
      const comments = await api(path, undefined, a.cookie);
      const nestedRow = comments.data.items.find(
        (row) => row.id === nested.data.id,
      );
      assert.equal(nestedRow.parent_id, reply.data.id);
      assert.equal(nestedRow.reply_to_name, "Mom C");
      assert.equal(nestedRow.is_reply, 1);
      assert.equal(nestedRow.reply_to_user_id, undefined);
      assert.equal(
        (
          await api(
            "/forum/" + other.data.id + "/comments",
            { body: "Invalid cross-topic", parent_id: root.data.id },
            c.cookie,
          )
        ).status,
        404,
      );
      assert.equal(
        (await api(path, { body: "Invalid", parent_id: 123 }, c.cookie)).status,
        400,
      );
      const before = (await api("/notifications", undefined, b.cookie)).data
        .total;
      assert.equal(
        (
          await api(
            path,
            { body: "Self reply", parent_id: root.data.id },
            b.cookie,
          )
        ).status,
        201,
      );
      assert.equal(
        (await api("/notifications", undefined, b.cookie)).data.total,
        before,
      );
      assert.equal(
        (await api(path + "/" + root.data.id, {}, b.cookie, "DELETE")).status,
        200,
      );
      const retained = (await api(path, undefined, a.cookie)).data.items.find(
        (row) => row.id === reply.data.id,
      );
      assert.equal(retained.parent_id, null);
      assert.equal(retained.reply_to_name, "Mom B");
      assert.equal(retained.body, "Jawaban untuk B");
      assert.equal(
        (
          await api(
            path,
            { body: "Missing parent", parent_id: root.data.id },
            c.cookie,
          )
        ).status,
        404,
      );
    } finally {
      for (const s of sockets) s.disconnect();
      for (const id of users)
        await db.execute("DELETE FROM users WHERE id=?", [id]);
      await db.end();
      if (realtime) await new Promise((r) => realtime.io.close(r));
      if (closeDatabase) await closeDatabase();
    }
  },
);
