import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { default: Chart } = await vite.ssrLoadModule("/src/GrowthChart.jsx");
  const { lms } = await vite.ssrLoadModule("/shared/growth.js");
  for (const sex of ["male", "female"])
    for (const metric of ["weight", "height", "head"]) {
      const records = [0, 730, 731, 1856].map((day) => ({
        id: String(day),
        date: new Date(Date.UTC(2020, 0, 1) + day * 86400000)
          .toISOString()
          .slice(0, 10),
        [metric]: lms(metric, sex, day)[1],
        height_position: day < 731 ? "recumbent" : "standing",
      }));
      const html = renderToStaticMarkup(
        React.createElement(Chart, {
          child: { id: "test", name: "Test", dob: "2020-01-01", sex },
          records,
          metric,
          onPosition: () => {},
        }),
      );
      assert.ok(!/NaN|Infinity/.test(html));
      assert.equal((html.match(/class="percentile-label"/g) || []).length, 9);
      assert.equal((html.match(/role="button"/g) || []).length, 4);
      assert.equal((html.match(/<title>/g) || []).length, 4);
    }
  console.log(
    "Six WHO series render with finite SVG geometry, nine percentile labels and four measurement markers/tooltips each.",
  );
} finally {
  await vite.close();
}
