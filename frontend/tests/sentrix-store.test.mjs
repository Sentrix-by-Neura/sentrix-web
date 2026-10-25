import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../app/lib/sentrix-store.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source + "\nexport const testing = { read: () => state, resetAccount, actions };", {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
});
const group = { id: "g1", name: "East Wing", mesh_id: "AABBCCDDEEFF", description: null };
const device = { id: "d1", name: "Sensor", mac_address: "246F28C25E19", group_id: "g1", status: "CALIBRATING", last_seen: null };
const claim = { id: "claim-1", setup_token: "a".repeat(64), expires_at: new Date(Date.now() + 600000).toISOString() };
function setup(handler) {
  const calls = [];
  let session = { user: { id: "alice", email: "alice@example.test", user_metadata: {} }, access_token: "token" };
  const exports = {};
  const apiRequest = async (path, init = {}) => {
    calls.push({ path, ...init });
    if (handler) { const result = await handler(path, init); if (result !== undefined) return result; }
    if (path === "/groups") return [group];
    if (path.endsWith("/devices") || path.startsWith("/alerts")) return [];
    throw new Error("Unexpected request " + path);
  };
  runInNewContext(outputText, {
    exports, Error, Date, Map, Set,
    require: name => name === "./sentrix-api" ? { apiRequest, authenticatedSession: async () => { if (!session) throw new Error("Log in again"); return session; } } :
      name === "./supabase-browser" ? { supabase: { from: table => { assert.equal(table, "users"); return { select: columns => { assert.equal(columns, "name,role"); return { eq: () => ({ maybeSingle: async () => ({ data: { name: "Alice", role: "USER" } }) }) }; } }; } } } :
      { createContext: () => ({}) },
  });
  return { api: exports, calls, read: exports.testing.read, actions: exports.testing.actions, switchUser: id => { session = id ? { ...session, user: { id, email: "new@example.test", user_metadata: {} } } : null; exports.testing.resetAccount(id); } };
}
test("loads server records and unambiguous group routes", async () => {
  const { api, read } = setup();
  await api.refreshData();
  assert.equal(read().groups[0].meshId, group.mesh_id);
  assert.equal(read().ready, true);
  const groups = [{ ...read().groups[0] }, { ...read().groups[0], id: "g2", slug: "east-wing-g2" }];
  assert.equal(api.findGroup(groups, "east-wing"), undefined);
  assert.equal(api.findGroup(groups, "east-wing-g2").id, "g2");
});
test("transferred devices keep their historical identity without counting as recent contact", async () => {
  const archived = { ...device, archived_at: "2026-10-25T01:00:00Z", status: "OFFLINE", last_seen: new Date().toISOString() };
  const { api, read } = setup(path => path.endsWith("/devices") ? [archived] : undefined);
  await api.refreshData();
  assert.equal(read().devices[0].archivedAt, archived.archived_at);
  assert.equal(read().devices[0].id, device.id);
  assert.equal(api.hasRecentContact(read().devices[0]), false);
});
test("failed creation never creates a ghost group", async () => {
  const { api, actions, read } = setup((path, init) => { if (init.method === "POST") throw new Error("database unavailable"); });
  await api.refreshData();
  await assert.rejects(actions.createGroup("New"), /database unavailable/);
  assert.equal(read().groups.length, 1); assert.match(read().error, /database unavailable/);
});
test("successful creation uses backend identity", async () => {
  const { api, actions, read } = setup((path, init) => init.method === "POST" ? { ...group, id: "server-id", mesh_id: "112233445566" } : undefined);
  await api.refreshData();
  const created = await actions.createGroup("New");
  assert.equal(created.id, "server-id"); assert.equal(created.meshId, "112233445566"); assert.equal(read().groups.length, 2);
});
test("beginning a claim sends only MAC and name and stores no pending device or secret", async () => {
  const { api, read, calls } = setup((path, init) => init.method === "POST" ? claim : undefined);
  await api.refreshData();
  const pending = await api.claimDevice("g1", { name: "Sensor", macAddress: "24:6F:28:C2:5E:19", pin: "849201" });
  assert.deepEqual(JSON.parse(calls.find(c => c.method === "POST").body), { name: "Sensor", mac: "24:6F:28:C2:5E:19" });
  assert.equal(pending.setup_token, claim.setup_token);
  assert.equal(read().devices.length, 0);
  assert.equal(JSON.stringify(read()).includes(claim.setup_token), false);
  assert.equal(JSON.stringify(read()).includes("849201"), false);
});
test("recovery requests device confirmation without replacing the existing device", async () => {
  const { api, calls, read } = setup((path, init) => init.method === "POST" ? claim : path.endsWith("/devices") ? [device] : undefined);
  await api.refreshData(); await api.claimDevice("g1", { name: "Sensor", macAddress: "24:6f:28:c2:5e:19" });
  assert.equal(calls.some(c => c.method === "POST"), true);
  assert.equal(read().devices[0].id, device.id);
});
test("failed claim never invents a device", async () => {
  const { api, read } = setup((path, init) => { if (init.method === "POST") throw new Error("This device is not available for this group"); });
  await api.refreshData();
  await assert.rejects(api.claimDevice("g1", { name: "Sensor", macAddress: "24:6F:28:C2:5E:19" }), /not available/);
  assert.equal(read().devices.length, 0);
});
test("pending and expired status never adds a device; confirmed status publishes the real row", async () => {
  let status = "pending";
  const { api, read, calls } = setup(path => path.includes("/device-claims/") ? { id: claim.id, status, expires_at: claim.expires_at, ...(status === "confirmed" ? { device } : {}) } : undefined);
  await api.refreshData();
  await api.getDeviceClaim("g1", claim.id);
  assert.equal(read().devices.length, 0);
  status = "expired"; await api.getDeviceClaim("g1", claim.id);
  assert.equal(read().devices.length, 0);
  status = "confirmed"; await api.getDeviceClaim("g1", claim.id);
  assert.equal(read().devices[0].id, "d1");
  assert.equal(calls.some(c => c.path.includes(claim.setup_token)), false);
});
test("claim status cannot publish after an account switch or from a different group", async () => {
  let release;
  const { api, read, switchUser } = setup(path => path.includes("/device-claims/") ? new Promise(resolve => { release = resolve; }) : undefined);
  await api.refreshData();
  const pending = api.getDeviceClaim("g1", claim.id);
  await new Promise(resolve => setImmediate(resolve));
  switchUser("bob"); release({ id: claim.id, status: "confirmed", expires_at: claim.expires_at, device });
  await assert.rejects(pending, /Account changed/);
  assert.equal(read().devices.length, 0);
  const other = setup(path => path.includes("/device-claims/") ? { id: claim.id, status: "confirmed", device: { ...device, group_id: "other" } } : undefined);
  await other.api.refreshData();
  await assert.rejects(other.api.getDeviceClaim("g1", claim.id), /Invalid device confirmation/);
  assert.equal(other.read().devices.length, 0);
});
test("invalid setup challenges are rejected without adding a device", async () => {
  for (const response of [{ id: "old-device" }, { ...claim, setup_token: "bad" }, { ...claim, expires_at: "invalid" }]) {
    const { api, read } = setup((path, init) => init.method === "POST" ? response : undefined);
    await api.refreshData();
    await assert.rejects(api.claimDevice("g1", { name: "Sensor", macAddress: "24:6F:28:C2:5E:19" }), /Invalid setup challenge/);
    assert.equal(read().devices.length, 0);
  }
});
test("old account requests cannot populate new account", async () => {
  let release;
  const { api, read, switchUser } = setup(path => path === "/groups" ? new Promise(resolve => { release = resolve; }) : undefined);
  const pending = api.refreshData(); await new Promise(resolve => setImmediate(resolve));
  switchUser("bob"); release([group]); await pending;
  assert.equal(read().groups.length, 0); assert.equal(read().userId, "bob");
});
test("failed removal retains data", async () => {
  const { api, actions, read } = setup((path, init) => { if (init.method === "DELETE") throw new Error("remove devices first"); });
  await api.refreshData(); await assert.rejects(actions.deleteGroup("g1"), /remove devices first/); assert.equal(read().groups.length, 1);
});
test("sign-out clears data instead of loading a seed", async () => {
  const { api, read, switchUser } = setup();
  await api.refreshData(); switchUser(null); await api.refreshData();
  assert.equal(read().groups.length, 0); assert.equal(read().userProfile.email, ""); assert.match(read().error, /Log in/);
});
