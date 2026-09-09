import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  vaccineSchedule,
  vaccineDates,
  reminderPhase,
  jakartaDate,
  addDays,
} from "../shared/calendar.js";
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const text = (v, max, required = false) => {
  if (v == null && !required) return "";
  if (typeof v !== "string" || v.trim().length > max || (required && !v.trim()))
    throw fail("Isian tidak valid atau terlalu panjang.");
  return v.trim();
};
export function childCalendar({
  query,
  transaction,
  demo,
  owned,
  validDate,
  notifyUser,
  getDemoVisits = () => [],
  now = () => new Date(),
}) {
  const router = Router({ mergeParams: true }),
    memory = new Map();
  let running = false;
  function vaccineEvent(child, v) {
    return {
      id: randomUUID(),
      child_id: child.id,
      vaccine_key: v.key,
      is_scheduled: 0,
      source_record_id: null,
      kind: "vaccine",
      title: v.title,
      ...vaccineDates(child.dob, v),
      due_time: null,
      location: "",
      doctor: "",
      notes:
        v.month === 0
          ? "HB 0 diberikan dalam 24 jam pertama setelah lahir. Konfirmasi waktu lahir dan pemberian dengan petugas."
          : "Jadwal acuan program rutin; konfirmasi riwayat dosis dan jadwal dengan fasilitas kesehatan.",
      status: "planned",
      completed_date: null,
      reminder_days: 7,
    };
  }
  async function insert(event, q = query) {
    const keys = [
      "id",
      "child_id",
      "vaccine_key",
      "is_scheduled",
      "source_record_id",
      "kind",
      "title",
      "due_date",
      "due_time",
      "window_start",
      "window_end",
      "location",
      "doctor",
      "notes",
      "status",
      "completed_date",
      "reminder_days",
    ];
    return q(
      `INSERT IGNORE INTO calendar_events(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
      keys.map((k) => event[k] ?? null),
    );
  }
  async function importVisit(r) {
    const event = {
      id: randomUUID(),
      child_id: r.child_id,
      source_record_id: r.id,
      kind: "doctor",
      is_scheduled: 1,
      title: r.title,
      due_date: r.date,
      due_time: null,
      location: "",
      doctor: "",
      notes: r.notes || "",
      status: "planned",
      reminder_days: 1,
    };
    if (demo) {
      const items = memory.get(r.child_id);
      if (items && !items.some((e) => e.source_record_id === r.id))
        items.push(event);
    } else await insert(event);
  }
  async function ensure(child) {
    if (demo) {
      if (!memory.has(child.id))
        memory.set(
          child.id,
          vaccineSchedule
            .filter((v) => !v.optional)
            .map((v) => vaccineEvent(child, v)),
        );
      for (const r of getDemoVisits().filter(
        (r) => r.child_id === child.id && r.kind === "visit",
      ))
        await importVisit(r);
      return;
    }
    if (
      !(
        await query("SELECT child_id FROM calendar_seeded WHERE child_id=?", [
          child.id,
        ])
      ).length
    ) {
      await transaction(async (q) => {
        // Lock the parent before inserting children; competing seeds/deletes serialize.
        const parent = await q(
          "SELECT id FROM children WHERE id=? FOR UPDATE",
          [child.id],
        );
        if (!parent.length) return;
        if (
          (
            await q("SELECT child_id FROM calendar_seeded WHERE child_id=?", [
              child.id,
            ])
          ).length
        )
          return;
        for (const v of vaccineSchedule.filter((v) => !v.optional))
          await insert(vaccineEvent(child, v), q);
        await q("INSERT IGNORE INTO calendar_seeded(child_id) VALUES(?)", [
          child.id,
        ]);
      });
    }
    const visits = await query(
      "SELECT r.* FROM records r WHERE r.child_id=? AND r.kind='visit' AND NOT EXISTS(SELECT 1 FROM calendar_events e WHERE e.source_record_id=r.id)",
      [child.id],
    );
    for (const r of visits) await importVisit(r);
  }
  async function getEvent(req) {
    await owned(req.params.id, req.user);
    const e = demo
      ? memory.get(req.params.id)?.find((e) => e.id === req.params.eventId)
      : (
          await query(
            "SELECT * FROM calendar_events WHERE id=? AND child_id=?",
            [req.params.eventId, req.params.id],
          )
        )[0];
    if (!e) throw fail("Jadwal tidak ditemukan.", 404);
    return e;
  }
  function validate(body, child) {
    const due_date = validDate(body.due_date),
      due_time = body.due_time || null;
    if (due_date < child.dob)
      throw fail("Tanggal jadwal tidak boleh sebelum kelahiran.");
    if (
      due_time &&
      (typeof due_time !== "string" ||
        !/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(due_time))
    )
      throw fail("Jam jadwal tidak valid.");
    const status = body.status ?? "planned";
    if (!["planned", "done", "cancelled"].includes(status))
      throw fail("Status jadwal tidak valid.");
    if (
      body.reminder_days !== undefined &&
      body.reminder_days !== null &&
      typeof body.reminder_days !== "number"
    )
      throw fail("Pilihan pengingat tidak valid.");
    const reminder_days =
      body.reminder_days === undefined ? 1 : body.reminder_days;
    if (reminder_days !== null && ![0, 1, 3, 7].includes(reminder_days))
      throw fail("Pilihan pengingat tidak valid.");
    const completed_date =
      status === "done" ? validDate(body.completed_date) : null;
    if (
      completed_date &&
      (completed_date < child.dob || completed_date > jakartaDate(now()))
    )
      throw fail("Tanggal selesai harus antara tanggal lahir dan hari ini.");
    return {
      title: text(body.title, 160, true),
      due_date,
      due_time: due_time ? due_time.slice(0, 5) + ":00" : null,
      location: text(body.location, 160),
      doctor: text(body.doctor, 120),
      notes: text(body.notes, 2000),
      status,
      completed_date,
      reminder_days,
    };
  }
  async function clearReminders(eventId) {
    if (!demo)
      await query("DELETE FROM calendar_reminders WHERE event_id=?", [eventId]);
  }
  async function processReminders() {
    if (demo || running) return;
    running = true;
    try {
      const current = now(),
        today = jakartaDate(current);
      const candidates = await query(
        "SELECT e.*,c.user_id FROM calendar_events e JOIN children c ON c.id=e.child_id WHERE e.status='planned' AND e.reminder_days IS NOT NULL AND e.due_date BETWEEN ? AND ?",
        [today, addDays(today, 7)],
      );
      const changed = new Set();
      for (const e of candidates) {
        const phase = reminderPhase(e, current);
        if (!phase) continue;
        // Recheck current row in INSERT to avoid emitting after concurrent completion/reschedule.
        const result = await query(
          "INSERT IGNORE INTO calendar_reminders(id,event_id,phase) SELECT ?,id,? FROM calendar_events WHERE id=? AND status='planned' AND due_date=? AND reminder_days=? AND due_time <=> ? AND (vaccine_key IS NULL OR is_scheduled=1)",
          [randomUUID(), phase, e.id, e.due_date, e.reminder_days, e.due_time],
        );
        if (result.affectedRows) changed.add(e.user_id);
      }
      await Promise.all([...changed].map(notifyUser));
    } finally {
      running = false;
    }
  }
  async function sweepOnce() {
    if (demo) return;
    const children = await query(
      "SELECT c.* FROM children c LEFT JOIN calendar_seeded s ON s.child_id=c.id WHERE s.child_id IS NULL LIMIT 100",
    );
    for (const c of children) await ensure(c);
    const visits = await query(
      "SELECT r.* FROM records r WHERE r.kind='visit' AND NOT EXISTS(SELECT 1 FROM calendar_events e WHERE e.source_record_id=r.id) LIMIT 100",
    );
    for (const r of visits) await importVisit(r);
    await processReminders();
  }
  let sweepPending;
  function sweep() {
    if (!sweepPending) {
      sweepPending = (async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await sweepOnce();
          } catch (error) {
            if (error.code !== "ER_LOCK_DEADLOCK" || attempt === 2) throw error;
          }
        }
      })().finally(() => {
        sweepPending = null;
      });
    }
    return sweepPending;
  }
  router.get("/", async (req, res) => {
    const child = await owned(req.params.id, req.user);
    await ensure(child);
    await processReminders();
    res.json({
      items: demo
        ? memory.get(child.id)
        : await query(
            "SELECT * FROM calendar_events WHERE child_id=? ORDER BY due_date,due_time,title",
            [child.id],
          ),
      sourceVersion: "Kemenkes program rutin bayi/baduta; diakses 9 Sep 2026",
    });
  });
  router.post("/", async (req, res) => {
    const child = await owned(req.params.id, req.user);
    await ensure(child);
    let e;
    if (req.body.vaccine_key) {
      const v = vaccineSchedule.find(
        (v) => v.key === req.body.vaccine_key && v.optional,
      );
      if (!v) throw fail("Vaksin pilihan tidak tersedia.");
      e = vaccineEvent(child, v);
    } else {
      if (!["doctor", "vaccine"].includes(req.body.kind))
        throw fail("Jenis jadwal tidak valid.");
      e = {
        id: randomUUID(),
        child_id: child.id,
        kind: req.body.kind,
        is_scheduled: 1,
        ...validate(req.body, child),
      };
    }
    if (demo) {
      if (
        e.vaccine_key &&
        memory.get(child.id).some((x) => x.vaccine_key === e.vaccine_key)
      )
        throw fail("Vaksin sudah ada di kalender.", 409);
      memory.get(child.id).push(e);
    } else {
      if (
        e.vaccine_key &&
        (
          await query(
            "SELECT id FROM calendar_events WHERE child_id=? AND vaccine_key=?",
            [child.id, e.vaccine_key],
          )
        ).length
      )
        throw fail("Vaksin sudah ada di kalender.", 409);
      const inserted = await insert(e);
      if (!inserted.affectedRows)
        throw fail("Vaksin sudah ada di kalender.", 409);
    }
    await processReminders();
    res.status(201).json(e);
  });
  router.put("/:eventId", async (req, res) => {
    const old = await getEvent(req),
      child = await owned(req.params.id, req.user),
      changes = validate(req.body, child);
    if (
      req.body.is_scheduled != null &&
      ![true, false, 0, 1].includes(req.body.is_scheduled)
    )
      throw fail("Pilihan rencana tidak valid.");
    changes.is_scheduled = old.vaccine_key
      ? Number(req.body.is_scheduled ?? 1)
      : 1;
    if (
      old.vaccine_key &&
      !changes.is_scheduled &&
      changes.status === "planned"
    ) {
      changes.due_date = old.window_start;
      changes.due_time = null;
    }
    const e = { ...old, ...changes };
    if (demo) {
      Object.assign(old, changes);
    } else
      await transaction(async (q) => {
        const keys = Object.keys(changes);
        await q(
          `UPDATE calendar_events SET ${keys.map((k) => k + "=?").join(",")} WHERE id=? AND child_id=?`,
          [...Object.values(changes), old.id, child.id],
        );
        if (
          changes.status !== "planned" ||
          ["due_date", "due_time", "reminder_days", "is_scheduled"].some(
            (key) => changes[key] !== old[key],
          )
        )
          await q("DELETE FROM calendar_reminders WHERE event_id=?", [old.id]);
      });
    await processReminders();
    await notifyUser(req.user.id);
    res.json(e);
  });
  router.delete("/:eventId", async (req, res) => {
    const e = await getEvent(req);
    if (demo) e.status = "cancelled";
    else
      await transaction(async (q) => {
        await q(
          "UPDATE calendar_events SET status='cancelled' WHERE id=? AND child_id=?",
          [e.id, req.params.id],
        );
        await q("DELETE FROM calendar_reminders WHERE event_id=?", [e.id]);
      });
    await notifyUser(req.user.id);
    res.json({ ok: true });
  });
  async function rebase(child, q = query) {
    const items = demo
      ? memory.get(child.id) || []
      : await q("SELECT * FROM calendar_events WHERE child_id=? FOR UPDATE", [
          child.id,
        ]);
    const changes = items.map((e) => {
      const v = vaccineSchedule.find((v) => v.key === e.vaccine_key);
      const dates = v ? vaccineDates(child.dob, v) : {};
      const automatic = v && e.status === "planned" && !Number(e.is_scheduled);
      const due = automatic ? dates.due_date : e.due_date;
      if (
        (e.completed_date && e.completed_date < child.dob) ||
        (e.status !== "cancelled" && due < child.dob)
      )
        throw fail(
          "Tanggal lahir melewati catatan kalender. Periksa tanggal jadwal atau pelaksanaan terlebih dahulu.",
        );
      return { e, v, dates, due };
    });
    for (const { e, v, dates, due } of changes) {
      if (!v) continue;
      if (demo) Object.assign(e, dates, { due_date: due });
      else {
        await q(
          "UPDATE calendar_events SET due_date=?,window_start=?,window_end=? WHERE id=?",
          [due, dates.window_start, dates.window_end, e.id],
        );
        if (due !== e.due_date)
          await q("DELETE FROM calendar_reminders WHERE event_id=?", [e.id]);
      }
    }
  }
  return {
    rebase,
    router,
    drain: async () => {
      if (sweepPending) await sweepPending;
    },
    sweep,
    processReminders,
    ensure,
    importVisit,
    clear: (childId) => memory.delete(childId),
    clearReminders,
  };
}
