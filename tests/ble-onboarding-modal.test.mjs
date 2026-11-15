import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/dashboard/[groupName]/ble-onboarding-modal.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
});
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const text = node => typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(text).join("") : node?.props ? text(node.props.children) : "";
const all = node => Array.isArray(node) ? node.flatMap(all) : node?.props ? [node, ...all(node.props.children)] : [];

function fixture({ claimError, authError } = {}) {
  const cells = [], effects = [], exports = {}, scans = [], claims = [], timers = new Set();
  let cursor = 0, tree, transferred, status = "pending";
  const points = [], devices = [];
  const hardware = { name: "Sensor", macAddress: "24:6F:28:C2:5E:19", device: { gatt: { disconnect() {} } } };
  const hooks = {
    ...require("react"),
    useState(initial) { const index = cursor++; if (!(index in cells)) cells[index] = initial; return [cells[index], value => { cells[index] = typeof value === "function" ? value(cells[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return cells[index] ??= { current: initial }; },
    useCallback(fn) { cursor++; return fn; },
    useEffect(fn, deps) { const index = cursor++; const previous = cells[index]; if (!previous || deps?.some((d, i) => d !== previous.deps[i])) { const entry = { deps }; cells[index] = entry; effects.push(() => { previous?.cleanup?.(); entry.cleanup = fn(); }); } },
  };
  runInNewContext(outputText, { exports, queueMicrotask, Date, Error, AbortController, setInterval: fn => { timers.add(fn); return fn; }, clearInterval: fn => timers.delete(fn), require: name => {
    if (name === "react") return hooks;
    if (name === "react/jsx-runtime") return require(name);
    if (name.endsWith("sentrix-store")) return {
      useSentrix: () => ({ userId: "operator", devices, refreshData() {}, claimDevice: async (_, payload) => {
        claims.push(payload);
        if (claimError) throw new Error(claimError);
        return { id: "claim", setup_token: "a".repeat(64), expires_at: new Date(Date.now() + 600000).toISOString() };
      }, getDeviceClaim: async () => {
        if (status === "confirmed" && devices.length === 0) devices.push({ id: "claimed", lastSeen: new Date(Date.now() + 1000).toISOString() });
        return { id: "claim", status, ...(status === "confirmed" ? { device: { id: "claimed" } } : {}) };
      } }),
      useTelemetry: () => ({ points }),
    };
    if (name.endsWith("sentrix-bluetooth")) return {
      scanSentrixHardware: async () => hardware,
      authenticateSentrixHardware: async () => { if (authError) throw new Error(authError); },
      scanSentrixWifi: () => { const scan = deferred(); scans.push(scan); return scan.promise; },
      validateSentrixNetwork() {},
      validateSentrixConfiguration() {},
      provisionSentrixHardware: async (_, config) => { transferred = config; },
    };
    throw new Error(`Unexpected import ${name}`);
  } });
  const props = { group: { id: "group", name: "Server room", meshId: "AABBCCDDEEFF" }, onClose() {} };
  const render = () => { cursor = 0; tree = exports.BleOnboardingModal(props); effects.splice(0).forEach(fn => fn()); return tree; };
  const find = predicate => { const found = all(tree).find(predicate); assert.ok(found, "Expected UI control is rendered"); return found; };
  const button = label => find(n => n.type === "button" && (n.props["aria-label"] ?? text(n)) === label);
  const input = label => all(find(n => n.type === "label" && text(n).startsWith(label))).find(n => n.type === "input") ?? find(n => n.type === "input" && n.props.id === find(p => p.type === "label" && text(p) === label).props.htmlFor);
  const change = (label, value) => { input(label).props.onChange({ target: { value } }); render(); };
  const submit = async () => { await find(n => n.type === "form").props.onSubmit({ preventDefault() {} }); render(); };
  const wifi = async () => { await button("Find sensor").props.onClick(); render(); change("Hardware PIN", "849201"); await submit(); };
  render();
  return { render, find, button, input, change, submit, wifi, scans, points, devices, claims, get tree() { return tree; }, get transferred() { return transferred; }, async poll(nextStatus) { await tick(); status = nextStatus; for (const timer of [...timers]) await timer(); await tick(); render(); }, async finishScan(names) { scans.at(-1).resolve(names); await tick(); render(); } };
}

test("progress follows setup and waits for telemetry before completing Finish", async () => {
  const f = fixture();
  const current = () => text(f.find(n => n.props["aria-current"] === "step"));
  assert.match(current(), /Sensor/);
  await f.wifi();
  assert.match(current(), /Wi-Fi/);
  await f.finishScan(["Office"]);
  f.change("Wi-Fi network", "Office");
  await f.submit();
  assert.match(current(), /Finish/);
  assert.match(text(f.tree), /Wi-Fi settings saved; waiting for device confirmation/);
  await f.poll("confirmed");
  assert.match(text(f.tree), /Backend contact confirmed; waiting for telemetry/);
  f.points.push({ timestamp: new Date(Date.now() - 60000).toISOString() }); f.render();
  assert.doesNotMatch(text(f.tree), /Telemetry received/);
  f.points.push({ timestamp: new Date(Date.now() + 1000).toISOString() }); f.render();
  assert.match(text(f.tree), /Telemetry received/);
  assert.equal(all(f.tree).some(n => n.props["aria-current"] === "step"), false);
});

test("scan feedback is animated, announced and blocks submission until results arrive", async () => {
  const f = fixture(); await f.wifi();
  const status = f.find(n => n.props.role === "status" && /Scanning/.test(text(n)));
  assert.ok(all(status).some(n => /animate-spin/.test(n.props.className ?? "") && /motion-reduce:animate-none/.test(n.props.className ?? "")));
  assert.equal(f.button("Register and connect").props.disabled, true);
  await f.finishScan([]);
  assert.match(text(f.tree), /No networks found/);
  assert.equal(f.button("Register and connect").props.disabled, false);
});

test("network chips preserve exact names and manual editing updates selection", async () => {
  const f = fixture(); await f.wifi();
  const name = "  Upstairs café network  ";
  await f.finishScan([name, "Guest"]);
  const chip = f.button(name);
  assert.equal(chip.props.type, "button");
  chip.props.onClick(); f.render();
  assert.equal(f.input("Wi-Fi network").props.value, name);
  assert.equal(f.button(name).props["aria-pressed"], true);
  f.change("Wi-Fi network", "Hidden network");
  assert.equal(f.button(name).props["aria-pressed"], false);
});

test("failed rescans keep existing chips and manually entered settings", async () => {
  const f = fixture(); await f.wifi(); await f.finishScan(["Office"]);
  f.button("Office").props.onClick(); f.render();
  const pending = f.button("Scan Wi-Fi").props.onClick(); f.render();
  assert.equal(f.button("Office").props["aria-pressed"], true);
  assert.equal(f.input("Wi-Fi network").props.value, "Office");
  f.scans.at(-1).reject(new Error("Scan failed. Enter the network manually."));
  await pending; f.render();
  assert.match(text(f.tree), /Scan failed/);
  assert.equal(f.button("Office").props["aria-pressed"], true);
  assert.equal(f.button("Scan Wi-Fi").props.disabled, false);
});

test("password eye preserves the value, stays out of submission and resets after setup", async () => {
  const f = fixture(); await f.wifi(); await f.finishScan(["Office"]);
  f.change("Wi-Fi network", "Office"); f.change("Wi-Fi password", "fixture-password");
  assert.equal(f.input("Wi-Fi password").props.type, "password");
  assert.equal(f.button("Show Wi-Fi password").props.type, "button");
  f.button("Show Wi-Fi password").props.onClick(); f.render();
  assert.equal(f.input("Wi-Fi password").props.type, "text");
  assert.equal(f.input("Wi-Fi password").props.value, "fixture-password");
  assert.equal(f.button("Hide Wi-Fi password").props["aria-pressed"], true);
  f.button("Hide Wi-Fi password").props.onClick(); f.render();
  assert.equal(f.input("Wi-Fi password").props.type, "password");
  f.button("Show Wi-Fi password").props.onClick(); f.render();
  await f.submit();
  assert.equal(f.transferred.password, "fixture-password");
  assert.equal(all(f.tree).some(n => n.type === "input"), false);
  assert.doesNotMatch(text(f.tree), /fixture-password/);
});

test("claim excludes PIN and encrypted transfer receives its one-time setup token", async () => {
  const f = fixture(); await f.wifi(); await f.finishScan(["Office"]);
  f.change("Wi-Fi network", "Office"); await f.submit();
  assert.equal("pin" in f.claims[0], false);
  assert.equal(f.transferred.setup_token, "a".repeat(64));
  assert.doesNotMatch(text(f.tree), new RegExp("a".repeat(64)));
});

test("a claim-start failure does not imply Wi-Fi settings were saved", async () => {
  const f = fixture({ claimError: "This device is not available for this group." }); await f.wifi(); await f.finishScan(["Office"]);
  f.change("Wi-Fi network", "Office"); await f.submit();
  assert.match(text(f.tree), /This device is not available/);
  assert.doesNotMatch(text(f.tree), /If Wi-Fi settings were already saved/);
  assert.equal(f.transferred, undefined);
});

test("wrong hardware PIN prevents any registration request", async () => {
  const f = fixture({ authError: "The hardware PIN is incorrect." }); await f.wifi();
  assert.match(text(f.tree), /hardware PIN is incorrect/);
  assert.equal(f.claims.length, 0);
  assert.equal(f.transferred, undefined);
});

test("expired confirmation gives recovery guidance and never reports registration success", async () => {
  const f = fixture(); await f.wifi(); await f.finishScan(["Office"]);
  f.change("Wi-Fi network", "Office"); await f.submit(); await f.poll("expired");
  assert.match(text(f.tree), /Setup confirmation expired/);
  assert.match(text(f.tree), /BOOT/);
  assert.doesNotMatch(text(f.tree), /The sensor is registered\./);
  assert.match(text(f.find(n => n.props["aria-current"] === "step")), /Finish/);
});
