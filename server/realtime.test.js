import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { io } from "socket.io-client";
import mysql from "mysql2/promise";
const waitEvent = (socket, event) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, done);
      reject(new Error("Timed out: " + event));
    }, 5000);
    const done = (...args) => {
      clearTimeout(timer);
      resolve(args);
    };
    socket.once(event, done);
  });
test(
  "WebSocket notification delivery, isolation, reconnect and session revocation",
  { skip: process.env.TEST_MYSQL !== "true" },
  async () => {
    process.env.DEMO_MODE = "false";
    const live = process.env.TEST_LIVE_SOCKET === "true";
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
    const sockets = [],
      users = [];
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    async function api(path, method = "GET", body, cookie) {
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
    function connect(
      cookie,
      origin = process.env.APP_ORIGIN || "http://127.0.0.1:5173",
    ) {
      const socket = io(base, {
        autoConnect: false,
        transports: ["websocket"],
        reconnection: false,
        extraHeaders: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
      });
      sockets.push(socket);
      return socket;
    }
    try {
      const anonymous = connect();
      const denied = waitEvent(anonymous, "connect_error");
      anonymous.connect();
      await denied;
      assert.equal(anonymous.connected, false);
      const accounts = [];
      for (let i = 0; i < 3; i++) {
        const r = await api("/register", "POST", {
          name: "Socket test " + i,
          email: `socket-${randomUUID()}@example.test`,
          password: randomUUID(),
        });
        assert.equal(r.status, 201);
        accounts.push(r);
        users.push(r.data.user.id);
      }
      const [a, b, c] = accounts;
      const foreign = connect(a.cookie, "https://example.com");
      const foreignDenied = waitEvent(foreign, "connect_error");
      foreign.connect();
      await foreignDenied;
      assert.equal(foreign.connected, false);
      const sa = connect(a.cookie),
        sa2 = connect(a.cookie),
        sb = connect(b.cookie),
        sc = connect(c.cookie);
      await Promise.all(
        [sa, sa2, sb, sc].map(async (s) => {
          const connected = waitEvent(s, "connect");
          s.connect();
          await connected;
          assert.equal(s.io.engine.transport.name, "websocket");
        }),
      );
      let otherEvents = 0;
      sb.on("notifications:changed", () => otherEvents++);
      sc.on("notifications:changed", () => otherEvents++);
      const created = await api(
        "/forum",
        "POST",
        {
          title: "Socket " + randomUUID(),
          category: "Cerita sehari-hari",
          body: "Temporary socket test",
        },
        a.cookie,
      );
      assert.equal(created.status, 201);
      const id = created.data.id;
      const first = waitEvent(sa, "notifications:changed"),
        second = waitEvent(sa2, "notifications:changed");
      assert.equal(
        (
          await api(
            "/forum/" + id + "/comments",
            "POST",
            { body: "Hello mom" },
            b.cookie,
          )
        ).status,
        201,
      );
      await Promise.all([first, second]);
      const inbox = await api("/notifications", "GET", undefined, a.cookie);
      assert.equal(inbox.data.unread, 1);
      assert.equal(otherEvents, 0);
      const readSync = waitEvent(sa2, "notifications:changed");
      await api("/notifications/read-all", "PUT", {}, a.cookie);
      await readSync;
      assert.equal(
        (await api("/notifications", "GET", undefined, a.cookie)).data.unread,
        0,
      );
      sa.disconnect();
      await api("/forum/" + id + "/like", "PUT", { liked: true }, b.cookie);
      const reconnected = waitEvent(sa, "connect");
      sa.connect();
      await reconnected;
      assert.equal(
        (await api("/notifications", "GET", undefined, a.cookie)).data.unread,
        1,
      );
      const unlikeUpdate = waitEvent(sa, "notifications:changed");
      await api("/forum/" + id + "/like", "PUT", { liked: false }, b.cookie);
      await unlikeUpdate;
      assert.equal(
        (await api("/notifications", "GET", undefined, a.cookie)).data.total,
        1,
      );
      const revoked = waitEvent(sa, "disconnect"),
        revoked2 = waitEvent(sa2, "disconnect");
      await api("/logout", "POST", {}, a.cookie);
      await Promise.all([revoked, revoked2]);
      assert.equal(sa.connected, false);
      assert.equal(sa2.connected, false);
      const expired = connect(a.cookie);
      const expiredError = waitEvent(expired, "connect_error");
      expired.connect();
      await expiredError;
      assert.equal(expired.connected, false);
      assert.equal(otherEvents, 0);
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
