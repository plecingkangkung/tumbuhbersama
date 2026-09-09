import fs from "node:fs/promises";
await fs.mkdir(".who-cache", { recursive: true });
const sources = [];
for (const [metric, page] of [
  ["weight", "weight-for-age"],
  ["height", "length-height-for-age"],
  ["head", "head-circumference-for-age"],
]) {
  const html = await (
    await fetch(
      "https://www.who.int/tools/child-growth-standards/standards/" + page,
    )
  ).text();
  for (const m of html.matchAll(/href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (!/percentiles: expanded tables/i.test(m[2])) continue;
    const sex = /Girls/.test(m[2]) ? "female" : "male";
    const url = m[1];
    const r = await fetch(url);
    if (!r.ok) throw Error(r.status + " " + url);
    await fs.writeFile(
      `.who-cache/${metric}-${sex}.xlsx`,
      Buffer.from(await r.arrayBuffer()),
    );
    sources.push({
      metric,
      sex,
      url,
      page:
        "https://www.who.int/tools/child-growth-standards/standards/" + page,
    });
  }
}
if (sources.length !== 6) throw Error("Expected six WHO tables.");
await fs.writeFile(".who-cache/sources.json", JSON.stringify(sources, null, 2));
console.log("Downloaded", sources.length, "official WHO tables");
