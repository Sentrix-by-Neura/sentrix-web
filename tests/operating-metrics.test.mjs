import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const now = Date.now();
const device = { id: "sensor", status: "CALIBRATING", archivedAt: null, mqttConnected: true, lastSeen: new Date(now).toISOString() };
const reading = { timestamp: new Date(now).toISOString(), rms_current: 0.12, current_temperature: 27.5, target_temperature: 24, remote_power_on: true, remote_power_observed_at: new Date(now - 3600000).toISOString(), load_active: false };
const storeSource = readFileSync(new URL("../app/lib/sentrix-store.tsx", import.meta.url), "utf8");
const store = {};
runInNewContext(ts.transpileModule(storeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports: store, Date, Set, require: name => name === "react" ? { createContext: () => ({}) } : {},
});
const source = readFileSync(new URL("../app/dashboard/[groupName]/[sensorId]/operating-metrics.tsx", import.meta.url), "utf8");
const component = {};
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports: component, Date, Number, require: name => {
    if (name.endsWith("language-context")) return { useLanguage: () => ({ t: text => text, language: "en" }) };
    if (name.endsWith("sentrix-store")) return store;
    if (name.endsWith("help-popover")) return { HelpPopover: ({ label, children }) => createElement("aside", { "aria-label": label }, children) };
    if (name.endsWith(".module.css")) return { default: {} };
    return require(name);
  },
});
const render = (changes = {}) => renderToStaticMarkup(createElement(component.OperatingMetrics, { device, reading, loading: false, error: null, ...changes }));

test("operating summary shows each measurement once without redundant details", () => {
  const html = render();
  for (const text of [/27.5°C/, /24.0°C/, />ON</, /0.12/]) assert.match(html, text);
  for (const label of ["RMS Current", "Room Temperature", "Target Temperature", "AC Status"]) assert.equal(html.split(`>${label}<`).length - 1, 1);
  assert.doesNotMatch(html, /Normal RMS Current Range|AC Power/);
  assert.match(html, /aria-label="About AC status".*on or off.*watts \(W\)/);
  assert.doesNotMatch(html, /Backend contact|Go service|Last |Command heard|Measured current|standby|Room temperature is measured|Expected safe range|<time/);
  assert.match(render({ reading: { ...reading, remote_power_on: false } }), />OFF</);
});
test("unknown values remain unknown, including a fresh sensor without a remote command", () => {
  const html = render({ reading: { ...reading, current_temperature: null, target_temperature: null, remote_power_on: null, remote_power_observed_at: null, load_active: null } });
  assert.equal((html.match(/Unknown/g) || []).length, 3);
  assert.doesNotMatch(html, />OFF<|NaN|0.0°C/);
});
test("stale samples and explicit disconnects never become current AC off", () => {
  for (const remote_power_on of [true, false]) {
    for (const changes of [{ device: { ...device, mqttConnected: false }, reading: { ...reading, remote_power_on } }, { reading: { ...reading, remote_power_on, timestamp: new Date(now - 100000).toISOString() } }]) {
      const html = render(changes);
      assert.match(html, /Unknown/);
      assert.doesNotMatch(html, />ON<|>OFF<|Last received|showing last reported values/);
    }
  }
  const archive = render({ device: { ...device, archivedAt: new Date(now).toISOString() } });
  assert.match(archive, />ON</);
  assert.match(archive, /27.5°C/);
});
test("failed refresh preserves last values with a visible error and empty data stays honest", () => {
  assert.match(render({ error: "Network unavailable" }), /Could not refresh.*Network unavailable/);
  assert.match(render({ error: "Network unavailable" }), /27.5°C/);
  assert.equal((render({ reading: null }).match(/Unknown/g) || []).length, 4);
  assert.match(render({ reading: null, loading: true }), /aria-busy="true"/);
  assert.match(render({ reading: null, loading: true }), /Loading room temperature/);
  assert.doesNotMatch(render({ reading: null, loading: true }), />OFF<|0.0°C/);
  assert.match(render({ reading: { ...reading, rms_current: NaN } }), /Unknown/);
});
