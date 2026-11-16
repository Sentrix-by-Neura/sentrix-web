"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { supabase } from "../lib/supabase-browser";
import { useDisclosure } from "../lib/use-disclosure";
import { ProfileAvatar } from "./profile-avatar";
import { useLanguage } from "../lib/language-context";

export function AccountDropdown({ name, email, avatarUrl, redirectOnLogout = false }: {
  name: string;
  email: string;
  avatarUrl?: string;
  redirectOnLogout?: boolean;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const panelId = useId();
  const { open, setOpen, triggerRef, panelRef } = useDisclosure();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (!supabase || signingOut) return;
    setSigningOut(true);
    setError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setOpen(false);
      if (redirectOnLogout) router.replace("/login");
    } catch {
      setError("Could not log out. Try again.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("Account menu")}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(!open)}
        className="flex size-10 items-center justify-center rounded-full transition hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
      >
        <ProfileAvatar name={name} avatarUrl={avatarUrl} className="size-9 text-xs" />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className="surface-card absolute right-0 top-full z-40 mt-2 w-56 max-w-[calc(100vw-5rem)] rounded-xl border border-[var(--border)] p-1.5 shadow-xl"
        >
          <div className="border-b border-[var(--border)] px-2.5 pb-2 pt-1.5">
            <p className="break-words text-sm font-semibold text-[var(--text-primary)]">{name}</p>
            <p className="mt-0.5 break-all text-xs text-[var(--text-secondary)]">{email}</p>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-lg px-2.5 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          >
            {t("Settings")}
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={signingOut}
            className="block w-full rounded-lg px-2.5 py-2 text-left text-sm text-red-600 hover:bg-[var(--surface-hover)] disabled:opacity-60 dark:text-red-400"
          >
            {t(signingOut ? "Logging out…" : "Log out")}
          </button>
          {error && <p role="alert" className="px-2.5 pb-2 text-xs text-red-600 dark:text-red-400">{t(error)}</p>}
        </div>
      )}
    </div>
  );
}
