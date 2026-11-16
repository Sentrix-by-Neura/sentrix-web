import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(path, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, require: name => dependencies[name] ?? require(name), ...globals });
  return exports;
}
const translations = load("../app/lib/translations.ts");

function fixture(saved, blocked = false) {
  let state, effect, context;
  const storage = new Map(saved === undefined ? [] : [["sentrix-language", saved]]);
  const document = { documentElement: { lang: "en" } };
  const react = {
    createContext: value => { context = { value }; return context; },
    useContext: () => context.value,
    useState: initial => { state ??= initial; return [state, next => { state = next; }]; },
    useEffect: fn => { effect = fn; },
  };
  const api = load("../app/lib/language-context.tsx", { react, "./translations": translations }, {
    document,
    requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame() {},
    localStorage: {
      getItem: key => { if (blocked) throw new Error("Blocked"); return storage.get(key) ?? null; },
      setItem: (key, value) => { if (blocked) throw new Error("Blocked"); storage.set(key, value); },
    },
  });
  const render = () => { context.value = api.LanguageProvider({ children: null }).props.value; return context.value; };
  return { api, render, mount: () => { render(); effect(); return render(); }, storage, document };
}

test("first render and missing or invalid saved values default to English", () => {
  for (const saved of [undefined, "fr", "ID", "", "id"]) {
    const f = fixture(saved);
    assert.equal(f.render().language, "en");
    assert.equal(f.render().t("Log in"), "Log in");
    assert.equal(f.mount().language, saved === "id" ? "id" : "en");
  }
});

test("language switches both ways, updates the document language and survives remount", () => {
  const f = fixture();
  f.mount().setLanguage("id");
  assert.equal(f.render().t("Log in"), "Masuk");
  assert.equal(f.document.documentElement.lang, "id");
  assert.equal(fixture(f.storage.get("sentrix-language")).mount().language, "id");
  f.render().setLanguage("en");
  assert.equal(f.render().t("Log in"), "Log in");
  assert.equal(f.storage.get("sentrix-language"), "en");
  assert.equal(f.document.documentElement.lang, "en");
});

test("blocked storage does not prevent switching and unknown messages are preserved", () => {
  const f = fixture(undefined, true);
  f.mount().setLanguage("id");
  assert.equal(f.render().language, "id");
  assert.equal(f.render().t("AC unit 42 <name>"), "AC unit 42 <name>");
  assert.equal(f.render().t(""), "");
  assert.equal(f.render().t("__proto__"), "__proto__");
});

test("EN and ID are accessible buttons whose clicks change the shared preference", () => {
  const f = fixture();
  f.mount();
  const { LanguageToggle } = load("../app/components/language-toggle.tsx", { "../lib/language-context": f.api });
  let tree = LanguageToggle();
  let buttons = tree.props.children;
  assert.deepEqual(Array.from(buttons, button => button.props.children), ["EN", "ID"]);
  assert.equal(buttons[0].props["aria-pressed"], true);
  assert.equal(buttons[1].props["aria-label"], "Bahasa Indonesia");
  buttons[1].props.onClick(); f.render();
  tree = LanguageToggle(); buttons = tree.props.children;
  assert.equal(tree.props["aria-label"], "Bahasa");
  assert.equal(buttons[1].props["aria-pressed"], true);
  buttons[0].props.onClick(); f.render();
  assert.equal(LanguageToggle().props.children[0].props["aria-pressed"], true);
});

test("every literal translation call has a nonempty Indonesian entry", () => {
  const root = new URL("../app/", import.meta.url);
  const missing = [];
  const check = (key, file) => { if (typeof translations.indonesian[key] !== "string" || !translations.indonesian[key].trim()) missing.push(`${file}: ${key}`); };
  for (const file of readdirSync(root, { recursive: true }).filter(file => file.endsWith(".tsx"))) {
    const source = ts.createSourceFile(file, readFileSync(new URL(file.replaceAll("\\", "/"), root), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function strings(node) {
      if (ts.isStringLiteral(node)) check(node.text, file);
      else if (ts.isConditionalExpression(node)) { strings(node.whenTrue); strings(node.whenFalse); }
    }
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t" && node.arguments[0]) strings(node.arguments[0]);
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "T") {
        const text = node.children.filter(ts.isJsxText).map(child => child.text).join("").trim();
        if (text) check(text, file);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual(missing, []);
});

test("landing and auth render both languages with the toggle before Log in", () => {
  for (const language of ["en", "id"]) {
    const languageApi = { useLanguage: () => ({ language, setLanguage() {}, t: text => language === "id" ? translations.indonesian[text] ?? text : text }) };
    const toggle = load("../app/components/language-toggle.tsx", { "../lib/language-context": languageApi });
    const common = {
      "next/link": { default: ({ children, ...props }) => createElement("a", props, children) },
      "next/image": { default: () => null },
    };
    const home = load("../app/page.tsx", {
      ...common,
      "./lib/language-context": languageApi,
      "./components/language-toggle": toggle,
      "./components/brand": { Brand: () => createElement("span", null, "Sentrix") },
      "./components/landing-circuit": { LandingCircuit: () => null },
      "./components/landing-motion": { useLandingMotion() {} },
      "./components/account-dropdown": { AccountDropdown: () => null },
      "./lib/sentrix-store": { useSentrix: () => ({ userProfile: {}, userId: null }) },
      "./lib/supabase-browser": { supabase: null },
      "./lib/use-disclosure": { useDisclosure: () => ({ open: false, setOpen() {} }) },
    });
    const html = renderToStaticMarkup(createElement(home.default));
    assert.match(html, language === "id" ? /Deteksi gangguan AC lebih awal/ : /Catch AC faults early/);
    assert.match(html, language === "id" ? /Spesifikasi Sistem/ : /System Specs/);
    const header = html.slice(0, html.indexOf("</header>"));
    assert.ok(header.indexOf('aria-label="English"') < header.indexOf('href="/login"'));
    assert.match(header, /aria-label="Bahasa Indonesia"/);

    const auth = load("../app/components/auth-form.tsx", {
      ...common,
      "next/navigation": { useRouter: () => ({ push() {} }) },
      "../lib/language-context": languageApi,
      "./language-toggle": toggle,
      "./brand": { Brand: () => null },
      "../lib/supabase-browser": { isSupabaseConfigured: false, supabase: null },
    });
    for (const mode of ["login", "signup"]) {
      const form = renderToStaticMarkup(createElement(auth.AuthForm, { mode }));
      assert.match(form, language === "id" ? /Kata sandi/ : /Password/);
      assert.match(form, language === "id" ? /Minimal 8 karakter/ : /At least 8 characters/);
      assert.match(form, /name="email"/);
      assert.match(form, /name="password"/);
    }
  }
});
