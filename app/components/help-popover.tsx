"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../lib/theme-context";
import { useLanguage } from "../lib/language-context";

interface HelpPopoverProps {
  label: string;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function HelpPopover({ label, title, children, className = "" }: HelpPopoverProps) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const margin = 12;
      const gap = 8;
      const rect = trigger.getBoundingClientRect();
      const popRect = popover.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = rect.left + rect.width / 2 - popRect.width / 2;
      left = Math.max(margin, Math.min(left, vw - popRect.width - margin));

      let top = rect.bottom + gap;
      if (top + popRect.height > vh - margin && rect.top - gap - popRect.height >= margin) {
        top = rect.top - gap - popRect.height;
      } else {
        top = Math.max(margin, Math.min(top, vh - popRect.height - margin));
      }

      setPos({ top, left });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        style={{ minHeight: "1.375rem", minWidth: "1.375rem" }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={`inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--canvas)] text-[var(--text-muted)] transition hover:border-amber-500/50 hover:text-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
          open ? "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400" : ""
        } ${className}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-[0.75rem] w-[0.75rem]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 7v4.5" />
          <circle cx="8" cy="4.25" r="0.75" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={title || label}
          data-theme={isDark ? "dark" : "light"}
          onClick={(event) => event.stopPropagation()}
          style={{
            position: "fixed",
            top: pos ? `${pos.top}px` : "-9999px",
            left: pos ? `${pos.left}px` : "-9999px",
            visibility: pos ? "visible" : "hidden",
          }}
          className={`surface-card z-50 w-max max-w-[min(20rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-[var(--border)] p-3.5 text-xs leading-relaxed text-[var(--text-secondary)] shadow-xl ${
            isDark ? "dark" : "light"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            {title ? (
              <p className="font-semibold text-[var(--text-primary)]">{title}</p>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("Close dialog")}
              style={{ minHeight: "1.5rem", minWidth: "1.5rem" }}
              className="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            >
              ✕
            </button>
          </div>
          <div className={title ? "mt-2" : "-mt-1 pr-5"}>{children}</div>
        </div>,
        document.body
      )}
    </>
  );
}
