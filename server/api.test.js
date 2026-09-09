import test from "node:test";
import assert from "node:assert/strict";
process.env.DEMO_MODE = "true";
const { app } = await import("./index.js");
test("session isolation, validation and persistence across requests", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, cookie, origin) {
    const res = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...(origin ? { origin } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: res.status,
      data: await res.json(),
      cookie: res.headers.get("set-cookie")?.split(";")[0],
    };
  }
  try {
    assert.equal((await request("/children")).status, 401);
    const a = await request("/demo", {}),
      b = await request("/demo", {});
    assert.equal(a.status, 200);
    assert.notEqual(a.cookie, b.cookie);
    assert.equal((await request("/articles")).status, 401);
    const catalog = await request("/articles", undefined, a.cookie);
    assert.equal(catalog.status, 200);
    assert.equal(catalog.data.length, 4);
    assert.equal(new Set(catalog.data.map((item) => item.slug)).size, 4);
    for (const item of catalog.data) {
      assert.equal(item.sections, undefined);
      const detail = await request(
        `/articles/${item.slug}`,
        undefined,
        a.cookie,
      );
      assert.equal(detail.status, 200);
      assert.equal(detail.data.title, item.title);
      assert.ok(detail.data.sections.length > 0);
      assert.ok(
        ["www.who.int", "www.unicef.org"].includes(
          new URL(detail.data.sourceUrl).hostname,
        ),
      );
    }
    assert.equal(
      (await request("/articles/tidak-ada", undefined, a.cookie)).status,
      404,
    );
    const profiles = await request("/children", undefined, a.cookie);
    assert.equal(profiles.data.length, 1);
    const child = profiles.data[0];
    assert.equal(
      (await request(`/children/${child.id}/records`, undefined, b.cookie))
        .status,
      404,
    );
    assert.equal(
      (
        await request(
          `/children/${child.id}/records`,
          {
            kind: "journal",
            date: child.dob,
            title: "No access",
            category: "Gerak tubuh",
          },
          b.cookie,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          "/children",
          { name: "Test", dob: "2099-01-01", sex: "female" },
          a.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          "/children",
          { name: "Test", dob: "2026-02-30", sex: "female" },
          a.cookie,
        )
      ).status,
      400,
    );
    const created = await request(
      "/children",
      { name: "Bima", dob: "2026-01-01", sex: "male" },
      a.cookie,
    );
    assert.equal(created.status, 201);
    const p = `/children/${created.data.id}/records`;
    assert.equal(
      (
        await request(
          p,
          {
            kind: "measurement",
            date: "2026-01-01",
            weight: -1,
            height: 50,
            head: 35,
          },
          a.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          p,
          {
            kind: "measurement",
            date: "2025-12-31",
            weight: 3,
            height: 50,
            head: 35,
          },
          a.cookie,
        )
      ).status,
      400,
    );
    const m = {
      kind: "measurement",
      date: "2026-01-01",
      weight: 3.2,
      height: 50,
      head: 35,
    };
    assert.equal((await request(p, m, a.cookie)).status, 201);
    assert.equal((await request(p, m, a.cookie)).status, 409);
    assert.equal(
      (
        await request(
          p,
          {
            kind: "journal",
            date: "2026-01-02",
            title: "Catatan pertama",
            category: "Momen lainnya",
            notes: "Halo",
          },
          a.cookie,
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await request(
          p,
          { kind: "visit", date: "2027-01-02", title: "Posyandu", notes: "" },
          a.cookie,
        )
      ).status,
      201,
    );
    assert.equal((await request(p, undefined, a.cookie)).data.length, 3);
    assert.equal(
      (
        await request(
          "/children",
          { name: "Cross origin", dob: "2026-01-01", sex: "male" },
          a.cookie,
          "https://example.com",
        )
      ).status,
      403,
    );
    assert.equal((await request("/logout", {}, a.cookie)).status, 200);
    assert.equal((await request("/children", undefined, a.cookie)).status, 401);
    assert.equal(
      (await request("/children", undefined, b.cookie)).data.length,
      1,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});
