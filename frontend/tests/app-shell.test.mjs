import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/components/app-shell.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
});

function renderShell(session) {
  const exports = {};
  const Link = ({ children, href, ...props }) => createElement("a", { href, ...props }, children);
  runInNewContext(outputText, {
    exports,
    require: name => {
      if (name === "react" || name === "react/jsx-runtime") return require(name);
      if (name === "next/link") return { default: Link };
      if (name === "next/navigation") return { useRouter: () => ({ replace() {} }), usePathname: () => "/dashboard" };
      if (name === "./brand") return { Brand: () => createElement("a", { href: "/dashboard" }, "Sentrix") };
      if (name === "./account-dropdown") return { AccountDropdown: () => null };
      if (name === "./context-menu") return { SentrixContextMenu: () => null };
      if (name === "./theme-toggle") return { ThemeToggle: () => null };
      if (name === "../lib/use-disclosure") return { useDisclosure: () => ({ open: false }) };
      if (name === "../lib/theme-context") return { useTheme: () => ({ isDark: true, toggleTheme() {} }) };
      if (name === "../lib/supabase-browser") return { isSupabaseConfigured: false, supabase: null };
      if (name === "../lib/sentrix-store") return { useSentrix: () => ({ userProfile: { name: "User" }, alerts: [], devices: [], refreshData() {}, error: null, ...session }) };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const Route = () => createElement("h1", null, "Route segment rendered");
  return renderToString(createElement(exports.AppShell, null, createElement(Route)));
}

test("pending session keeps the header and route segment in the server render", () => {
  const html = renderShell({ ready: false, userId: null });
  assert.match(html, /Route segment rendered/);
  assert.match(html, /Main navigation/);
  assert.match(html, /Checking your session/);
});

test("missing session does not drop the route while redirect effects are pending", () => {
  assert.match(renderShell({ ready: true, userId: null }), /Route segment rendered/);
});

test("authenticated shell renders the route without the pending-session message", () => {
  const html = renderShell({ ready: true, userId: "operator" });
  assert.match(html, /Route segment rendered/);
  assert.doesNotMatch(html, /Checking your session/);
});
