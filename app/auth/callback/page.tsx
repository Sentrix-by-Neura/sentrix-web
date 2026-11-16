"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Brand } from "../../components/brand";
import { T, useLanguage } from "../../lib/language-context";
import { LanguageToggle } from "../../components/language-toggle";
import { isSupabaseConfigured, supabase } from "../../lib/supabase-browser";

function CallbackContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const callbackError = !isSupabaseConfigured || !supabase
    ? "Authentication service is temporarily unavailable."
    : searchParams.get("error")
      ? searchParams.get("error_description") || searchParams.get("error")
      : null;
  const displayStatus = callbackError ? "error" : status;

  useEffect(() => {
    if (callbackError || !supabase) return;

    const code = searchParams.get("code");

    let isMounted = true;

    async function handleVerification() {
      try {
        if (code && supabase) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (isMounted) {
              setStatus("error");
              setErrorMessage(error.message);
            }
            return;
          }
        }

        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            if (isMounted) {
              setStatus("success");
              setTimeout(() => {
                router.replace("/dashboard");
              }, 1200);
            }
            return;
          }
        }

        // Listener for implicit auth flow
        const { data: authListener } = supabase?.auth.onAuthStateChange((event, session) => {
          if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session) {
            if (isMounted) {
              setStatus("success");
              setTimeout(() => {
                router.replace("/dashboard");
              }, 1200);
            }
          }
        }) ?? { data: { subscription: { unsubscribe: () => {} } } };

        setTimeout(async () => {
          if (!isMounted) return;
          if (supabase) {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              setStatus("success");
              router.replace("/dashboard");
            } else {
              setStatus("error");
              setErrorMessage("Unable to verify your session or link expired. Please log in.");
            }
          }
          authListener.subscription.unsubscribe();
        }, 3000);
      } catch (err) {
        if (isMounted) {
          setStatus("error");
          setErrorMessage(err instanceof Error ? err.message : "Verification failed.");
        }
      }
    }

    void handleVerification();

    return () => {
      isMounted = false;
    };
  }, [searchParams, router, callbackError]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center py-12 text-center">
      {displayStatus === "loading" && (
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            {t("Verifying your email...")}
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            {t("Please wait while Sentrix validates your confirmation token.")}
          </p>
        </div>
      )}

      {displayStatus === "success" && (
        <div className="space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
            {t("Email Verified!")}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {t("Your Sentrix account is now verified and active. Taking you to your dashboard...")}
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-amber-500 px-6 text-xs font-semibold text-[#17140d] transition hover:bg-amber-400"
            >
              {t("Go to Dashboard →")}
            </Link>
          </div>
        </div>
      )}

      {displayStatus === "error" && (
        <div className="space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 border border-red-500/30">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
            {t("Verification Incomplete")}
          </h2>
          <p className="text-xs text-[var(--text-muted)] max-w-sm">
            {t(callbackError || errorMessage || "The verification link may have expired or was already used.")}
          </p>
          <div className="pt-3">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-amber-500 px-5 text-xs font-semibold text-[#17140d] transition hover:bg-amber-400"
            >
              {t("Back to Login")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--text-primary)] px-6 py-10 flex flex-col items-center">
      <div className="w-full max-w-md flex justify-between mb-6">
        <Brand />
        <LanguageToggle />
      </div>
      <Suspense
        fallback={
          <div className="py-20 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3" />
            <p className="text-xs text-[var(--text-muted)]"><T>Verifying session...</T></p>
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </main>
  );
}

