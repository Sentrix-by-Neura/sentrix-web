"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Brand } from "./brand";
import { useLanguage } from "../lib/language-context";
import { LanguageToggle } from "./language-toggle";
import { isSupabaseConfigured, supabase } from "../lib/supabase-browser";

type AuthFormProps = {
  mode: "login" | "signup";
};

function AuthArtwork() {
  const { t } = useLanguage();
  return (
    <aside className="relative hidden min-h-screen overflow-hidden border-l border-[var(--border)] bg-[var(--surface)] lg:flex lg:flex-col lg:justify-center lg:p-10 xl:p-14">
      <div className="absolute -right-36 top-12 h-96 w-96 rounded-full bg-amber-500/[0.09] blur-[100px]" />
      <div className="absolute -left-36 bottom-8 h-80 w-80 rounded-full bg-orange-800/[0.08] blur-[100px]" />
      <div className="relative">
        <h2 className="max-w-lg text-4xl font-semibold leading-tight tracking-[-0.06em] text-[var(--text-primary)] xl:text-5xl">
          {t("See the signal.")}
          <br />
          <span className="text-[var(--text-muted)]">{t("Waste less cooling energy.")}</span>
        </h2>
      </div>
    </aside>
  );
}

export function AuthForm({ mode }: AuthFormProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [unconfirmedLoginEmail, setUnconfirmedLoginEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendFeedback, setResendFeedback] = useState("");

  const isSignup = mode === "signup";

  async function handleResendVerification(targetEmail: string) {
    if (!isSupabaseConfigured || !supabase || !targetEmail) return;
    setResendStatus("sending");
    setResendFeedback("");

    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : undefined;

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    if (error) {
      setResendStatus("error");
      setResendFeedback(error.message);
    } else {
      setResendStatus("sent");
      setResendFeedback("Verification link sent! Check your inbox and spam folder.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setResendFeedback("");
    setUnconfirmedLoginEmail(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!isSupabaseConfigured || !supabase) {
      setFormError("Sign-in is temporarily unavailable. Please try again later.");
      return;
    }

    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : undefined;

    setIsSubmitting(true);

    const result = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: String(formData.get("name") ?? "").trim() },
            emailRedirectTo: callbackUrl,
          },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    setIsSubmitting(false);

    if (result.error) {
      const isUnconfirmed =
        result.error.message.toLowerCase().includes("email not confirmed") ||
        result.error.message.toLowerCase().includes("email is not confirmed");

      if (isUnconfirmed) {
        setUnconfirmedLoginEmail(email);
        setFormError("Your email has not been verified yet. You must verify your email before logging in.");
      } else {
        setFormError(result.error.message);
      }
      return;
    }

    if (isSignup) {
      // If user requires email confirmation (session is null or email_confirmed_at is null)
      if (!result.data.session || (result.data.user && !result.data.user.email_confirmed_at)) {
        setSubmittedEmail(email);
        return;
      }
      // If session is present and confirmed (or auto-confirm is enabled in Supabase)
      router.push("/dashboard");
      return;
    }

    // Login mode: double-check that email is confirmed
    if (result.data.user && !result.data.user.email_confirmed_at && !result.data.user.confirmed_at) {
      await supabase.auth.signOut();
      setUnconfirmedLoginEmail(email);
      setFormError("Your email has not been verified yet. You must verify your email before logging in.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="grid min-h-screen bg-[var(--canvas)] text-[var(--text-primary)] transition-colors duration-200 lg:grid-cols-[minmax(420px,0.88fr)_minmax(0,1.12fr)]">
      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-12 xl:px-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Brand />
          <LanguageToggle />
          <Link
            href="/"
            className="text-xs text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
          >
            {t("Back to home")}
          </Link>
        </div>

        {/* Verification Sent Screen */}
        {submittedEmail ? (
          <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-12">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500 shadow-lg shadow-amber-500/5">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-500 border border-amber-500/20">
                {t("Action Required")}
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.055em] text-[var(--text-primary)]">
              {t("Verify your email")}
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              {t("We sent a verification link to")}{" "}
              <strong className="font-semibold text-[var(--text-primary)]">{submittedEmail}</strong>.
              {t("You must verify your email before you can log in.")}
            </p>

            <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs text-[var(--text-muted)] space-y-2">
              <p className="font-medium text-[var(--text-secondary)]">{t("Haven't received the email?")}</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>{t("Check your Spam, Junk, or Promotions folder.")}</li>
                <li>{t("Verify you typed your email address correctly.")}</li>
                <li>{t("Wait 1–2 minutes, or click below to resend.")}</li>
              </ul>
            </div>

            {resendFeedback && (
              <p
                role="status"
                className={`mt-4 rounded-lg border px-3 py-2.5 text-center text-xs leading-5 ${
                  resendStatus === "sent"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
                }`}
              >
                {t(resendFeedback)}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                disabled={resendStatus === "sending"}
                onClick={() => handleResendVerification(submittedEmail)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 text-xs font-semibold text-[#17140d] transition hover:bg-amber-400 disabled:opacity-60"
              >
                {t(resendStatus === "sending" ? "Resending email…" : "Resend Verification Email")}
              </button>

              <Link
                href="/login"
                className="flex h-11 w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                {t("Back to Log In")}
              </Link>
            </div>
          </div>
        ) : (
          /* Normal Auth Form */
          <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-12">
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.055em] text-[var(--text-primary)] sm:text-4xl">
              {t(isSignup ? "Create your account" : "Log in to Sentrix")}
            </h1>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {isSignup && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    {t("Full name")}
                  </span>
                  <input
                    autoComplete="name"
                    required
                    name="name"
                    placeholder="Alex Morgan"
                    className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/10"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  {t("Email")}
                </span>
                <input
                  autoComplete="email"
                  required
                  type="email"
                  name="email"
                  placeholder="you@company.com"
                  className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/10"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  {t("Password")}
                </span>
                <div className="relative">
                  <input
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    required
                    minLength={8}
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder={t("At least 8 characters")}
                    className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 pr-16 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-3 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-label={t(showPassword ? "Hide password" : "Show password")}
                  >
                    {t(showPassword ? "Hide" : "Show")}
                  </button>
                </div>
              </label>
              {isSignup && (
                <label className="flex items-start gap-2.5 pt-1 text-sm leading-5 text-[var(--text-secondary)]">
                  <input
                    required
                    type="checkbox"
                    className="mt-1 accent-amber-500"
                  />
                  <span>
                    {t("I agree to Sentrix’s")}{" "}
                    <Link href="/terms" target="_blank" rel="noopener" className="underline underline-offset-2" aria-label={t("Terms of Service (opens in a new tab)")}>
                      {t("Terms of Service")}
                    </Link>{" "}
                    {t("and")}{" "}
                    <Link href="/privacy" target="_blank" rel="noopener" className="underline underline-offset-2" aria-label={t("Privacy Policy (opens in a new tab)")}>
                      {t("Privacy Policy")}
                    </Link>.
                  </span>
                </label>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 text-xs font-semibold text-[#17140d] transition hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60"
              >
                {t(isSubmitting ? "Connecting…" : isSignup ? "Create Account" : "Log In")}
                {!isSubmitting && <span aria-hidden="true">→</span>}
              </button>
            </form>

            {formError && (
              <div
                role="status"
                className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3 text-left text-xs leading-5 text-[var(--text-primary)]"
              >
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 shrink-0">⚠️</span>
                  <p className="text-xs text-[var(--text-secondary)]">{t(formError)}</p>
                </div>

                {unconfirmedLoginEmail && (
                  <div className="mt-3 border-t border-amber-500/20 pt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {t("Didn't get or lost the link?")}
                    </span>
                    <button
                      type="button"
                      disabled={resendStatus === "sending"}
                      onClick={() => handleResendVerification(unconfirmedLoginEmail)}
                      className="text-[11px] font-semibold text-amber-500 hover:text-amber-400 underline disabled:opacity-50"
                    >
                      {t(resendStatus === "sending" ? "Sending…" : "Resend Verification Email")}
                    </button>
                  </div>
                )}

                {resendFeedback && (
                  <p
                    className={`mt-2 text-[11px] ${
                      resendStatus === "sent" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {t(resendFeedback)}
                  </p>
                )}
              </div>
            )}

            <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
              {t(isSignup ? "Already have an account?" : "New to Sentrix?")}{" "}
              <Link
                href={isSignup ? "/login" : "/signup"}
                className="font-medium text-amber-500 transition hover:text-amber-400"
              >
                {t(isSignup ? "Log in" : "Create an account")}
              </Link>
            </p>
          </div>
        )}

        <div className="flex justify-between font-mono text-[8px] uppercase tracking-widest text-[var(--text-muted)]" />
      </section>
      <AuthArtwork />
    </main>
  );
}
