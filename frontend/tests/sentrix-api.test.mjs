import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../app/lib/sentrix-api.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
function load(fetch, base = "https://api.example.test/", signals = AbortSignal) {
  const exports = {};
  runInNewContext(outputText, { exports, fetch, AbortSignal: signals, Error, Map, Date,
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
test("caller cancellation retains the request deadline so a stalled confirmation can retry", async () => {
  const caller = new AbortController(), deadline = new AbortController();
  const timeouts = [deadline, new AbortController()];
  let calls = 0;
  const api = load(async (_url, options) => {
    calls++;
    if (calls > 1) return new Response(JSON.stringify({ status: "pending" }));
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
  }, "https://api.example.test/", { timeout: ms => { assert.equal(ms, 20000); return timeouts.shift().signal; }, any: signals => AbortSignal.any(signals) });
  const request = api.apiRequest("/groups/g/device-claims/c", { signal: caller.signal });
  await new Promise(resolve => setImmediate(resolve));
  deadline.abort();
  const result = await Promise.race([request.then(() => "unexpected success", error => error.message), new Promise(resolve => setTimeout(() => resolve("still waiting"), 40))]);
  caller.abort();
  assert.match(result, /Cannot reach Sentrix/);
  assert.equal((await api.apiRequest("/groups/g/device-claims/c", { signal: new AbortController().signal })).status, "pending");
});
test("an unmounted caller cancels a request even while its timeout has not expired", async () => {
  const caller = new AbortController();
  const api = load(async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })));
  const pending = api.apiRequest("/groups/g/device-claims/c", { signal: caller.signal });
  await new Promise(resolve => setImmediate(resolve));
  caller.abort();
  await assert.rejects(pending, /Cannot reach Sentrix/);
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
