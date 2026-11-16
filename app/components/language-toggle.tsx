"use client";

import { useLanguage } from "../lib/language-context";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <div role="group" aria-label={language === "en" ? "Language" : "Bahasa"} className="inline-flex shrink-0 rounded-lg border border-[var(--border)] p-0.5">
      {(["en", "id"] as const).map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-label={option === "en" ? "English" : "Bahasa Indonesia"}
          aria-pressed={language === option}
          onClick={() => setLanguage(option)}
          className={`min-h-10 min-w-10 cursor-pointer rounded-md px-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${language === option ? "bg-amber-500 text-[#17140d]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] active:bg-[var(--border)]"}`}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
