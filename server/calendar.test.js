import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { captchaBody } from "./captchaTestHelper.js";
import {
  addDays,
  addMonths,
  vaccineDates,
  vaccineSchedule,
  weekRange,
  reminderPhase,
  jakartaDate,
  calendarICS,
} from "../shared/calendar.js";

test("vaccine calendar month boundaries, optional doses and week conversion", () => {
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonths("2025-01-31", 1), "2025-02-28");
  assert.equal(vaccineSchedule.filter((v) => !v.optional).length, 20);
  assert.deepEqual(
    vaccineSchedule.filter((v) => v.optional).map((v) => v.key),
    ["je"],
  );
  assert.equal(vaccineSchedule.find((v) => v.key === "ipv2").month, 9);
  assert.equal(vaccineSchedule.find((v) => v.key === "pcv2").month, 3);
  assert.deepEqual(vaccineDates("2025-01-31", { month: 1 }), {
    due_date: "2025-02-28",
    window_start: "2025-02-28",
    window_end: "2025-03-30",
  });
  assert.equal(
    weekRange("2025-01-01", "2025-02-01", "2025-02-28"),
    "4–8 minggu",
  );
});
test("reminders respect WIB, advance threshold, disabled and completed events", () => {
  const e = {
    status: "planned",
    due_date: "2026-09-10",
    due_time: "10:00:00",
    reminder_days: 1,
  };
  assert.equal(reminderPhase(e, new Date("2026-09-09T02:59:59Z")), null);
  assert.equal(reminderPhase(e, new Date("2026-09-09T03:00:00Z")), "advance");
  assert.equal(reminderPhase(e, new Date("2026-09-09T17:00:00Z")), "today");
  assert.equal(reminderPhase(e, new Date("2026-09-10T17:00:00Z")), null);
  for (const change of [
    { status: "done" },
    { status: "cancelled" },
    { reminder_days: null },
    { reminder_days: 0 },
  ])
    assert.equal(
      reminderPhase({ ...e, ...change }, new Date("2026-09-09T04:00:00Z")),
      null,
    );
});
test("ICS preserves timezone, alarms, safe text and UTF8 line folding", () => {
  const e = {
    id: "fixture",
    status: "planned",
    due_date: "2026-09-10",
    due_time: "10:00:00",
    reminder_days: 3,
    title: "Kontrol",
    notes: "Memo; satu, dua\n" + "👶".repeat(50),
  };
  const ics = calendarICS(
    [
      e,
      { ...e, id: "excluded", status: "done" },
      { ...e, id: "all-day", due_time: null },
    ],
    { name: "Anak" },
  );
  const unfolded = ics.replaceAll("\r\n ", "");
  assert.match(ics, /DTSTART:20260910T030000Z/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260910/);
  assert.match(ics, /DTEND;VALUE=DATE:20260911/);
  assert.match(ics, /TRIGGER:-P3D/);
  assert.ok(unfolded.includes("Memo\\; satu\\, dua\\n"));
  assert.ok(!ics.includes("excluded"));
  assert.ok(ics.split("\r\n").every((line) => Buffer.byteLength(line) <= 73));
});
test(
  "calendar persists, isolates accounts, imports visits, deduplicates reminders and reschedules",
  { skip: process.env.TEST_MYSQL !== "true" },
  async () => {
    process.env.DEMO_MODE = "false";
    const { app, closeDatabase } = await import("./index.js");
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = `http://127.0.0.1:${server.address().port}/api`;
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
      for (const name of ["Calendar A", "Calendar B"]) {
        const a = await api("/register", {
          name,
          email: `calendar-${randomUUID()}@example.test`,
          password: randomUUID(),
        });
        assert.equal(a.status, 201);
        users.push(a.data.user.id);
        accounts.push(a);
      }
      const [a, b] = accounts;
      const child = await api(
        "/children",
        { name: "Calendar child", dob: "2020-01-31", sex: "female" },
        a.cookie,
      );
      assert.equal(child.status, 201);
      const p = `/children/${child.data.id}/calendar`,
        today = jakartaDate();
      assert.equal((await api(p)).status, 401);
      assert.equal((await api(p, undefined, b.cookie)).status, 404);
      for (let i = 0; i < 2; i++)
        assert.equal((await api(p, undefined, a.cookie)).data.items.length, 20);
      const visit = await api(
        `/children/${child.data.id}/records`,
        {
          kind: "visit",
          date: addDays(today, 30),
          title: "Legacy visit",
          notes: "Imported",
        },
        a.cookie,
      );
      assert.equal(visit.status, 201);
      const legacy = (await api(p, undefined, a.cookie)).data.items.find(
        (e) => e.source_record_id === visit.data.id,
      );
      assert.ok(legacy);
      await api(p + "/" + legacy.id, {}, a.cookie, "DELETE");
      assert.equal((await api(p, undefined, a.cookie)).data.items.length, 21);
      assert.equal((await api(p, { vaccine_key: "je" }, a.cookie)).status, 201);
      assert.equal((await api(p, { vaccine_key: "je" }, a.cookie)).status, 409);
      const body = {
        kind: "doctor",
        title: "Kontrol dokter",
        due_date: today,
        due_time: "10:00",
        reminder_days: 1,
        notes: "Memo",
      };
      for (const invalid of [
        { due_date: "2026-02-30" },
        { due_time: "25:00" },
        { reminder_days: false },
        { status: "done", completed_date: "2099-01-01" },
      ])
        assert.equal(
          (await api(p, { ...body, ...invalid }, a.cookie)).status,
          400,
        );
      const created = await api(p, body, a.cookie);
      assert.equal(created.status, 201);
      const ep = p + "/" + created.data.id;
      assert.equal((await api(ep, body, b.cookie, "PUT")).status, 404);
      assert.equal((await api(ep, {}, b.cookie, "DELETE")).status, 404);
      for (let i = 0; i < 3; i++)
        await api("/notifications", undefined, a.cookie);
      let notices = (await api("/notifications", undefined, a.cookie)).data;
      assert.equal(
        notices.items.filter((n) => n.event_id === created.data.id).length,
        1,
      );
      const n = notices.items.find((n) => n.event_id === created.data.id);
      assert.equal(
        (await api("/notifications/" + n.id + "/read", {}, b.cookie, "PUT"))
          .status,
        404,
      );
      assert.equal(
        (await api("/notifications/" + n.id + "/read", {}, a.cookie, "PUT"))
          .status,
        200,
      );
      await api(ep, { ...body, notes: "Updated memo" }, a.cookie, "PUT");
      notices = (await api("/notifications", undefined, a.cookie)).data;
      assert.ok(notices.items.find((x) => x.id === n.id).read_at);
      await api(ep, { ...body, due_date: addDays(today, 30) }, a.cookie, "PUT");
      assert.equal(
        (await api("/notifications", undefined, a.cookie)).data.items.filter(
          (n) => n.event_id === created.data.id,
        ).length,
        0,
      );
      await api(
        ep,
        { ...body, status: "done", completed_date: today },
        a.cookie,
        "PUT",
      );
      const saved = (await api(p, undefined, a.cookie)).data.items.find(
        (e) => e.id === created.data.id,
      );
      assert.equal(saved.status, "done");
      assert.equal(saved.completed_date, today);
      assert.equal(
        (await api("/notifications", undefined, b.cookie)).data.total,
        0,
      );
    } finally {
      for (const id of users)
        await db.execute("DELETE FROM users WHERE id=?", [id]);
      await db.end();
      await new Promise((r) => server.close(r));
      await closeDatabase();
    }
  },
);
