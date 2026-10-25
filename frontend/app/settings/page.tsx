"use client";

import { Suspense, useState, type FormEvent } from "react";
import { AppShell } from "../components/app-shell";
import { useSentrix } from "../lib/sentrix-store";

function ProfileForm({ initialName }: { initialName: string }) {
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
  return <form onSubmit={save} className="surface-card mt-6 space-y-5 rounded-xl border border-[var(--border)] p-6">
    <h2 className="text-base font-semibold">Profile</h2>
    <label className="block text-sm">Full name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-3" /></label>
    <p className="text-sm">Email: {userProfile.email}</p>
    <p className="text-sm">Role: {userProfile.role}</p>
    <button type="submit" disabled={pending} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 disabled:opacity-50">{pending ? "Saving…" : "Save profile"}</button>
    {result && <p role="status" className="text-sm">{result}</p>}
  </form>;
}
function SettingsContent() {
  const { userProfile, userId } = useSentrix();
  return <AppShell><div className="mx-auto w-full max-w-xl"><h1 className="text-2xl font-semibold">Settings</h1><ProfileForm key={userId} initialName={userProfile.name} /></div></AppShell>;
}
export default function SettingsPage() {
  return <Suspense fallback={<p className="p-8">Loading settings…</p>}><SettingsContent /></Suspense>;
}
