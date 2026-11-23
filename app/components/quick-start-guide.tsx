"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../lib/language-context";
import { useTheme } from "../lib/theme-context";

const STORAGE_KEY = "sentrix_quick_guide_seen_v1";

const STEPS = [
  {
    badge: "01 / 04",
    title: "What Sentrix Monitors",
    body: "Sentrix tracks the electrical current (RMS Current) of your air conditioners. By learning each unit's normal 7-day pattern, it alerts you early when power draw spikes or drops due to dirty filters, icing, or compressor strain.",
  },
  {
    badge: "02 / 04",
    title: "Groups & AC Sensors",
    body: "Start by creating a Group for a floor, wing, or room. Inside a group, add your Sentrix sensors and give each unit a clear AC name and optional room photo so technicians can locate it fast.",
  },
  {
    badge: "03 / 04",
    title: "Status & Current Charts",
    body: "Recent contact means the sensor is online. The chart shows measured RMS current over time. Use + / − or pinch to zoom on your phone.",
  },
  {
    badge: "04 / 04",
    title: "Reviewing & Resolving Alerts",
    body: "Open Alerts to filter by date, group, or status. Mark each alert as a Valid Issue or False Alarm to improve accuracy, then click Mark as Resolved once the AC has been checked.",
  },
] as const;

export function QuickStartGuide({ autoOpen = false }: { autoOpen?: boolean }) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!autoOpen) return;
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        const timer = window.setTimeout(() => setOpen(true), 250);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // Ignore storage access errors in private browsing.
    }
  }, [autoOpen]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeGuide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function closeGuide() {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage access errors.
    }
  }

  function openGuide() {
    setStep(0);
    setOpen(true);
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={openGuide}
        aria-label={t("Quick Guide")}
        title={t("Quick Guide")}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
      >
        <span aria-hidden="true" className="font-mono text-xs font-bold text-amber-500">?</span>
        <span className="hidden sm:inline">{t("Quick Guide")}</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-guide-title"
          data-theme={isDark ? "dark" : "light"}
          className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-[2px] ${isDark ? "dark" : "light"}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeGuide();
          }}
        >
          <div className="surface-card my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] p-5 text-[var(--text-primary)] shadow-2xl sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                {current.badge}
              </span>
              <button
                type="button"
                onClick={closeGuide}
                aria-label={t("Close guide")}
                className="flex size-9 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            <h2 id="quick-guide-title" className="mt-4 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              {t(current.title)}
            </h2>
            <p className="mt-2 text-base leading-relaxed text-[var(--text-secondary)] sm:text-sm">
              {t(current.body)}
            </p>

            <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
              {STEPS.map((item, idx) => (
                <span
                  key={item.badge}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    idx <= step ? "bg-amber-500" : "bg-[var(--border)]"
                  }`}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={closeGuide}
                className="min-h-10 rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                {t("Skip")}
              </button>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="min-h-10 rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                  >
                    {t("Back")}
                  </button>
                )}
                {isLast ? (
                  <button
                    type="button"
                    onClick={closeGuide}
                    className="min-h-10 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-[#20170a] transition hover:bg-amber-400"
                  >
                    {t("Got it")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="min-h-10 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-[#20170a] transition hover:bg-amber-400"
                  >
                    {t("Next")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
