"use client";

import Link from "next/link";
import { useSentrix } from "../lib/sentrix-store";

export function AccountSettingsModal({ isOpen, onClose, onLogout }: { isOpen: boolean; onClose: () => void; onLogout?: () => void }) {
  const { userProfile } = useSentrix();
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onKeyDown={e => { if (e.key === "Escape") onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="account-title" className="surface-card w-full max-w-md space-y-4 rounded-xl border border-[var(--border)] p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 id="account-title" className="text-lg font-semibold">Account</h2><button autoFocus type="button" aria-label="Close account" onClick={onClose}>×</button></div>
      <p>{userProfile.name}</p><p className="break-all text-sm text-[var(--text-muted)]">{userProfile.email}</p><p className="text-sm">{userProfile.role}</p>
      <div className="flex items-center justify-between gap-4"><Link href="/settings" onClick={onClose} className="text-sm text-amber-500">Edit profile</Link><button type="button" onClick={onLogout} className="text-sm text-red-500">Sign out</button></div>
    </section>
  </div>;
}
