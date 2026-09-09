import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { captchaBody } from "./captchaTestHelper.js";
import { milestoneStages } from "../shared/milestones.js";
test(
  "milestone persistence, dates, child/account isolation and measurement position updates",
  { skip: process.env.TEST_MYSQL !== "true" },
  async () => {
    process.env.DEMO_MODE = "false";
    const { app, closeDatabase } = await import("./index.js");
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base =
      process.env.TEST_LIVE_GROWTH === "true"
        ? "http://127.0.0.1:5173/api"
        : `http://127.0.0.1:${server.address().port}/api`;
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const users = [];
    async function api(path, body, cookie, method = body ? "POST" : "GET") {
      body = await captchaBody(db, path, body);
      const r = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return {
        status: r.status,
        data: await r.json(),
        cookie: r.headers.get("set-cookie")?.split(";")[0],
      };
    }
    try {
      const accounts = [];
      for (const name of ["Growth A", "Growth B"]) {
        const a = await api("/register", {
          name,
          email: `growth-${randomUUID()}@example.test`,
          password: randomUUID(),
        });
        assert.equal(a.status, 201);
        users.push(a.data.user.id);
        accounts.push(a);
      }
      const [a, b] = accounts;
      const children = [];
      for (const name of ["First", "Second"]) {
        const c = await api(
          "/children",
          { name, dob: "2025-01-01", sex: "female" },
          a.cookie,
        );
        assert.equal(c.status, 201);
        children.push(c.data);
      }
      const c = children[0],
        id = milestoneStages[0].items[0].id,
        path = `/children/${c.id}/milestones`;
      assert.equal((await api(path)).status, 401);
      assert.equal((await api(path, undefined, b.cookie)).status, 404);
      assert.equal(
        (
          await api(
            path + "/" + id,
            { checked: true, observed_date: "2025-02-01" },
            b.cookie,
            "PUT",
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await api(
            path + "/fake",
            { checked: true, observed_date: "2025-02-01" },
            a.cookie,
            "PUT",
          )
        ).status,
        400,
      );
      for (const date of ["2024-12-31", "2099-01-01", "2025-02-30"])
        assert.equal(
          (
            await api(
              path + "/" + id,
              { checked: true, observed_date: date },
              a.cookie,
              "PUT",
            )
          ).status,
          400,
        );
      assert.equal(
        (
          await api(
            path + "/" + id,
            { checked: "true", observed_date: "2025-02-01" },
            a.cookie,
            "PUT",
          )
        ).status,
        400,
      );
      for (let i = 0; i < 2; i++)
        assert.equal(
          (
            await api(
              path + "/" + id,
              { checked: true, observed_date: "2025-02-01" },
              a.cookie,
              "PUT",
            )
          ).status,
          200,
        );
      assert.deepEqual((await api(path, undefined, a.cookie)).data, [
        { milestone_id: id, observed_date: "2025-02-01" },
      ]);
      assert.equal(
        (
          await api(
            `/children/${children[1].id}/milestones`,
            undefined,
            a.cookie,
          )
        ).data.length,
        0,
      );
      assert.equal(
        (
          await api(
            path + "/" + id,
            { checked: true, observed_date: "2025-02-02" },
            a.cookie,
            "PUT",
          )
        ).status,
        200,
      );
      assert.equal(
        (await api(path, undefined, a.cookie)).data[0].observed_date,
        "2025-02-02",
      );
      assert.equal(
        (await api(path + "/" + id, { checked: false }, a.cookie, "PUT"))
          .status,
        200,
      );
      assert.equal((await api(path, undefined, a.cookie)).data.length, 0);
      const measurement = await api(
        `/children/${c.id}/records`,
        {
          kind: "measurement",
          date: "2025-02-01",
          weight: 4.5,
          height: 54,
          head: 37,
          height_position: "recumbent",
        },
        a.cookie,
      );
      assert.equal(measurement.status, 201);
      assert.equal(measurement.data.height_position, "recumbent");
      const rp = `/children/${c.id}/records/${measurement.data.id}/position`;
      assert.equal(
        (await api(rp, { height_position: "standing" }, b.cookie, "PUT"))
          .status,
        404,
      );
      assert.equal(
        (await api(rp, { height_position: "invalid" }, a.cookie, "PUT")).status,
        400,
      );
      assert.equal(
        (await api(rp, { height_position: "standing" }, a.cookie, "PUT"))
          .status,
        200,
      );
      assert.equal(
        (await api(`/children/${c.id}/records`, undefined, a.cookie)).data[0]
          .height_position,
        "standing",
      );
      assert.equal(
        (
          await api(
            `/children/${children[1].id}/records/${measurement.data.id}/position`,
            { height_position: "standing" },
            a.cookie,
            "PUT",
          )
        ).status,
        404,
      );
      const journal = await api(
        `/children/${c.id}/records`,
        {
          kind: "journal",
          date: "2025-02-01",
          title: "Smile",
          category: "Interaksi sosial",
          notes: "Test",
        },
        a.cookie,
      );
      assert.equal(journal.status, 201);
      assert.equal(
        (
          await api(
            `/children/${c.id}/records/${journal.data.id}/position`,
            { height_position: "standing" },
            a.cookie,
            "PUT",
          )
        ).status,
        404,
      );
      await api(
        path + "/" + id,
        { checked: true, observed_date: "2025-02-01" },
        a.cookie,
        "PUT",
      );
      await db.execute("DELETE FROM children WHERE id=?", [c.id]);
      const [rows] = await db.execute(
        "SELECT * FROM child_milestones WHERE child_id=?",
        [c.id],
      );
      assert.equal(rows.length, 0);
    } finally {
      for (const id of users)
        await db.execute("DELETE FROM users WHERE id=?", [id]);
      await db.end();
      await new Promise((r) => server.close(r));
      await closeDatabase();
    }
  },
);
