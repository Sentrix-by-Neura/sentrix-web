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

function fixture() {
  const cells = [], effects = [], exports = {}, scans = [];
  let cursor = 0, tree, transferred;
  const points = [], devices = [];
  const hardware = { name: "Sensor", macAddress: "24:6F:28:C2:5E:19", device: { gatt: { disconnect() {} } } };
  const hooks = {
    ...require("react"),
    useState(initial) { const index = cursor++; if (!(index in cells)) cells[index] = initial; return [cells[index], value => { cells[index] = typeof value === "function" ? value(cells[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return cells[index] ??= { current: initial }; },
    useCallback(fn) { cursor++; return fn; },
    useEffect(fn, deps) { const index = cursor++; const previous = cells[index]; if (!previous || deps?.some((d, i) => d !== previous[i])) effects.push(fn); cells[index] = deps; },
  };
  runInNewContext(outputText, { exports, queueMicrotask, Date, Error, require: name => {
    if (name === "react") return hooks;
    if (name === "react/jsx-runtime") return require(name);
    if (name.endsWith("sentrix-store")) return {
      useSentrix: () => ({ userId: "operator", devices, refreshData() {}, claimDevice: async () => ({ id: "claimed" }) }),
      useTelemetry: () => ({ points }),
    };
    if (name.endsWith("sentrix-bluetooth")) return {
      scanSentrixHardware: async () => hardware,
      authenticateSentrixHardware: async () => {},
      scanSentrixWifi: () => { const scan = deferred(); scans.push(scan); return scan.promise; },
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
  return { render, find, button, input, change, submit, wifi, scans, points, devices, get tree() { return tree; }, get transferred() { return transferred; }, async finishScan(names) { scans.at(-1).resolve(names); await tick(); render(); } };
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
  assert.match(text(f.tree), /Settings saved; waiting for backend contact/);
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
