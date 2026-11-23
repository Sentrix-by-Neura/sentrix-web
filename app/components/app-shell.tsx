"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { Brand } from "./brand";
import { AccountDropdown } from "./account-dropdown";
import { LanguageToggle } from "./language-toggle";
import { QuickStartGuide } from "./quick-start-guide";
import { useLanguage } from "../lib/language-context";
import { useSentrix } from "../lib/sentrix-store";
import { useTheme } from "../lib/theme-context";
import { SentrixContextMenu } from "./context-menu";
import { isSupabaseConfigured, supabase } from "../lib/supabase-browser";

const workspaceContainer = "mx-auto box-content max-w-6xl px-4 sm:px-6 lg:px-8";

function DashboardLink({ active = false }: { active?: boolean }) {
  const { t } = useLanguage();
  return (
    <Link
      href="/dashboard"
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      }`}
    >
      {t("Dashboard")}
    </Link>
  );
}

function ActiveDashboardLink() {
  const pathname = usePathname();
  return <DashboardLink active={pathname.startsWith("/dashboard")} />;
}

function AlertsLink() {
  const { t } = useLanguage();
  const { alerts, devices } = useSentrix();
  const unresolvedCount = alerts.filter(
    alert => !alert.isResolved && !devices.find(device => device.id === alert.deviceId)?.archivedAt
  ).length;

  return (
    <Link
      href="/alerts"
      aria-label={unresolvedCount > 0 ? `${t("Alerts")} (${unresolvedCount} ${t("unresolved")})` : t("Alerts")}
      title={t("Alerts")}
      className="relative flex size-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
    >
      <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
      {unresolvedCount > 0 && (
        <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[0.6875rem] font-semibold text-white ring-2 ring-[var(--canvas)]">
          {unresolvedCount}
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { isDark } = useTheme();
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
              aria-label={t("Main navigation")}
              className="hidden items-center gap-1 lg:flex"
            >
              <Suspense fallback={<DashboardLink />}>
                <ActiveDashboardLink />
              </Suspense>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <QuickStartGuide autoOpen={ready && !!userId} />
            <LanguageToggle />
            <AlertsLink />
            <div className="hidden h-8 w-px bg-[var(--border)] lg:block" />

            {userId && <AccountDropdown key={userId} {...userProfile} redirectOnLogout />}
          </div>
        </div>
      </header>
      <main className={`${workspaceContainer} pb-16 pt-6 sm:pt-8`}>
        {(!ready || !userId) && <p role="status" className="mb-4 text-sm">{t(error || "Checking your session…")}</p>}
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-500/30 p-4 text-sm text-red-500">{t(error)} <button type="button" onClick={() => { void refreshData(); }} className="underline">{t("Retry")}</button></div>}{children}
      </main>

      {/* Context-aware Right-Click Menu */}
      <SentrixContextMenu />
    </div>
  );
}
