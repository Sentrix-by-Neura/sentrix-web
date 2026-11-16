import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/auth/callback/page.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
});

function renderCallback({ configured = true, query = "" } = {}) {
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require: name => {
      if (name.endsWith("language-context")) return { useLanguage: () => ({ t: text => text, language: "en" }), T: ({ children }) => children };
      if (name.endsWith("language-toggle")) return { LanguageToggle: () => null };
      if (name === "react" || name === "react/jsx-runtime") return require(name);
      if (name === "next/navigation") return {
        useRouter: () => ({ replace() {} }),
        useSearchParams: () => new URLSearchParams(query),
      };
      if (name === "next/link") return { default: ({ children, ...props }) => createElement("a", props, children) };
      if (name.endsWith("/brand")) return { Brand: () => null };
      if (name.endsWith("/supabase-browser")) return {
        isSupabaseConfigured: configured,
        supabase: configured ? {} : null,
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return renderToString(createElement(exports.default));
}

test("missing auth configuration renders an error without waiting for an effect", () => {
  const html = renderCallback({ configured: false });
  assert.match(html, /Authentication service is temporarily unavailable/);
  assert.doesNotMatch(html, /Verifying your email/);
});

test("provider errors render their description immediately, with the error code as fallback", () => {
  assert.match(renderCallback({ query: "error=access_denied&error_description=Link+expired" }), /Link expired/);
  assert.match(renderCallback({ query: "error=access_denied" }), /access_denied/);
});

test("a valid callback keeps the loading state while session verification is pending", () => {
  const html = renderCallback({ query: "code=valid-code" });
  assert.match(html, /Verifying your email/);
  assert.doesNotMatch(html, /Verification Incomplete/);
});
