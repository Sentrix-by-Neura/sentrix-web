"use client";

import { Suspense, useState, type FormEvent } from "react";
import { AppShell } from "../components/app-shell";
import { useSentrix } from "../lib/sentrix-store";
import { useTheme } from "../lib/theme-context";
import { T, useLanguage } from "../lib/language-context";

function ProfileForm({ initialName }: { initialName: string }) {
  const { t } = useLanguage();
  const { userProfile, updateUserProfile } = useSentrix();
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setResult("");
    try { await updateUserProfile({ name: name.trim() }); setResult("Profile saved."); }
    catch (error) { setResult(error instanceof Error ? error.message : "Could not save profile."); }
    finally { setPending(false); }
  }
  return <form onSubmit={save} className="surface-card space-y-5 rounded-xl border border-[var(--border)] p-4 sm:p-6">
    <h2 className="text-lg font-semibold sm:text-base">{t("Profile")}</h2>
    <label className="block max-w-xl text-base font-medium sm:text-sm">
      {t("Full name")}
      <input required maxLength={100} value={name} onChange={e => setName(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-3 text-base font-normal sm:text-sm" />
    </label>
    <p className="break-all text-base text-[var(--text-secondary)] sm:text-sm">
      <span className="font-medium text-[var(--text-primary)]">{t("Email")}:</span> {userProfile.email}
    </p>
    <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-amber-500 px-5 py-2.5 text-base font-semibold text-stone-950 disabled:opacity-50 sm:text-sm">{t(pending ? "Saving…" : "Save profile")}</button>
    {result && <p role="status" className="text-base sm:text-sm">{t(result)}</p>}
  </form>;
}

function AppearanceSettings() {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <section aria-labelledby="appearance-heading" className="surface-card space-y-4 rounded-xl border border-[var(--border)] p-4 sm:p-6">
      <h2 id="appearance-heading" className="text-lg font-semibold sm:text-base">{t("Appearance")}</h2>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="sr-only">{t("Color theme")}</legend>
        {(["light", "dark"] as const).map(option => (
          <label key={option} className="cursor-pointer">
            <input
              type="radio"
              name="color-theme"
              value={option}
              checked={theme === option}
              onChange={() => setTheme(option)}
              className="peer sr-only"
            />
            <span className="inline-flex min-h-11 min-w-24 items-center justify-center rounded-lg border border-[var(--border)] px-4 text-base text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] peer-checked:border-amber-600/60 peer-checked:bg-amber-500/10 peer-checked:text-[var(--text-primary)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-amber-500 sm:text-sm">
              {t(option === "light" ? "Light" : "Dark")}
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}

function SettingsContent() {
  const { userProfile, userId } = useSentrix();
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold"><T>Settings</T></h1>
      <div className="mt-6 space-y-6">
        <ProfileForm key={userId} initialName={userProfile.name} />
        <AppearanceSettings />
      </div>
    </AppShell>
  );
}
export default function SettingsPage() {
  return <Suspense fallback={<p className="p-8"><T>Loading settings…</T></p>}><SettingsContent /></Suspense>;
}
