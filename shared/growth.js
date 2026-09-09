import tables from "./data/who-lms.json" with { type: "json" };
export const MONTH_DAYS = 30.4375;
export const MAX_DAY = 1856;
export const centiles = [1, 5, 10, 25, 50, 75, 90, 95, 99];
export const zValues = [
  -2.326347874, -1.644853627, -1.281551566, -0.67448975, 0, 0.67448975,
  1.281551566, 1.644853627, 2.326347874,
];
export const metricInfo = {
  weight: { label: "Berat badan", unit: "kg", source: "weight-for-age" },
  height: {
    label: "Panjang / tinggi badan",
    unit: "cm",
    source: "length-height-for-age",
  },
  head: {
    label: "Lingkar kepala",
    unit: "cm",
    source: "head-circumference-for-age",
  },
};
export function ageDays(dob, date) {
  const parse = (s) => {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
    const n = Date.parse(s + "T00:00:00Z");
    return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === s
      ? n
      : NaN;
  };
  return (parse(date) - parse(dob)) / 86400000;
}
export function lms(metric, sex, day) {
  return Number.isInteger(day) && day >= 0 && day <= MAX_DAY
    ? (tables[metric]?.[sex]?.[day] ?? null)
    : null;
}
export function valueAtZ(params, z) {
  const [L, M, S] = params;
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}
export function zScore(params, value) {
  const [L, M, S] = params;
  return L === 0
    ? Math.log(value / M) / S
    : (Math.pow(value / M, L) - 1) / (L * S);
}
export function normalCDF(z) {
  const x = Math.abs(z),
    t = 1 / (1 + 0.2316419 * x),
    d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const upper =
    d *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - upper : upper;
}
export function assessMeasurement(child, record, metric) {
  const day = ageDays(child.dob, record.date),
    params = lms(metric, child.sex, day),
    raw = Number(record[metric]);
  if (!params || !Number.isFinite(raw) || raw <= 0)
    return {
      day,
      raw,
      available: false,
      reason:
        "Referensi tersedia pada usia 0–1.856 hari (hingga 60 bulan lengkap).",
    };
  let value = raw,
    assumed = false;
  if (metric === "height") {
    const position = record.height_position;
    if (!position) assumed = true; // Legacy records: transparent age-appropriate assumption.
    if (day < 731 && position === "standing") value += 0.7;
    if (day >= 731 && position === "recumbent") value -= 0.7;
  }
  const z = zScore(params, value),
    percentile = 100 * normalCDF(z);
  const label =
    percentile < 0.1
      ? "< P0,1"
      : percentile > 99.9
        ? "> P99,9"
        : `P${percentile.toLocaleString("id-ID", { maximumFractionDigits: 1 })}`;
  const below = centiles.filter((p) => p <= percentile).at(-1),
    above = centiles.find((p) => p > percentile);
  const band =
    below === undefined
      ? "Di bawah P1"
      : above === undefined
        ? "P99 atau lebih"
        : `Di antara P${below}–P${above}`;
  return {
    available: true,
    day,
    raw,
    value,
    assumed,
    z,
    percentile,
    label,
    band,
    adjusted: Math.abs(value - raw) > 0.01,
  };
}
