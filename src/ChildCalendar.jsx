import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  Pencil,
  Bell,
  Syringe,
  Stethoscope,
} from "lucide-react";
import Select from "./Select";
import {
  isVaccineReference,
  referencesOnDate,
  vaccinePlanningWindow,
  addDays,
  addMonths,
  jakartaDate,
  weekRange,
  vaccineSource,
  calendarICS,
} from "../shared/calendar.js";
const dateLabel = (s) =>
  new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const monthLabel = (s) =>
  new Date(s + "-01T00:00:00Z").toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
async function api(childId, path = "", options = {}) {
  const r = await fetch(`/api/children/${childId}/calendar${path}`, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Kalender belum dapat dimuat.");
  return d;
}
function EventForm({ event, child, date, busy, onSave, onCancel }) {
  const [status, setStatus] = useState(event?.status || "planned");
  const [scheduled, setScheduled] = useState(!isVaccineReference(event || {}));
  return (
    <form
      className="calendar-editor"
      onSubmit={(e) => {
        e.preventDefault();
        const body = Object.fromEntries(new FormData(e.currentTarget));
        onSave({
          ...body,
          due_date: body.due_date || event?.window_start || date,
          is_scheduled: scheduled,
          kind: event?.kind || body.kind,
          reminder_days:
            body.reminder_days === "off" ? null : Number(body.reminder_days),
        });
      }}
    >
      <h3>{event ? "Ubah jadwal" : "Tambah janji / jadwal"}</h3>
      {event?.vaccine_key && (
        <label className="field">
          <span>Rencana vaksin</span>
          <Select
            value={scheduled ? "fixed" : "reference"}
            onChange={(e) => setScheduled(e.target.value === "fixed")}
          >
            <option value="reference">Acuan minggu · belum ada janji</option>
            <option value="fixed">Sudah menentukan tanggal</option>
          </Select>
        </label>
      )}
      {!scheduled && (
        <p className="fine">
          Acuan usia ditampilkan sebagai blok minggu. Pilih tanggal setelah
          jadwal dengan faskes ditentukan. Pengingat janji belum aktif.
        </p>
      )}
      <div className="calendar-form-grid">
        <label className="field">
          <span>Jenis</span>
          <Select
            name="kind"
            defaultValue={event?.kind || "doctor"}
            disabled={Boolean(event)}
            aria-label="Jenis jadwal"
          >
            <option value="doctor">Janji dokter / kunjungan</option>
            <option value="vaccine">Vaksin tambahan sesuai arahan</option>
          </Select>
        </label>
        <label className="field">
          <span>Judul</span>
          <input
            name="title"
            required
            maxLength={160}
            defaultValue={event?.title || ""}
            placeholder="Kontrol dengan dokter anak"
          />
        </label>
        <label className="field">
          <span>
            {scheduled ? "Tanggal janji" : "Awal periode acuan (bukan janji)"}
          </span>
          <input
            disabled={!scheduled}
            name="due_date"
            type="date"
            required
            min={child.dob}
            defaultValue={event?.due_date || date}
          />
        </label>
        <label className="field">
          <span>Jam (WIB, boleh kosong)</span>
          <input
            disabled={!scheduled}
            name="due_time"
            type="time"
            defaultValue={event?.due_time?.slice(0, 5) || ""}
          />
        </label>
        <label className="field">
          <span>Dokter / petugas</span>
          <input
            name="doctor"
            maxLength={120}
            defaultValue={event?.doctor || ""}
            placeholder="Nama dokter atau petugas"
          />
        </label>
        <label className="field">
          <span>Lokasi</span>
          <input
            name="location"
            maxLength={160}
            defaultValue={event?.location || ""}
            placeholder="Klinik, rumah sakit, atau posyandu"
          />
        </label>
        <label className="field">
          <span>Pengingat</span>
          <Select
            name="reminder_days"
            defaultValue={
              event?.reminder_days === null
                ? "off"
                : String(event?.reminder_days ?? 1)
            }
            aria-label="Waktu pengingat"
          >
            <option value="1">H-1 dan hari jadwal</option>
            <option value="3">H-3 dan hari jadwal</option>
            <option value="7">H-7 dan hari jadwal</option>
            <option value="0">Hari jadwal saja</option>
            <option value="off">Tanpa pengingat</option>
          </Select>
        </label>
        <label className="field">
          <span>Status</span>
          <Select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Status jadwal"
          >
            <option value="planned">Direncanakan / belum dicatat</option>
            <option value="done">Sudah selesai / diberikan</option>
            <option value="cancelled">Dibatalkan / tidak digunakan</option>
          </Select>
        </label>
        {status === "done" && (
          <label className="field">
            <span>Tanggal selesai / vaksin diberikan</span>
            <input
              name="completed_date"
              type="date"
              required
              min={child.dob}
              max={jakartaDate()}
              defaultValue={event?.completed_date || jakartaDate()}
            />
          </label>
        )}
      </div>
      <label className="field">
        <span>Memo</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={event?.notes || ""}
          placeholder="Keluhan yang ingin ditanyakan, dokumen yang dibawa, atau arahan petugas"
        />
      </label>
      {event?.vaccine_key && (
        <p className="fine">
          Mengubah tanggal ini tidak menghitung jadwal imunisasi kejar atau
          menggeser dosis lainnya. Ikuti arahan fasilitas kesehatan.
        </p>
      )}
      <div className="forum-actions">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Batal
        </button>
        <button className="primary" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan jadwal"}
        </button>
      </div>
    </form>
  );
}
export default function ChildCalendar({
  child,
  compact = false,
  onOpen,
  target,
}) {
  const [events, setEvents] = useState([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false),
    [editor, setEditor] = useState(null),
    [view, setView] = useState("month"),
    [kind, setKind] = useState("all"),
    [status, setStatus] = useState("active");
  const [selected, setSelected] = useState(target?.due_date || jakartaDate()),
    [month, setMonth] = useState(
      (target?.due_date || jakartaDate()).slice(0, 7),
    );
  const pending = useRef(false),
    formRef = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    api(child.id, "", { signal: controller.signal })
      .then((d) => {
        setEvents(d.items);
        setLoaded(true);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [child.id, retry]);
  const today = jakartaDate(),
    upcoming = events
      .filter(
        (e) =>
          e.status === "planned" &&
          !isVaccineReference(e) &&
          e.due_date >= today,
      )
      .sort((a, b) =>
        (a.due_date + (a.due_time || "")).localeCompare(
          b.due_date + (b.due_time || ""),
        ),
      );
  const near = upcoming.filter((e) => e.due_date <= addDays(today, 7)),
    late = events.filter(
      (e) =>
        e.status === "planned" && !isVaccineReference(e) && e.due_date < today,
    );
  function edit(e) {
    setEditor(e);
    setError("");
    setNotice("");
    setTimeout(
      () =>
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  }
  async function mutate(path, body, method = "POST") {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await api(child.id, path, { method, body: JSON.stringify(body) });
      const data = await api(child.id);
      setEvents(data.items);
      setEditor(null);
      setNotice("Kalender berhasil diperbarui.");
    } catch (e) {
      setError(e.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function exportCalendar() {
    const blob = new Blob([calendarICS(events, child)], {
        type: "text/calendar;charset=utf-8",
      }),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "kalender-anak.ics";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (compact)
    return (
      <section className="card">
        <div className="section-heading">
          <h2>Kalender si kecil</h2>
          <CalendarDays size={21} />
        </div>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : !loaded ? (
          <p className="fine">Memuat jadwal…</p>
        ) : (
          upcoming.slice(0, 3).map((e) => (
            <div className="visit-item" key={e.id}>
              <CalendarDays size={18} />
              <div>
                <span className="fine">{dateLabel(e.due_date)}</span>
                <h3>{e.title}</h3>
              </div>
            </div>
          ))
        )}
        {loaded && !upcoming.length && (
          <p className="fine">Belum ada jadwal mendatang.</p>
        )}
        <button className="text-button" onClick={onOpen}>
          Buka kalender & janji dokter
        </button>
      </section>
    );
  const visible = events.filter(
    (e) =>
      (kind === "all" || e.kind === kind) &&
      (status === "all" ||
        (status === "active" ? e.status === "planned" : e.status === status)),
  );
  const first = month + "-01",
    offset = (new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7,
    gridStart = addDays(first, -offset);
  const dayEvents = visible.filter(
    (e) => !isVaccineReference(e) && e.due_date === selected,
  );
  const dayReferences = referencesOnDate(visible, selected);
  const eventCard = (e) => (
    <article
      key={e.id}
      className={`calendar-event ${e.status} ${e.id === target?.event_id ? "is-target" : ""}`}
    >
      <span className={`calendar-event-icon ${e.kind}`}>
        {e.kind === "vaccine" ? (
          <Syringe size={18} />
        ) : (
          <Stethoscope size={18} />
        )}
      </span>
      <div className="calendar-event-content">
        <span className="fine">
          {isVaccineReference(e)
            ? "Acuan minggu · tanggal janji belum ditentukan"
            : dateLabel(e.due_date) +
              (e.due_time
                ? " · " + e.due_time.slice(0, 5) + " WIB"
                : " · Jam belum ditentukan")}
        </span>
        <h3>{e.title}</h3>
        {e.window_start && (
          <p className="fine">
            Usia acuan{" "}
            {weekRange(
              child.dob,
              vaccinePlanningWindow(e).start,
              vaccinePlanningWindow(e).end,
            )}{" "}
            · {dateLabel(vaccinePlanningWindow(e).start)}–
            {dateLabel(vaccinePlanningWindow(e).end)}
          </p>
        )}
        {(e.doctor || e.location) && (
          <p className="fine">
            {[e.doctor, e.location].filter(Boolean).join(" · ")}
          </p>
        )}
        {e.notes && <p className="calendar-memo">{e.notes}</p>}
        <span className="calendar-status">
          {e.status === "done"
            ? `Selesai ${e.completed_date || ""}`
            : e.status === "cancelled"
              ? "Dibatalkan / tidak digunakan"
              : isVaccineReference(e)
                ? "Rencana vaksin · belum dijadwalkan"
                : e.due_date < today
                  ? "Lewat target · belum dicatat"
                  : e.due_date === today
                    ? "Hari ini"
                    : "Mendatang"}
        </span>
        {e.status === "planned" &&
          !isVaccineReference(e) &&
          e.reminder_days != null && (
            <span className="fine">
              {" "}
              · <Bell size={12} />{" "}
              {e.reminder_days
                ? `H-${e.reminder_days} + hari jadwal`
                : "Hari jadwal"}
            </span>
          )}
      </div>
      <div className="calendar-event-actions">
        <button
          className="icon-button"
          aria-label={"Ubah " + e.title}
          disabled={busy}
          onClick={() =>
            edit(isVaccineReference(e) ? { ...e, is_scheduled: 1 } : e)
          }
        >
          <Pencil size={16} />
          {isVaccineReference(e) && <span>Tentukan tanggal</span>}
        </button>
        {e.status === "planned" && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => edit({ ...e, status: "done" })}
          >
            Catat selesai
          </button>
        )}
        {e.status === "planned" && (
          <button
            className="text-button calendar-cancel"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm("Batalkan jadwal ini dan hentikan pengingatnya?")
              )
                mutate("/" + e.id, {}, "DELETE");
            }}
          >
            Batalkan
          </button>
        )}
      </div>
    </article>
  );
  return (
    <section className="card child-calendar">
      <div className="section-heading">
        <div>
          <h2>Kalender {child.name}</h2>
          <p className="fine">
            Jadwal imunisasi, janji dokter, dan memo keluarga · WIB
          </p>
        </div>
        <div className="calendar-header-actions">
          <button
            className="secondary"
            disabled={!loaded}
            onClick={exportCalendar}
          >
            <Download size={16} /> Ekspor .ics
          </button>
          <button
            className="primary"
            disabled={!loaded || busy}
            onClick={() => edit({ id: null })}
          >
            <Plus size={16} /> Tambah janji
          </button>
        </div>
      </div>
      {near.length > 0 && (
        <div className="calendar-alert" role="status">
          <Bell size={18} />
          <span>
            <strong>{near.length} jadwal dalam 7 hari ke depan.</strong>{" "}
            Terdekat: {upcoming[0].title}, {dateLabel(upcoming[0].due_date)}.
          </span>
        </div>
      )}
      {late.length > 0 && (
        <p className="calendar-guidance">
          {late.length} jadwal telah melewati tanggal target dan belum dicatat
          selesai. Lengkapi riwayat; untuk vaksin yang tertunda, konsultasikan
          jadwal kejar dengan petugas.
        </p>
      )}
      <div className="calendar-tabs">
        <button
          className={view === "month" ? "active" : ""}
          onClick={() => setView("month")}
        >
          Kalender bulanan
        </button>
        <button
          className={view === "vaccine" ? "active" : ""}
          onClick={() => setView("vaccine")}
        >
          Jadwal vaksin
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}{" "}
          <button
            className="text-button"
            onClick={() => setRetry((n) => n + 1)}
          >
            Muat ulang
          </button>
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <div ref={formRef}>
        {editor && (
          <EventForm
            key={(editor.id || "new") + "-" + (editor.status || "planned")}
            event={editor.id ? editor : null}
            child={child}
            date={selected}
            busy={busy}
            onCancel={() => setEditor(null)}
            onSave={(body) =>
              mutate(
                editor.id ? "/" + editor.id : "",
                body,
                editor.id ? "PUT" : "POST",
              )
            }
          />
        )}
      </div>
      {!loaded ? (
        <p className="empty">Memuat kalender…</p>
      ) : view === "month" ? (
        <>
          <div className="calendar-toolbar">
            <div className="calendar-month-nav">
              <button
                className="icon-button"
                aria-label="Bulan sebelumnya"
                onClick={() => setMonth(addMonths(first, -1).slice(0, 7))}
              >
                <ChevronLeft size={19} />
              </button>
              <h3>{monthLabel(month)}</h3>
              <button
                className="icon-button"
                aria-label="Bulan berikutnya"
                onClick={() => setMonth(addMonths(first, 1).slice(0, 7))}
              >
                <ChevronRight size={19} />
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setMonth(today.slice(0, 7));
                  setSelected(today);
                }}
              >
                Hari ini
              </button>
            </div>
            <div className="calendar-filters">
              <Select
                aria-label="Jenis jadwal kalender"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="all">Semua jenis</option>
                <option value="vaccine">Vaksin</option>
                <option value="doctor">Janji dokter</option>
              </Select>
              <Select
                aria-label="Status kalender"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="active">Belum selesai</option>
                <option value="done">Selesai</option>
                <option value="cancelled">Dibatalkan</option>
                <option value="all">Semua status</option>
              </Select>
            </div>
          </div>
          <div className="calendar-grid">
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
              <span className="calendar-weekday" key={d}>
                {d}
              </span>
            ))}
            {Array.from({ length: 42 }, (_, i) => {
              const day = addDays(gridStart, i),
                refs = referencesOnDate(visible, day),
                items = visible.filter(
                  (e) => !isVaccineReference(e) && e.due_date === day,
                );
              return (
                <button
                  type="button"
                  key={day}
                  className={`calendar-day ${day.slice(0, 7) !== month ? "outside" : ""} ${refs.length ? "vaccine-reference-day" : ""} ${day === selected ? "selected" : ""} ${day === today ? "today" : ""}`}
                  aria-label={
                    dateLabel(day) +
                    ", " +
                    items.length +
                    " janji" +
                    (refs.length
                      ? ", acuan: " + refs.map((e) => e.title).join(", ")
                      : "")
                  }
                  title={
                    refs.length
                      ? refs.map((e) => e.title).join(" · ")
                      : undefined
                  }
                  aria-pressed={day === selected}
                  onClick={() => {
                    setSelected(day);
                    setMonth(day.slice(0, 7));
                  }}
                >
                  <span>{Number(day.slice(-2))}</span>
                  {refs.length > 0 && (
                    <small className="vaccine-date-label">
                      <Syringe size={12} aria-hidden="true" />
                      {refs.some((e) => e.vaccine_key === "hb0")
                        ? "HB 0 · 24 jam"
                        : "Acuan vaksin"}
                    </small>
                  )}
                  {items.length > 0 && <small>{items.length} janji</small>}
                  <span className="calendar-dots">
                    {items.some((e) => e.kind === "vaccine") && (
                      <i className="vaccine" />
                    )}
                    {items.some((e) => e.kind === "doctor") && (
                      <i className="doctor" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span>● Janji vaksin</span>
            <span>▰ Acuan minggu · bukan janji pasti</span>
            <span>● Janji dokter</span>
          </div>
          {dayReferences.length > 0 && (
            <div className="calendar-week-references">
              <h3>Acuan vaksin pada tanggal yang dipilih</h3>
              <p className="fine">
                Tujuh tanggal berwarna adalah satu minggu perencanaan mulai
                tanggal acuan usia, bukan jaminan rentang aman pemberian.
                Konfirmasikan tanggal dengan faskes. HB 0 tetap dalam 24 jam
                pertama setelah lahir.
              </p>
              {dayReferences.map(eventCard)}
            </div>
          )}
          <h3 className="calendar-day-heading">Janji {dateLabel(selected)}</h3>
          {dayEvents.length ? (
            dayEvents.map(eventCard)
          ) : (
            <p className="empty">
              Belum ada janji bertanggal pasti pada hari ini.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="calendar-guidance">
            Acuan program rutin Kemenkes usia 0–18 bulan. Sorotan kalender
            dibatasi satu minggu mulai target usia. Rentang minggu adalah
            konversi periode bulan anjuran berdasarkan tanggal lahir, bukan
            batas aman pemberian atau janji yang sudah dipesan. HB 0: 24 jam
            pertama setelah lahir.
          </p>
          {events
            .filter((e) => e.kind === "vaccine")
            .sort((a, b) => a.due_date.localeCompare(b.due_date))
            .map(eventCard)}
          {!events.some((e) => e.vaccine_key === "je") && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => mutate("", { vaccine_key: "je" })}
            >
              Tambahkan JE jika dianjurkan untuk wilayah endemis
            </button>
          )}
          <p className="calendar-guidance">
            Vaksin heksavalen di wilayah pelaksana menggabungkan beberapa
            antigen; sesuaikan daftar bersama faskes agar tidak menghitung
            suntikan ganda. Vaksin tambahan dan imunisasi kejar memerlukan
            penyesuaian berdasarkan riwayat serta produk yang digunakan.
          </p>
          <a
            className="text-button"
            href={vaccineSource}
            target="_blank"
            rel="noreferrer"
          >
            Sumber jadwal: Kemenkes RI
          </a>
        </>
      )}
      <p className="calendar-guidance">
        Acuan minggu belum mengaktifkan pengingat janji dan tidak diekspor ke
        .ics. Setelah tanggal ditentukan, pengingat muncul di lonceng saat
        server berjalan, pada H-1/H-3/H-7 sesuai pilihan dan pada hari jadwal.
        Jika jam kosong, pengingat awal dihitung pukul 09.00 WIB. Untuk alarm di
        ponsel saat aplikasi ditutup, impor file .ics ke kalender ponsel dan
        aktifkan notifikasi di sana; dukungan alarm mengikuti aplikasi kalender.
      </p>
    </section>
  );
}
