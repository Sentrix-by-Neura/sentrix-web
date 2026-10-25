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
test("claim sends entered PIN but stores no PIN", async () => {
  const { api, read, calls } = setup((path, init) => init.method === "POST" ? device : undefined);
  await api.refreshData();
  await api.claimDevice("g1", { name: "Sensor", macAddress: "24:6F:28:C2:5E:19", pin: "849201" });
  assert.equal(JSON.parse(calls.find(c => c.method === "POST").body).pin, "849201");
  assert.equal(JSON.stringify(read()).includes("849201"), false); assert.equal("pinCode" in read().devices[0], false);
});
test("same-group recovery reuses claim without resetting calibration", async () => {
  const { api, calls, read } = setup(path => path.endsWith("/devices") ? [device] : undefined);
  await api.refreshData(); await api.claimDevice("g1", { name: "Sensor", macAddress: "24:6f:28:c2:5e:19", pin: "849201" });
  assert.equal(calls.some(c => c.method === "POST"), false); assert.equal(read().devices.length, 1);
});
test("failed claim never invents a factory device", async () => {
  const { api, read } = setup((path, init) => { if (init.method === "POST") throw new Error("no unclaimed device matches that MAC and PIN"); });
  await api.refreshData();
  await assert.rejects(api.claimDevice("g1", { name: "Sensor", macAddress: "24:6F:28:C2:5E:19", pin: "849201" }), /no unclaimed/);
  assert.equal(read().devices.length, 0);
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
