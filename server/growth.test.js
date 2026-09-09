import test from "node:test";
import assert from "node:assert/strict";
import checks from "../shared/data/who-checks.json" with { type: "json" };
import {
  lms,
  valueAtZ,
  zValues,
  normalCDF,
  ageDays,
  assessMeasurement,
  MAX_DAY,
} from "../shared/growth.js";
import {
  milestoneStages,
  milestoneIds,
  stageForAge,
  completedMonths,
} from "../shared/milestones.js";
test("all WHO daily centile lines match independently supplied expanded tables", () => {
  let count = 0,
    maxError = 0;
  for (const series of checks) {
    assert.equal(series.values.length, 1857);
    series.values.forEach((official, day) => {
      const params = lms(series.metric, series.sex, day);
      for (let i = 0; i < zValues.length; i++) {
        const error = Math.abs(valueAtZ(params, zValues[i]) - official[i]);
        maxError = Math.max(maxError, error);
        assert.ok(
          error <= 0.0011,
          `${series.metric}/${series.sex}/day ${day}/curve ${i}: error ${error}`,
        );
        count++;
      }
    });
  }
  assert.equal(count, 100278);
  console.log(
    `Validated ${count} WHO daily percentile values; max absolute error ${maxError.toFixed(6)} kg/cm.`,
  );
});
test("growth age, sex, percentile inversion, range and length-height transition", () => {
  assert.equal(ageDays("2024-02-28", "2024-03-01"), 2);
  assert.equal(ageDays("2025-02-28", "2025-03-01"), 1);
  assert.ok(Number.isNaN(ageDays("2026-02-30", "2026-03-02")));
  assert.equal(lms("weight", "female", -1), null);
  assert.equal(lms("head", "male", MAX_DAY + 1), null);
  assert.equal(lms("weight", "unknown", 0), null);
  assert.ok(Math.abs(normalCDF(0) - 0.5) < 1e-7);
  assert.ok(Math.abs(normalCDF(1.281551566) - 0.9) < 1e-7);
  assert.notEqual(lms("weight", "female", 0)[1], lms("weight", "male", 0)[1]);
  const child = { dob: "2024-01-01", sex: "female" };
  for (const day of [0, 30, 183, 730, 731, 1856]) {
    const date = new Date(Date.UTC(2024, 0, 1) + day * 86400000)
      .toISOString()
      .slice(0, 10);
    for (const metric of ["weight", "height", "head"]) {
      const value = lms(metric, "female", day)[1];
      const a = assessMeasurement(
        child,
        {
          date,
          [metric]: value,
          height_position: day < 731 ? "recumbent" : "standing",
        },
        metric,
      );
      assert.ok(a.available);
      assert.ok(Math.abs(a.percentile - 50) < 0.0001);
    }
  }
  assert.ok(
    lms("height", "female", 730)[1] - lms("height", "female", 731)[1] > 0.65,
  );
  const before = assessMeasurement(
    child,
    { date: "2024-01-01", height: 50, height_position: "standing" },
    "height",
  );
  assert.equal(before.value, 50.7);
  assert.equal(before.adjusted, true);
  const after = assessMeasurement(
    child,
    { date: "2026-01-01", height: 87, height_position: "recumbent" },
    "height",
  );
  assert.equal(after.day, 731);
  assert.equal(after.value, 86.3);
  assert.equal(
    assessMeasurement(child, { date: "2024-01-01", height: 50 }, "height")
      .assumed,
    true,
  );
  assert.equal(
    assessMeasurement(child, { date: "2030-01-01", weight: 12 }, "weight")
      .available,
    false,
  );
  assert.equal(
    assessMeasurement(child, { date: "2024-01-01", weight: 0 }, "weight")
      .available,
    false,
  );
});
test("milestone stages retain unique identifiers and choose completed age", () => {
  assert.equal(
    milestoneIds.size,
    milestoneStages.flatMap((s) => s.items).length,
  );
  assert.equal(stageForAge(0), 1);
  assert.equal(stageForAge(3), 2);
  assert.equal(stageForAge(5), 4);
  assert.equal(stageForAge(24), 24);
  assert.equal(completedMonths("2026-01-10", "2026-02-09"), 0);
  assert.equal(completedMonths("2026-01-10", "2026-02-10"), 1);
  for (const s of milestoneStages) assert.ok(s.source.startsWith("https://"));
});
