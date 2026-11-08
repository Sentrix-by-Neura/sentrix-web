import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const group = { id: "old-group", name: "Server room", slug: "server-room", meshId: "AABBCCDDEEFF" };
const archived = { id: "old-device", groupId: group.id, name: "Transferred sensor", macAddress: "24:6F:28:C2:5E:19", status: "OFFLINE", archivedAt: "2026-10-25T01:00:00Z", lastSeen: new Date().toISOString() };
const alert = { id: "old-alert", deviceId: archived.id, groupId: group.id, isResolved: false, userFeedback: null, severity: "CRITICAL", timestamp: new Date().toISOString(), actualValue: 10, expectedMin: 0, expectedMax: 5 };

function renderRoute(path, { devices = [archived], sensorId = archived.id, expectedTelemetryId } = {}) {
  const source = readFileSync(new URL(`../app/${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, Date, require: name => {
    if (name === "react" || name === "react/jsx-runtime") return require(name);
    if (name === "next/link") return { default: ({ children, href, ...props }) => createElement("a", { href, ...props }, children) };
    if (name === "next/navigation") return { useParams: () => ({ groupName: group.slug, sensorId }), useRouter: () => ({ push() {} }) };
    if (name.endsWith("sentrix-store")) return {
      useSentrix: () => ({ ready: true, groups: [group], devices, alerts: [alert] }),
      findGroup: () => group,
      hasRecentContact: device => !device.archivedAt && device.status !== "OFFLINE" && device.mqttConnected !== false && !!device.lastSeen,
      useOperatingState: id => { if (expectedTelemetryId) assert.equal(id, expectedTelemetryId); return { reading: null, loading: false, error: null }; },
      useTelemetry: id => { if (expectedTelemetryId) assert.equal(id, expectedTelemetryId); return { points: [{ timestamp: "2026-10-24T01:00:00Z", rmsCurrent: 2, lowerBound: 0, upperBound: 5 }], loading: false, error: null }; },
    };
    if (name.endsWith("sentrix-bluetooth")) return {};
    if (name.endsWith("confirm-modal")) return { useConfirm: () => () => {} };
    if (name.endsWith("ble-onboarding-modal")) return { BleOnboardingModal: () => null };
    if (name.endsWith("telemetry-chart")) return { TelemetryChart: () => createElement("div", null, "Preserved telemetry chart") };
    if (name.endsWith("telemetry-export")) return { TelemetryExport: ({ deviceId }) => { if (expectedTelemetryId) assert.equal(deviceId, expectedTelemetryId); return createElement("button", null, "Export all data (CSV)"); } };
    if (name.endsWith("operating-metrics")) return { OperatingMetrics: () => createElement("div", null, "Operating metrics") };
    if (name.endsWith("app-shell")) return { AppShell: ({ children }) => children };
    if (name.endsWith(".module.css")) return { default: {} };
    if (name.endsWith("tokens.css")) return {};
    throw new Error(`Unexpected dependency ${name}`);
  } });
  return renderToStaticMarkup(createElement(exports.default));
}

test("group cards label transferred devices as preserved history", () => {
  const html = renderRoute("dashboard/[groupName]/page.tsx");
  assert.match(html, /Transferred.*history only/);
  assert.match(html, /View preserved history/);
  assert.doesNotMatch(html, /Waiting for device/);
});
test("archived detail keeps its chart and removes live monitoring and alert controls", () => {
  const html = renderRoute("dashboard/[groupName]/[sensorId]/page.tsx");
  assert.match(html, /Preserved telemetry chart/);
  assert.match(html, /Export all data \(CSV\)/);
  assert.match(html, /Transferred, history only/);
  assert.doesNotMatch(html, /Real-Time RMS Current|>Waiting<|>Valid Issue<|>False Alarm<|>Resolve</);
});
test("archived sensors and alerts do not count toward current dashboard health", () => {
  const html = renderRoute("dashboard/page.tsx");
  assert.match(html, /0 sensors registered/);
  assert.match(html, /No unresolved recent alerts/);
  assert.doesNotMatch(html, /Anomalies Detected/);
});
test("preserved historical alerts remain readable without mutation buttons", () => {
  const html = renderRoute("alerts/page.tsx");
  assert.match(html, /Archived sensor history/);
  assert.doesNotMatch(html, /Mark as Resolved|>Valid Issue<|>False Alarm</);
});
test("legacy MAC routes prefer the current device in the selected group", () => {
  const active = { ...archived, id: "current-device", archivedAt: null, status: "ACTIVE" };
  const html = renderRoute("dashboard/[groupName]/[sensorId]/page.tsx", { devices: [archived, active], sensorId: archived.macAddress, expectedTelemetryId: active.id });
  assert.doesNotMatch(html, /Your monitoring history is preserved/);
  assert.match(html, /Connected/);
});
test("group and detail show unavailable ahead of calibration and active monitoring", () => {
  for (const path of ["dashboard/[groupName]/page.tsx", "dashboard/[groupName]/[sensorId]/page.tsx"]) {
    for (const status of ["CALIBRATING", "ACTIVE"]) {
      const current = { ...archived, archivedAt: null, status, mqttConnected: false };
      const html = renderRoute(path, { devices: [current] });
      assert.match(html, /Unavailable/);
      assert.doesNotMatch(html, />\s*Calibrating\s*<|>\s*Monitoring [Aa]ctive\s*<|>\s*Connected\s*</);
      const recovered = renderRoute(path, { devices: [{ ...current, mqttConnected: true }] });
      assert.match(recovered, status === "CALIBRATING" ? /Calibrating/ : path.endsWith("[sensorId]/page.tsx") ? /Connected/ : /Monitoring [Aa]ctive/);
    }
  }
});
