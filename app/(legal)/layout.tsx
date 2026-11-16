import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "../components/brand";
import { T } from "../lib/language-context";
import { LanguageToggle } from "../components/language-toggle";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-16 pt-8 sm:px-8 sm:pt-12">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <Brand />
        <LanguageToggle />
        <Link href="/" className="text-sm text-[var(--text-secondary)] underline underline-offset-4">
          <T>Back to home</T>
        </Link>
      </header>
      <article className="space-y-8 leading-relaxed text-[var(--text-secondary)] [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:text-[var(--text-primary)] [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[var(--text-primary)] [&_a]:underline [&_a]:underline-offset-4">
        {children}
      </article>
    </main>
  );
}
