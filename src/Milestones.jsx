import Select from "./Select";
import { useEffect, useState, useRef } from "react";
import {
  milestoneStages,
  completedMonths,
  stageForAge,
} from "../shared/milestones.js";
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
export default function Milestones({ child }) {
  const [loaded, setLoaded] = useState(false);
  const months = completedMonths(child.dob, today());
  const [month, setMonth] = useState(() => stageForAge(months)),
    [saved, setSaved] = useState({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    [observed, setObserved] = useState(today),
    [retry, setRetry] = useState(0);
  const pending = useRef(false);
  const stage = milestoneStages.find((s) => s.month === month);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/children/${child.id}/milestones`, { signal: abort.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        return data;
      })
      .then((data) => {
        setLoaded(true);
        setSaved(
          Object.fromEntries(
            data.map((r) => [r.milestone_id, r.observed_date]),
          ),
        );
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [child.id, retry]);
  async function toggle(id, checked) {
    if (pending.current) return;
    pending.current = true;
    setBusy(id);
    setError("");
    setNotice("");
    try {
      const r = await fetch(`/api/children/${child.id}/milestones/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked, observed_date: observed }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setSaved((previous) => {
        const next = { ...previous };
        if (checked) next[id] = data.observed_date;
        else delete next[id];
        return next;
      });
      setNotice(
        checked ? "Pengamatan tersimpan." : "Tanda checklist dibatalkan.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      pending.current = false;
      setBusy("");
    }
  }
  const count = stage.items.filter((i) => saved[i.id]).length;
  return (
    <section className="card milestones">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LANGKAH KECIL SI KECIL</span>
          <h2>Checklist perkembangan</h2>
        </div>
        <span className="fine">
          {child.name} · {Math.max(0, months)} bulan lengkap
        </span>
      </div>
      <p className="muted">
        Tandai kemampuan yang sudah kamu amati. Setiap centang dan tanggal
        disimpan khusus untuk {child.name}.
      </p>
      <div className="milestone-controls">
        <label>
          Tahap usia{" "}
          <Select
            aria-label="Tahap usia milestone"
            value={month}
            onChange={(e) => {
              setMonth(Number(e.target.value));
              setNotice("");
            }}
          >
            {milestoneStages.map((s) => (
              <option key={s.month} value={s.month}>
                {s.month} bulan
                {s.month === stageForAge(months) ? " · sesuai usia" : ""}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Tanggal pengamatan untuk centang baru{" "}
          <input
            type="date"
            value={observed}
            min={child.dob}
            max={today()}
            required
            onChange={(e) => setObserved(e.target.value)}
          />
        </label>
      </div>
      {month > months && (
        <p className="milestone-guidance">
          Ini pratinjau tahap {month} bulan; si kecil belum mencapai usia
          tersebut.
        </p>
      )}
      {months > 24 && (
        <p className="milestone-guidance">
          Katalog saat ini mencakup usia 1–24 bulan. Checklist ini dapat
          digunakan untuk melengkapi riwayat, bukan menilai perkembangan usia
          sekarang.
        </p>
      )}
      <p className="fine milestone-guidance">
        Ringkasan pilihan kemampuan dari {stage.sourceName};{" "}
        {month === 1
          ? "panduan pengamatan akhir bulan pertama."
          : "panduan kemampuan yang umumnya dicapai sebagian besar anak pada usia ini."}{" "}
        Tidak menggantikan skrining perkembangan.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}{" "}
          <button
            className="text-button"
            onClick={() => {
              setLoading(true);
              setRetry((n) => n + 1);
            }}
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
      {loading ? (
        <p className="empty">Memuat checklist…</p>
      ) : loaded ? (
        <>
          <p className="milestone-count">
            {count} dari {stage.items.length} kemampuan sudah dicatat pada tahap
            ini
          </p>
          <div className="milestone-groups">
            {[...new Set(stage.items.map((i) => i.category))].map(
              (category) => (
                <fieldset key={category}>
                  <legend>{category}</legend>
                  {stage.items
                    .filter((i) => i.category === category)
                    .map((item) => (
                      <label
                        className={`milestone-item ${saved[item.id] ? "is-observed" : ""}`}
                        key={item.id}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(saved[item.id])}
                          disabled={Boolean(busy) || !observed}
                          onChange={(e) => toggle(item.id, e.target.checked)}
                        />
                        <span>
                          {item.text}
                          <small>
                            {busy === item.id
                              ? "Menyimpan…"
                              : saved[item.id]
                                ? `Diamati pada ${saved[item.id]}`
                                : "Belum dicatat"}
                          </small>
                        </span>
                      </label>
                    ))}
                </fieldset>
              ),
            )}
          </div>
        </>
      ) : null}
      <div className="milestone-guidance">
        Jika kemampuan belum muncul pada usia panduannya, kemampuan yang sudah
        dimiliki menghilang, atau ada kekhawatiran, bicarakan dengan dokter
        anak. Untuk bayi prematur, tanyakan penggunaan usia koreksi kepada
        dokter.
      </div>
      <a
        className="text-button"
        href={stage.source}
        target="_blank"
        rel="noreferrer"
      >
        Lihat panduan {stage.sourceName} usia {month} bulan
      </a>
    </section>
  );
}
