import Select from "./Select";
import { useState } from "react";
import {
  assessMeasurement,
  lms,
  valueAtZ,
  centiles,
  zValues,
  metricInfo,
  MONTH_DAYS,
  MAX_DAY,
} from "../shared/growth.js";
const fmt = (n) =>
  Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2 });
export default function GrowthChart({ child, records, metric, onPosition }) {
  const [range, setRange] = useState(0),
    [chosen, setChosen] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const info = metricInfo[metric],
    all = records.map((r) => ({
      ...assessMeasurement(child, r, metric),
      record: r,
    }));
  const latest = all.at(-1),
    current = all.find((p) => p.record.id === chosen) ?? latest;
  const maxRecordDay = Math.max(
    0,
    ...all.map((p) => (Number.isFinite(p.day) ? p.day : 0)),
  );
  const months =
    range ||
    (maxRecordDay <= 6 * MONTH_DAYS
      ? 6
      : maxRecordDay <= 24 * MONTH_DAYS
        ? 24
        : 60);
  const end = months === 60 ? MAX_DAY : Math.floor(months * MONTH_DAYS);
  const points = all.filter((p) => p.available && p.day <= end);
  const days = Array.from({ length: end + 1 }, (_, day) => day);
  const curves = centiles.map((p, i) => ({
    p,
    values: days.map((d) => ({
      day: d,
      value: valueAtZ(lms(metric, child.sex, d), zValues[i]),
    })),
  }));
  const extent = [
    ...curves[0].values.map((p) => p.value),
    ...curves.at(-1).values.map((p) => p.value),
    ...points.map((p) => p.value),
  ];
  const low = Math.max(0, Math.floor(Math.min(...extent) - 0.5)),
    high = Math.ceil(Math.max(...extent) + 0.5);
  const x = (d) => 54 + (d / end) * 586,
    y = (v) => 320 - ((v - low) / (high - low)) * 286;
  const line = (arr) =>
    arr
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${x(p.day).toFixed(2)},${y(p.value).toFixed(2)}`,
      )
      .join(" ");
  // WHO length-to-height discontinuity is a real reference change; never smooth across it.
  const segments =
    metric === "height" && end >= 731
      ? [days.filter((d) => d <= 730), days.filter((d) => d >= 731)]
      : [days];
  const curveSegment = (curve, ds) =>
    curve.values.filter((p) => p.day >= ds[0] && p.day <= ds.at(-1));
  const birth = all.find((p) => p.day === 0);
  return (
    <div className="who-growth">
      <div className="growth-summary">
        {[
          ["Saat lahir", birth?.raw],
          ["Terakhir", latest?.raw],
          [
            "Perubahan sejak lahir",
            birth && latest ? latest.raw - birth.raw : null,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              {value == null ? "—" : fmt(value)} <small>{info.unit}</small>
            </strong>
          </div>
        ))}
      </div>
      <div className="growth-toolbar">
        <span className="fine">
          WHO · {child.sex === "male" ? "Laki-laki" : "Perempuan"} · menurut
          usia
        </span>
        <label>
          Rentang{" "}
          <Select
            aria-label="Rentang usia grafik"
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
          >
            <option value={0}>Otomatis</option>
            <option value={6}>0–6 bulan</option>
            <option value={24}>0–24 bulan</option>
            <option value={60}>0–60 bulan</option>
          </Select>
        </label>
      </div>
      <div
        className="who-chart-scroll"
        tabIndex={0}
        aria-label="Kurva persentil WHO. Geser untuk melihat seluruh grafik."
      >
        <svg
          className="who-chart"
          viewBox="0 0 700 365"
          role="group"
          aria-label={`Kurva ${info.label} menurut usia, WHO P1 sampai P99`}
        >
          <rect x="54" y="34" width="586" height="286" fill="#fbfcfc" />
          {segments.map((ds, s) =>
            [0, 1, 2, 3].map((i) => {
              const bottom = curveSegment(curves[i], ds),
                top = curveSegment(curves[8 - i], ds);
              return (
                <path
                  key={`${s}-${i}`}
                  d={
                    line(bottom) +
                    " " +
                    line([...top].reverse()).replace(/^M/, "L") +
                    " Z"
                  }
                  fill={["#f9eef2", "#f5dce6", "#edc2d3", "#e7a8c0"][i]}
                />
              );
            }),
          )}
          {Array.from({ length: 6 }, (_, i) => {
            const value = low + ((high - low) * i) / 5;
            return (
              <g key={i}>
                <line
                  x1="54"
                  x2="640"
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#ffffff"
                  strokeWidth="1"
                />
                <text x="44" y={y(value) + 4} textAnchor="end">
                  {fmt(value)}
                </text>
              </g>
            );
          })}
          {Array.from({ length: 7 }, (_, i) => (months * i) / 6).map((m) => (
            <g key={m}>
              <line
                x1={x(m * MONTH_DAYS)}
                x2={x(m * MONTH_DAYS)}
                y1="34"
                y2="320"
                stroke="#ffffff"
              />
              <text x={x(m * MONTH_DAYS)} y="342" textAnchor="middle">
                {m}
              </text>
            </g>
          ))}
          {curves.map((c) => (
            <g key={c.p}>
              {segments.map((ds, i) => (
                <path
                  key={i}
                  d={line(curveSegment(c, ds))}
                  fill="none"
                  stroke={c.p === 50 ? "#b96888" : "#cb91a7"}
                  strokeWidth={c.p === 50 ? 1.8 : 0.7}
                />
              ))}
              <text
                x="650"
                y={y(c.values.at(-1).value) + 4}
                className="percentile-label"
              >
                P{c.p}
              </text>
            </g>
          ))}
          {segments.map((ds, i) => (
            <path
              key={i}
              d={line(
                points.filter((p) => p.day >= ds[0] && p.day <= ds.at(-1)),
              )}
              fill="none"
              stroke="#7441a3"
              strokeWidth="3"
            />
          ))}
          {points.map((p) => (
            <g
              key={p.record.id}
              role="button"
              tabIndex={0}
              aria-label={`${p.record.date}, ${fmt(p.raw)} ${info.unit}, ${p.label}`}
              onClick={() => setChosen(p.record.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setChosen(p.record.id);
                }
              }}
            >
              <circle cx={x(p.day)} cy={y(p.value)} r="12" fill="transparent" />
              <circle
                cx={x(p.day)}
                cy={y(p.value)}
                r={current?.record.id === p.record.id ? 5.5 : 4}
                fill="white"
                stroke="#7441a3"
                strokeWidth="2.5"
              />
              <title>{`${p.record.date}: ${fmt(p.raw)} ${info.unit}, ${p.label}`}</title>
            </g>
          ))}
          <text x="54" y="20">
            {info.unit}
          </text>
          <text x="347" y="362" textAnchor="middle">
            Usia (bulan)
          </text>
        </svg>
      </div>
      <div className="growth-legend">
        <span>
          <i /> Pengukuran {child.name}
        </span>
        <span className="reference">
          <i /> Referensi WHO P1–P99; garis tengah P50
        </span>
      </div>
      {current ? (
        <div className="percentile-detail" aria-live="polite">
          <label>
            Pengukuran{" "}
            <Select
              aria-label="Tanggal pengukuran persentil"
              value={current.record.id}
              onChange={(e) => setChosen(e.target.value)}
            >
              {[...all].reverse().map((p) => (
                <option key={p.record.id} value={p.record.id}>
                  {p.record.date} · {p.day} hari
                </option>
              ))}
            </Select>
          </label>
          {current.available ? (
            <>
              <strong className="percentile-value">
                {current.label} <span>{current.band}</span>
              </strong>
              <p className="fine">
                {fmt(current.raw)} {info.unit} pada usia {current.day} hari.
                {current.adjusted &&
                  ` Nilai kurva ${fmt(current.value)} cm setelah penyesuaian posisi ukur 0,7 cm.`}
              </p>
            </>
          ) : (
            <p className="fine">{current.reason}</p>
          )}
          {metric === "height" && (
            <label className="growth-position">
              Posisi saat diukur{" "}
              <Select
                aria-label="Posisi saat diukur"
                disabled={busy}
                value={current.record.height_position || ""}
                onChange={async (e) => {
                  setBusy(true);
                  setError("");
                  try {
                    await onPosition(current.record.id, e.target.value);
                  } catch (err) {
                    setError(err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <option value="" disabled>
                  Belum dicatat — pilih posisi
                </option>
                <option value="recumbent">Telentang (panjang)</option>
                <option value="standing">Berdiri (tinggi)</option>
              </Select>
            </label>
          )}
          {metric === "height" && current.assumed && (
            <p className="growth-caution">
              Persentil sementara: posisi ukur data lama diasumsikan{" "}
              {current.day < 731 ? "telentang" : "berdiri"} sesuai usia. Pilih
              posisi sebenarnya untuk memastikan perhitungannya.
            </p>
          )}
          {current.available && current.day > end && (
            <p className="fine">
              Titik berada di luar rentang yang dipilih. Ubah rentang untuk
              melihatnya.
            </p>
          )}
        </div>
      ) : (
        <p className="fine">
          Kurva referensi siap. Tambahkan pengukuran untuk melihat posisi si
          kecil.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <details className="growth-explanation">
        <summary>Cara membaca kurva & sumber</summary>
        <p>
          P10 berarti sekitar 10% anak pada referensi WHO dengan jenis kelamin
          dan usia yang sama memiliki ukuran lebih rendah. Persentil bukan
          target yang harus dikejar; pola perubahan dari waktu ke waktu perlu
          dinilai bersama tenaga kesehatan.
        </p>
        <p>
          Referensi memakai usia sejak lahir, belum mengoreksi prematuritas.
          Berat menurut usia saja tidak menentukan status gizi. Panjang
          telentang digunakan hingga hari ke-730, lalu tinggi berdiri; perbedaan
          metode disesuaikan 0,7 cm. Nilai di luar rentang referensi tetap
          tersimpan di riwayat.
        </p>
        <a
          href={`https://www.who.int/tools/child-growth-standards/standards/${info.source}`}
          target="_blank"
          rel="noreferrer"
        >
          WHO Child Growth Standards — {info.label}
        </a>
      </details>
    </div>
  );
}
