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
  exports: component, Date, Number, require: name => name.endsWith("sentrix-store") ? store : require(name),
});
const render = (changes = {}) => renderToStaticMarkup(createElement(component.OperatingMetrics, { device, reading, loading: false, error: null, expectedMin: "0.1", expectedMax: "3.0", ...changes }));

test("operating metrics distinguish room, target, remote command and measured load", () => {
  const html = render();
  for (const text of [/Room temperature/, /27.5°C/, /Last target setpoint/, /24.0°C/, /Last remote power command/, />On</, /Low \/ standby/, /Command heard/, /Last received/]) assert.match(html, text);
  assert.doesNotMatch(html, /Backend contact|Go service/);
});
test("unknown values remain unknown, including a fresh sensor without a remote command", () => {
  const html = render({ reading: { ...reading, current_temperature: null, target_temperature: null, remote_power_on: null, remote_power_observed_at: null, load_active: null } });
  assert.equal((html.match(/Unknown/g) || []).length, 4);
  assert.doesNotMatch(html, />Off<|NaN|0.0°C/);
});
test("stale samples and explicit disconnects never become current AC off", () => {
  for (const changes of [{ device: { ...device, mqttConnected: false } }, { reading: { ...reading, timestamp: new Date(now - 100000).toISOString() } }]) {
    const html = render(changes);
    assert.match(html, /Unavailable/);assert.match(html, /showing last reported values/);
    assert.doesNotMatch(html, />Low \/ standby</);
  }
  const archive = render({ device: { ...device, archivedAt: new Date(now).toISOString() } });
  assert.match(archive, /Last recorded|Last measured activity/);
  assert.match(archive, /Low \/ standby/);
});
test("failed refresh preserves last values with a visible error and empty data stays honest", () => {
  assert.match(render({ error: "Network unavailable" }), /Could not refresh.*Network unavailable/);
  assert.match(render({ error: "Network unavailable" }), /27.5°C/);
  assert.match(render({ reading: null }), /No operating readings recorded yet/);
  assert.match(render({ reading: null, loading: true }), /Loading operating information/);
});
