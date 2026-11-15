import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/dashboard/[groupName]/[sensorId]/telemetry-export.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } });
const tick = () => new Promise(resolve => setImmediate(resolve));
const all = node => Array.isArray(node) ? node.flatMap(all) : node?.props ? [node, ...all(node.props.children)] : [];
const text = node => typeof node === "string" ? node : Array.isArray(node) ? node.map(text).join("") : node?.props ? text(node.props.children) : "";

function fixture(zone = "Asia/Jakarta") {
  const cells = [], calls = [], downloads = [], urls = [], revoked = [], cleanups = [], timers = [], exports = {};
  let cursor = 0, tree;
  const react = {
    useState(initial) { const index = cursor++; if (!(index in cells)) cells[index] = initial; return [cells[index], value => { cells[index] = value; }]; },
    useRef(initial) { const index = cursor++; return cells[index] ??= { current: initial }; },
    useEffect(fn) { const index = cursor++; if (!(index in cells)) { cells[index] = true; cleanups.push(fn()); } },
  };
  runInNewContext(outputText, {
    exports, Error, AbortController,
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: zone }) }) },
    URL: { createObjectURL(blob) { urls.push(blob); return "blob:csv-test"; }, revokeObjectURL(url) { revoked.push(url); } },
    document: { body: { appendChild() {} }, createElement() { return { click() { downloads.push({ href: this.href, download: this.download }); }, remove() {} }; } },
    setTimeout: fn => { timers.push(fn); },
    require: name => {
      if (name === "react") return react;
      if (name.endsWith(".module.css")) return { default: {} };
      if (name.endsWith("sentrix-api")) return { telemetryCsv: (...args) => new Promise((resolve, reject) => calls.push({ args, resolve, reject })) };
      return require(name);
    },
  });
  const render = () => { cursor = 0; tree = exports.TelemetryExport({ deviceId: "sensor-id" }); return tree; };
  render();
  return { render, calls, downloads, urls, revoked, timers, unmount: () => cleanups.forEach(fn => fn?.()), get tree() { return tree; }, get button() { return all(tree).find(n => n.type === "button"); } };
}

test("export uses the user's timezone, blocks duplicate clicks and releases the download URL", async () => {
  for (const zone of ["Asia/Jakarta", "America/New_York"]) {
    const f = fixture(zone);
    assert.doesNotMatch(text(f.tree), /your device’s timezone/);
    f.button.props.onClick(); f.render();
    assert.equal(f.button.props.disabled, true);
    assert.equal(f.button.props["aria-busy"], true);
    assert.match(text(f.button), /Exporting/);
    f.button.props.onClick();
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].args[0], "sensor-id");
    assert.equal(f.calls[0].args[1], zone);
    f.calls[0].resolve(new Blob(["csv"])); await tick(); f.render();
    assert.deepEqual(f.downloads, [{ href: "blob:csv-test", download: `sentrix-sensor-id-${zone.replaceAll("/", "-")}.csv` }]);
    assert.equal(f.button.props.disabled, false);
    assert.equal(f.revoked.length, 0);
    f.timers.forEach(fn => fn());
    assert.deepEqual(f.revoked, ["blob:csv-test"]);
  }
});

test("failed exports show an error, create no download and allow retry", async () => {
  const f = fixture();
  f.button.props.onClick();
  f.calls[0].reject(new Error("Network unavailable")); await tick(); f.render();
  assert.match(text(all(f.tree).find(n => n.props.role === "alert")), /Could not export recorded data.*Network unavailable/);
  assert.equal(f.downloads.length, 0);
  assert.equal(f.button.props.disabled, false);
  f.button.props.onClick(); f.render();
  assert.equal(f.calls.length, 2);
  assert.equal(all(f.tree).some(n => n.props.role === "alert"), false);
  f.calls[1].resolve(new Blob(["header-only"])); await tick(); f.render();
  assert.equal(f.downloads.length, 1);
});

test("leaving the sensor page aborts a pending export and prevents a stale download", async () => {
  const f = fixture();
  f.button.props.onClick();
  f.unmount();
  assert.equal(f.calls[0].args[2].aborted, true);
  f.calls[0].resolve(new Blob(["csv"])); await tick();
  assert.equal(f.downloads.length, 0);
  assert.equal(f.urls.length, 0);
});
