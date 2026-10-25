import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../app/lib/sentrix-api.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
function load(fetch, base = "https://api.example.test/") {
  const exports = {};
  runInNewContext(outputText, { exports, fetch, AbortSignal, Error, Map, Date,
    process: { env: { NEXT_PUBLIC_API_URL: base } },
    require: () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } } }) } } }),
  });
  return exports;
}
test("requests use the session token and disable caching", async () => {
  const api = load(async (url, options) => {
    assert.equal(url, "https://api.example.test/api/groups");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert.equal(options.cache, "no-store");
    return new Response(JSON.stringify([]));
  });
  assert.equal((await api.apiRequest("/groups")).length, 0);
});
test("missing configuration, network failure and server rejection are visible", async () => {
  await assert.rejects(load(() => assert.fail(), "").apiRequest("/groups"), /not configured/);
  await assert.rejects(load(() => { throw new Error("network"); }).apiRequest("/groups"), /Cannot reach/);
  await assert.rejects(load(async () => new Response(JSON.stringify({ error: "remove devices first" }), { status: 409 })).apiRequest("/groups/g", { method: "DELETE" }), /remove devices first/);
  assert.equal(await load(async () => new Response(null, { status: 204 })).apiRequest("/devices/d", { method: "DELETE" }), undefined);
});
test("chart joins real hourly bounds; missing bounds and zero readings stay honest", () => {
  const api = load();
  const points = api.joinTelemetry([
    { timestamp: "2026-10-25T01:35:00Z", rms_current: 0 },
    { timestamp: "2026-10-25T02:35:00Z", rms_current: 9 },
    { timestamp: "2026-10-25T03:35:00Z", rms_current: 5 },
  ], [{ timestamp: "2026-10-25T02:00:00Z", lower_bound: 2, upper_bound: 7 }]);
  assert.equal(points[0].rmsCurrent, 0); assert.equal(points[0].upperBound, null);
  assert.equal(points[1].isAnomaly, true); assert.equal(points[1].lowerBound, 2);
  assert.equal(points[2].isAnomaly, false); assert.equal(points[2].upperBound, null);
});
