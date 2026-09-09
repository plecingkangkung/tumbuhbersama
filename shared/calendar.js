export const vaccineSource =
  "https://ayosehat.kemkes.go.id/1000-hari-pertama-kehidupan/seputar-imunisasi";
export const vaccineSchedule = [
  ["hb0", "Hepatitis B (HB 0)", 0],
  ["bcg", "BCG", 1],
  ["opv1", "Polio tetes 1 (bOPV)", 1],
  ["dpt1", "DPT-HB-Hib 1", 2],
  ["opv2", "Polio tetes 2 (bOPV)", 2],
  ["pcv1", "PCV 1", 2],
  ["rv1", "Rotavirus 1", 2],
  ["dpt2", "DPT-HB-Hib 2", 3],
  ["opv3", "Polio tetes 3 (bOPV)", 3],
  ["pcv2", "PCV 2", 3],
  ["rv2", "Rotavirus 2", 3],
  ["dpt3", "DPT-HB-Hib 3", 4],
  ["opv4", "Polio tetes 4 (bOPV)", 4],
  ["ipv1", "Polio suntik 1 (IPV)", 4],
  ["rv3", "Rotavirus 3", 4],
  ["mr1", "Campak Rubela 1", 9],
  ["ipv2", "Polio suntik 2 (IPV)", 9],
  ["je", "Japanese Encephalitis (wilayah endemis)", 10, true],
  ["pcv3", "PCV 3", 12],
  ["dpt4", "DPT-HB-Hib 4 (lanjutan)", 18],
  ["mr2", "Campak Rubela 2 (lanjutan)", 18],
].map(([key, title, month, optional = false]) => ({
  key,
  title,
  month,
  optional,
}));
export function addDays(date, days) {
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function addMonths(date, months) {
  const [y, m, d] = date.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}
export function vaccineDates(dob, vaccine) {
  const start = addMonths(dob, vaccine.month),
    end =
      vaccine.month === 0
        ? addDays(dob, 1)
        : addDays(addMonths(dob, vaccine.month + 1), -1);
  return { due_date: start, window_start: start, window_end: end };
}
export function weekRange(dob, start, end) {
  const days = (d) =>
    Math.round(
      (Date.parse(d + "T00:00:00Z") - Date.parse(dob + "T00:00:00Z")) /
        86400000,
    );
  return `${Math.floor(days(start) / 7)}–${Math.floor(days(end) / 7)} minggu`;
}
export function jakartaDate(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}
export function reminderPhase(event, now = new Date()) {
  if (event.status !== "planned" || event.reminder_days == null) return null;
  const today = jakartaDate(now);
  if (event.due_date === today) return "today";
  const at = Date.parse(
    `${event.due_date}T${event.due_time || "09:00:00"}+07:00`,
  );
  return today < event.due_date &&
    now.getTime() >= at - Number(event.reminder_days) * 86400000
    ? "advance"
    : null;
}
const escapeICS = (s) =>
  String(s ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\r", "");
export function calendarICS(events, child) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TumbuhBersama//Kalender Anak//ID",
    "CALSCALE:GREGORIAN",
  ];
  for (const e of events.filter((e) => e.status === "planned")) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@tumbuhbersama`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")}`,
    );
    if (e.due_time) {
      const start = new Date(`${e.due_date}T${e.due_time}+07:00`);
      lines.push(
        `DTSTART:${start
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, "")}`,
        `DTEND:${new Date(start.getTime() + 3600000)
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, "")}`,
      );
    } else
      lines.push(
        `DTSTART;VALUE=DATE:${e.due_date.replaceAll("-", "")}`,
        `DTEND;VALUE=DATE:${addDays(e.due_date, 1).replaceAll("-", "")}`,
      );
    lines.push(
      `SUMMARY:${escapeICS(child.name + " · " + e.title)}`,
      `LOCATION:${escapeICS(e.location)}`,
      `DESCRIPTION:${escapeICS([e.doctor, e.notes].filter(Boolean).join("\n"))}`,
    );
    if (e.reminder_days != null)
      lines.push(
        "BEGIN:VALARM",
        `TRIGGER:-P${e.reminder_days}D`,
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeICS(e.title)}`,
        "END:VALARM",
      );
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // Fold at <= 73 UTF-8 bytes, without splitting a code point.
  return (
    lines
      .map((line) => {
        let parts = [],
          part = "",
          bytes = 0;
        for (const char of line) {
          const size = new TextEncoder().encode(char).length;
          if (bytes + size > 73) {
            parts.push(part);
            part = " ";
            bytes = 1;
          }
          part += char;
          bytes += size;
        }
        parts.push(part);
        return parts.join("\r\n");
      })
      .join("\r\n") + "\r\n"
  );
}
