"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { Brand } from "./brand";
import { AccountDropdown } from "./account-dropdown";
import { useSentrix } from "../lib/sentrix-store";
import { useTheme } from "../lib/theme-context";
import { ThemeToggle } from "./theme-toggle";
import { SentrixContextMenu } from "./context-menu";
import { useDisclosure } from "../lib/use-disclosure";
import { isSupabaseConfigured, supabase } from "../lib/supabase-browser";

const workspaceContainer = "mx-auto box-content max-w-6xl px-4 sm:px-6 lg:px-8";

function DashboardLink({ active = false }: { active?: boolean }) {
  return (
    <Link
      href="/dashboard"
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      }`}
    >
      Dashboard
    </Link>
  );
}

function ActiveDashboardLink() {
  const pathname = usePathname();
  return <DashboardLink active={pathname.startsWith("/dashboard")} />;
}

function NotificationsBell() {
  const { alerts, devices, ready, error } = useSentrix();
  const { open, setOpen, triggerRef, panelRef } = useDisclosure();
  const unresolved = alerts
    .filter((alert) => !alert.isResolved && !devices.find(d => d.id === alert.deviceId)?.archivedAt)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className="sm:relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
        aria-label={`Notifications (${unresolved.length} unresolved)`}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {unresolved.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[9px] font-semibold text-white ring-2 ring-[var(--canvas)]">
            {unresolved.length}
          </span>
        )}
      </button>
      {open && (
        <div ref={panelRef} className="surface-card absolute inset-x-4 top-full z-30 mt-2 rounded-xl border border-[var(--border)] p-4 shadow-xl sm:left-auto sm:right-0 sm:top-11 sm:mt-0 sm:w-80">
          <p className="text-sm font-semibold">Notifications</p>
          {unresolved.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              {error ? "Could not refresh alerts." : !ready ? "Loading alerts…" : "No unresolved alerts."}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {unresolved.slice(0, 3).map((alert) => (
                <li key={alert.id} className="rounded-lg border border-[var(--border)] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium">
                      {devices.find((d) => d.id === alert.deviceId)?.name ?? "Unknown device"}
                    </span>
                    <span
                      className={`font-mono text-[8px] font-semibold tracking-widest ${
                        alert.severity === "CRITICAL" ? "text-red-500" : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
                    {alert.actualValue} A vs {alert.expectedMin}–{alert.expectedMax} A expected
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/alerts"
            onClick={() => setOpen(false)}
            className="mt-3 inline-block text-xs font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400"
          >
            View all alerts →
          </Link>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const { userProfile, userId, ready, error, refreshData } = useSentrix();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) { router.replace("/login"); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const user = data.session.user;
      if (user && !user.email_confirmed_at && !user.confirmed_at) {
        void supabase?.auth.signOut().then(() => {
          router.replace("/login");
        });
      }
    });
  }, [router]);

  useEffect(() => {
    if (ready && !userId) router.replace("/login");
  }, [ready, userId, router]);

  return (
    <div
      className={`dashboard-shell min-h-screen bg-[var(--canvas)] text-[var(--text-primary)] ${
        isDark ? "dark" : "light"
      }`}
      data-theme={isDark ? "dark" : "light"}
    >
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--header)] backdrop-blur">
        <div className={`${workspaceContainer} flex items-center justify-between py-3`}>
          <div className="flex items-center gap-6">
            <Brand href="/dashboard" />
            <nav
              aria-label="Main navigation"
              className="hidden items-center gap-1 lg:flex"
            >
              <Suspense fallback={<DashboardLink />}>
                <ActiveDashboardLink />
              </Suspense>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <NotificationsBell />
            <div className="hidden h-8 w-px bg-[var(--border)] lg:block" />

            {userId && <AccountDropdown key={userId} {...userProfile} redirectOnLogout />}
          </div>
        </div>
      </header>
      <main className={`${workspaceContainer} pb-16 pt-6 sm:pt-8`}>
        {(!ready || !userId) && <p role="status" className="mb-4 text-sm">{error || "Checking your session…"}</p>}
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-500/30 p-4 text-sm text-red-500">{error} <button type="button" onClick={() => { void refreshData(); }} className="underline">Retry</button></div>}{children}
      </main>

      {/* Context-aware Right-Click Menu */}
      <SentrixContextMenu isDark={isDark} onToggleTheme={toggleTheme} />
    </div>
  );
}
