"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { indonesian } from "./translations";

export type Language = "en" | "id";
const storageKey = "sentrix-language";

export function translate(language: Language, text: string): string {
  return language === "id" && Object.hasOwn(indonesian, text) ? indonesian[text] : text;
}

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (text: string) => string;
}>({
  language: "en" as Language,
  setLanguage: () => {},
  t: (text: string) => text,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved === "en" || saved === "id") {
          setLanguageState(saved);
          document.documentElement.lang = saved;
        }
      } catch {
        // Storage can be disabled; switching still works for this visit.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function setLanguage(next: Language) {
    setLanguageState(next);
    document.documentElement.lang = next;
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Storage can be disabled; switching still works for this visit.
    }
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: (text) => translate(language, text) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function T({ children }: { children: string }) {
  const { t } = useLanguage();
  return t(children);
}
