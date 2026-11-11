"use client";

import { useRef, useState } from "react";

import Link from "next/link";
import Image from "next/image";
import darkLogo from "../public/images/logo-text-dark.png";
import lightLogo from "../public/images/logo-text-light.png";
import { Brand } from "./components/brand";
import { LandingCircuit } from "./components/landing-circuit";
import { useLandingMotion } from "./components/landing-motion";
import { ThemeToggle } from "./components/theme-toggle";

export default function Home() {
  const landingRef = useRef<HTMLElement>(null);
  useLandingMotion(landingRef);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [prototypeImageSrc, setPrototypeImageSrc] = useState("/images/esp32-sensor-prototype.jpeg");

  return (
    <main ref={landingRef} className="min-h-screen bg-[var(--canvas)] font-sans text-[var(--text-primary)] transition-colors duration-200">
      {/* 1. Sticky Top Header (Larger & Clearer with Mobile & Tablet Hamburger) */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--canvas)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1344px] items-center justify-between px-6 sm:px-8">
          <div data-landing-intro className="shrink-0">
            <Brand />
          </div>

          <nav data-landing-intro className="hidden items-center gap-6 xl:gap-8 text-sm xl:text-base font-medium text-[var(--text-secondary)] lg:flex">
            <a className="whitespace-nowrap transition hover:text-[var(--text-primary)]" href="#overview">
              Overview
            </a>
            <a className="whitespace-nowrap transition hover:text-[var(--text-primary)]" href="#how-it-works">
              How It Works
            </a>
            <a className="whitespace-nowrap transition hover:text-[var(--text-primary)]" href="#specifications">
              System Specs
            </a>
          </nav>

          {/* Desktop Actions */}
          <div data-landing-intro className="hidden items-center gap-3 xl:gap-4 lg:flex shrink-0">
            <ThemeToggle showLabel={false} />
            <Link
              href="/login"
              className="whitespace-nowrap rounded-lg px-3.5 xl:px-4 py-2.5 text-sm xl:text-base font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            >
              Log in
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg bg-amber-500 px-4 xl:px-5 text-sm xl:text-base font-semibold text-[#17140d] transition hover:bg-amber-400"
            >
              Open Dashboard
            </Link>
          </div>

          {/* Mobile & Tablet Actions: ThemeToggle + Hamburger Button (< lg) */}
          <div data-landing-intro className="flex items-center gap-2 lg:hidden">
            <ThemeToggle showLabel={false} />
            <button
              type="button"
              id="mobile-nav-toggle"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Dropdown Drawer Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-[var(--border)] bg-[var(--canvas)]/98 px-5 sm:px-8 py-5 shadow-2xl backdrop-blur-xl lg:hidden animate-in slide-in-from-top-2 duration-200">
            <nav className="mx-auto max-w-lg flex flex-col space-y-1">
              <a
                href="#overview"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3.5 py-2.5 text-base font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:text-amber-500 transition"
              >
                Overview
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3.5 py-2.5 text-base font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:text-amber-500 transition"
              >
                How It Works
              </a>
              <a
                href="#specifications"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3.5 py-2.5 text-base font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:text-amber-500 transition"
              >
                System Specs
              </a>
              <div className="my-2 border-t border-[var(--border)] pt-3 flex flex-col sm:flex-row gap-2.5">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-11 flex-1 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition"
                >
                  Log In
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-11 flex-1 items-center justify-center rounded-lg bg-amber-500 text-sm font-semibold text-[#17140d] hover:bg-amber-400 transition"
                >
                  Open Dashboard
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <section className="relative isolate overflow-hidden px-6 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24 lg:pt-28">
        <svg
          aria-hidden="true"
          viewBox="0 0 1000 620"
          fill="none"
          className="pointer-events-none absolute -right-40 top-0 -z-10 w-[42rem] max-w-none text-amber-500 opacity-50 sm:-right-32 sm:w-[52rem] sm:opacity-60 lg:-right-36 lg:w-[66rem] lg:opacity-100"
        >
          <g stroke="currentColor" strokeWidth="2" opacity=".18">
            <path d="M1000 116H776L700 192H586L534 244H420" />
            <path d="M1000 296H512" />
            <path d="M1000 338H808L716 430H584L526 488H408" />
            <path d="M1000 380H850L748 482H634" />
            <path d="M1000 492H904L824 572H712" />
            <circle cx="414" cy="244" r="6" />
            <circle cx="506" cy="296" r="6" />
            <circle cx="402" cy="488" r="6" />
            <circle cx="628" cy="482" r="6" />
            <circle cx="706" cy="572" r="6" />
          </g>
          <g stroke="currentColor" strokeWidth="2" opacity=".24">
            <path d="M675 240a66 66 0 1 1-27 18l24 21a34 34 0 1 0 14-10z" />
            <path d="M726 356l38 38h56" />
            <circle cx="826" cy="394" r="6" />
          </g>
          <path
            data-landing-pulse
            d="M962 296h24"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0"
          />
        </svg>

        <div className="mx-auto max-w-[1280px]">
          <h1 data-landing-intro className="max-w-[14ch] text-balance text-[clamp(2.75rem,7vw,6rem)] font-semibold leading-[0.99] tracking-[-0.055em]">
            Catch AC faults early.
          </h1>

          <p data-landing-intro className="mt-6 max-w-[54ch] text-base leading-relaxed text-[var(--text-secondary)] sm:mt-8 sm:text-xl">
            Clamp our non-invasive current sensor onto your AC distribution panel.
            Sentrix learns each unit&apos;s normal 7-day electrical rhythm in Amps and alerts your
            maintenance team the moment power draw drifts outside safe bounds.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              data-landing-intro
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-amber-500 px-6 py-3 text-center text-base font-semibold text-[#17140d] transition-colors hover:bg-amber-400"
            >
              Start Monitoring Your AC Fleet →
            </Link>
            <a
              data-landing-intro
              href="#how-it-works"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-center text-base font-semibold transition-colors hover:bg-[var(--surface-hover)]"
            >
              See How It Works
            </a>
          </div>

          <dl className="mt-12 grid max-w-2xl grid-cols-3 items-start gap-3 sm:mt-16 sm:gap-8">
            <div data-landing-intro className="flex flex-col-reverse gap-1.5">
              <dt className="text-sm leading-snug text-[var(--text-secondary)]">RMS current sampling</dt>
              <dd className="text-2xl font-semibold tracking-tight sm:text-4xl">1 min</dd>
            </div>
            <div data-landing-intro className="flex flex-col-reverse gap-1.5">
              <dt className="text-sm leading-snug text-[var(--text-secondary)]">Baseline calibration</dt>
              <dd className="text-2xl font-semibold tracking-tight sm:text-4xl">7 days</dd>
            </div>
            <div data-landing-intro className="flex flex-col-reverse gap-1.5">
              <dt className="text-sm leading-snug text-[var(--text-secondary)]">Wires to cut</dt>
              <dd className="text-2xl font-semibold tracking-tight sm:text-4xl">0</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* 2.5 Section #overview: Smarter Air Conditioning · A Practical Climate Win */}
      <section id="overview" className="relative isolate scroll-mt-20 border-t border-[var(--border)] bg-[var(--canvas)] px-6 py-16 sm:px-8 sm:py-24">
        <LandingCircuit pattern="overview" />
        <div className="mx-auto max-w-[1280px]">
          <div data-landing-circuit-anchor className="max-w-2xl">
            <p data-landing-reveal className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-500">
              START WHERE THE ENERGY GOES
            </p>
            <h2 data-landing-reveal className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl lg:text-5xl">
              Smarter air conditioning.
              <span className="block text-[var(--text-secondary)] font-normal">A practical climate win.</span>
            </h2>
            <p data-landing-reveal className="mt-4 text-base sm:text-lg leading-relaxed text-[var(--text-secondary)]">
              We&apos;re deliberately beginning with air conditioning—a practical way to focus our
              team and climate impact. The broader vision is a flexible platform that can
              support more machine types as Sentrix develops.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            {/* Card 01: Connect */}
            <article data-landing-reveal data-landing-circuit-anchor className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 flex flex-col justify-between transition-colors hover:border-amber-500/40 hover:bg-[var(--surface-hover)] shadow-sm">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-500">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
                    </svg>
                  </div>
                  <span className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
                    01 / CONNECT
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-bold text-[var(--text-primary)]">
                  Start with the AC you have
                </h3>
                <p className="mt-2.5 text-base leading-relaxed text-[var(--text-secondary)]">
                  Air conditioners are our first use case. We&apos;re keeping the initial product focused
                  while building a foundation that can grow to other machine types over time.
                </p>
              </div>

              <div className="mt-6 border-t border-[var(--border)] pt-4 font-mono text-sm font-medium text-amber-500 flex items-center gap-2">
                <span className="text-amber-500 font-bold">↗</span>
                Phase 01 · Air conditioning
              </div>
            </article>

            {/* Card 02: Predict */}
            <article data-landing-reveal data-landing-circuit-anchor className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 flex flex-col justify-between transition-colors hover:border-amber-500/40 hover:bg-[var(--surface-hover)] shadow-sm">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-500">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                  <span className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
                    02 / PREDICT
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-bold text-[var(--text-primary)]">
                  Find cooling that costs more
                </h3>
                <p className="mt-2.5 text-base leading-relaxed text-[var(--text-secondary)]">
                  Compare each unit&apos;s operating pattern over time to flag unusual energy draw,
                  extended runtimes, and potential maintenance needs.
                </p>
              </div>

              <div className="mt-6 border-t border-[var(--border)] pt-4 font-mono text-sm font-medium text-amber-500 flex items-center gap-2">
                <span className="text-amber-500 font-bold">↗</span>
                Anomalies worth investigating
              </div>
            </article>

            {/* Card 03: Improve */}
            <article data-landing-reveal data-landing-circuit-anchor className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 flex flex-col justify-between transition-colors hover:border-amber-500/40 hover:bg-[var(--surface-hover)] shadow-sm">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-500">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 16h5v5" />
                    </svg>
                  </div>
                  <span className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
                    03 / IMPROVE
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-bold text-[var(--text-primary)]">
                  Connect efficiency to climate
                </h3>
                <p className="mt-2.5 text-base leading-relaxed text-[var(--text-secondary)]">
                  Turn measured energy changes into an estimated emissions impact using a grid factor
                  your team can verify and update.
                </p>
              </div>

              <div className="mt-6 border-t border-[var(--border)] pt-4 font-mono text-sm font-medium text-amber-500 flex items-center gap-2">
                <span className="text-amber-500 font-bold">↗</span>
                Transparent, configurable estimates
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 3. Section #how-it-works: Hardware in the Field (Interactive Showcase + Annotated Frame) */}
      <section id="how-it-works" className="relative isolate scroll-mt-20 border-t border-[var(--border)] bg-[var(--surface)]/40 px-6 py-16 sm:px-8 sm:py-24">
        <LandingCircuit pattern="hardware" />
        <div className="mx-auto max-w-[1280px]">
          <div className="max-w-2xl">
            <p data-landing-reveal className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-500">
              HARDWARE DEPLOYMENT
            </p>
            <h2 data-landing-reveal className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              Physical Hardware in the Field
            </h2>
            <p data-landing-reveal className="mt-4 text-base sm:text-lg leading-relaxed text-[var(--text-secondary)]">
              Non-invasive clamp sensing, infrared remote capture, and local mesh relay engineered
              for clean industrial installation into existing electrical panels.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
            {/* Left Column (6 cols) — Product Photo & Annotated Hardware Callout Frame */}
            <div data-landing-reveal data-landing-circuit-anchor className="lg:col-span-6 flex flex-col justify-between min-h-[460px] rounded-2xl border-2 border-amber-500/30 bg-[#151613] p-4 sm:p-6 text-stone-100 relative overflow-hidden shadow-2xl">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs uppercase tracking-wider text-amber-400 font-bold">
                        SENTRIX KIT
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                      
                        Prototype
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-stone-400">
                      Non-invasive edge node hardware
                    </p>
                  </div>
                </div>

                {/* Hardware Photo Container */}
                <div className="mt-4">
                  <div className="relative overflow-hidden rounded-xl border border-stone-800 bg-[#0d0e0c] group aspect-[4/3] sm:aspect-[16/9] w-full min-h-[220px]">
                    <Image
                      src={prototypeImageSrc}
                      fill
                      sizes="(min-width: 1400px) 580px, (min-width: 1024px) 50vw, 100vw"
                      alt="Sentrix ESP32 IoT Sensor Node Prototype"
                      onError={() => setPrototypeImageSrc("/images/esp32-sensor-prototype.jpg")}
                      className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

                    {/* Top-right subtle badge */}
                    <div className="absolute top-2.5 right-2.5 pointer-events-none">
                      <span className="rounded-full border border-amber-500/30 bg-black/75 px-2.5 py-1 font-mono text-[10px] text-amber-300 backdrop-blur-md">
                        ESP32 + IR + SCT-013
                      </span>
                    </div>
                  </div>

                  {/* Technical Spec Caption under photo (outside image to avoid obscuring hardware on mobile) */}
                  <div className="mt-2.5 flex items-center justify-between gap-2 px-1 font-mono text-xs">
                    <span className="text-stone-300 font-medium truncate">
                      Sentrix Edge Node Assembly
                    </span>
                    <span className="shrink-0 rounded bg-stone-800/80 px-2 py-0.5 text-[10px] sm:text-xs text-amber-400 font-semibold uppercase tracking-wider">
                      ESP-WROOM-32
                    </span>
                  </div>
                </div>

                {/* 3 Numbered Hardware Callout Pills */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-3 rounded-lg border border-stone-800 bg-[#1e201a] px-3.5 py-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-amber-500 font-mono text-xs font-bold text-[#17140d]">
                      01
                    </span>
                    <p className="font-mono text-xs sm:text-sm text-stone-200">
                      SCT-013 Clamp <span className="text-stone-400 font-normal">(Up to 100A AC — Non-Invasive)</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-stone-800 bg-[#1e201a] px-3.5 py-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-amber-500 font-mono text-xs font-bold text-[#17140d]">
                      02
                    </span>
                    <p className="font-mono text-xs sm:text-sm text-stone-200">
                      Infrared (IR) Receiver <span className="text-stone-400 font-normal">(Captures AC Remote Setpoint °C)</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-stone-800 bg-[#1e201a] px-3.5 py-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-amber-500 font-mono text-xs font-bold text-[#17140d]">
                      03
                    </span>
                    <p className="font-mono text-sm text-stone-200">
                      ESP32 Mesh Node <span className="text-stone-400 font-normal">(NimBLE Onboarding + Local Wi-Fi Relay)</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (6 cols) — Installation Steps */}
            <div className="lg:col-span-6 flex flex-col justify-between py-2">
              <div className="relative space-y-6 sm:space-y-8">
                {/* Step 01 */}
                <div data-landing-reveal className="relative flex items-start gap-4 sm:gap-5 p-3">
                  <div data-landing-circuit-anchor className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 font-mono text-xs font-bold text-[#17140d] ring-4 ring-[var(--canvas)] shadow-md">
                    01
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">
                      Snap Clamp onto AC Breaker Wire
                    </h3>
                    <p className="mt-2 text-base leading-relaxed text-[var(--text-secondary)]">
                      Clamp the SCT-013 split-core sensor around the single live MCB wire.
                      Zero wire cutting, zero rewiring, and zero electrical panel shutdown required.
                    </p>
                  </div>
                </div>

                {/* Step 02 */}
                <div data-landing-reveal className="relative flex items-start gap-4 sm:gap-5 p-3">
                  <div data-landing-circuit-anchor className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 font-mono text-xs font-bold text-[#17140d] ring-4 ring-[var(--canvas)] shadow-md">
                    02
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">
                      Pair via Phone Bluetooth (BLE)
                    </h3>
                    <p className="mt-2 text-base leading-relaxed text-[var(--text-secondary)]">
                      Open the Sentrix onboarding tool, scan the node&apos;s Bluetooth MAC sticker,
                      enter the secure 6-digit pairing PIN, and push local Wi-Fi credentials.
                    </p>
                  </div>
                </div>

                {/* Step 03 */}
                <div data-landing-reveal className="relative flex items-start gap-4 sm:gap-5 p-3">
                  <div data-landing-circuit-anchor className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 font-mono text-xs font-bold text-[#17140d] ring-4 ring-[var(--canvas)] shadow-md">
                    03
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">
                      7-Day Silent Baseline Calibration
                    </h3>
                    <p className="mt-2 text-base leading-relaxed text-[var(--text-secondary)]">
                      For 168 hours, Sentrix continuously records 1-minute RMS current alongside target AC
                      temperatures, automatically fitting an hourly Auto-ARIMA diurnal profile.
                    </p>
                  </div>
                </div>

                {/* Step 04 */}
                <div data-landing-reveal className="relative flex items-start gap-4 sm:gap-5 p-3">
                  <div data-landing-circuit-anchor className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 font-mono text-xs font-bold text-[#17140d] ring-4 ring-[var(--canvas)] shadow-md">
                    04
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">
                      Live Safe-Zone Anomaly Alerts
                    </h3>
                    <p className="mt-2 text-base leading-relaxed text-[var(--text-secondary)]">
                      Receive immediate dashboard warnings and push alerts the moment dirty filters,
                      coil icing, or failing compressor motor windings drive current above safe bounds.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* 5. Section #specifications: Industrial Spec Sheet Table + Secondary Product Photo Slot */}
      <section id="specifications" className="relative isolate scroll-mt-20 border-t border-[var(--border)] bg-[var(--surface)]/40 px-6 py-16 sm:px-8 sm:py-24">
        <LandingCircuit pattern="specifications" />
        <div className="mx-auto max-w-[1280px]">
          <div className="max-w-2xl">
            <p data-landing-reveal className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-500">
              TECHNICAL DATASHEET
            </p>
            <h2 data-landing-reveal className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              Industrial Hardware &amp; Field Installation
            </h2>
            <p data-landing-reveal className="mt-4 text-base sm:text-lg leading-relaxed text-[var(--text-secondary)]">
              Complete engineering specifications for the SCT-013 current conditioning stack,
              ESP-Mesh architecture, and Auto-ARIMA statistical bounds.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            {/* Left Column (7 cols) — Striped Industrial Specification Table */}
            <div data-landing-reveal data-landing-circuit-anchor className="min-w-0 lg:col-span-7 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg">
              <table className="w-full min-w-[480px] text-left text-sm sm:text-base border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--canvas)]">
                    <th className="py-4 px-5 font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
                      System Parameter
                    </th>
                    <th className="py-4 px-5 font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
                      Engineering Specification
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  <tr className="bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition">
                    <td className="py-3.5 px-5 font-medium text-[var(--text-primary)]">Current Sensor</td>
                    <td className="py-3.5 px-5 font-mono text-sm text-[var(--text-secondary)]">
                      SCT-013 Split-Core CT (0 - 100A AC, Non-Invasive)
                    </td>
                  </tr>
                  <tr className="bg-[var(--surface-hover)]/40 hover:bg-[var(--surface-hover)] transition">
                    <td className="py-3.5 px-5 font-medium text-[var(--text-primary)]">Edge Controller</td>
                    <td className="py-3.5 px-5 font-mono text-sm text-[var(--text-secondary)]">
                      ESP32 ADC + 1.65V DC Bias Conditioning + HLK-PM01 AC-DC
                    </td>
                  </tr>
                  <tr className="bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition">
                    <td className="py-3.5 px-5 font-medium text-[var(--text-primary)]">AC Setpoint Sensor</td>
                    <td className="py-3.5 px-5 font-mono text-sm text-[var(--text-secondary)]">
                      Infrared (IR) Remote Code Interceptor (38kHz)
                    </td>
                  </tr>
                  <tr className="bg-[var(--surface-hover)]/40 hover:bg-[var(--surface-hover)] transition">
                    <td className="py-3.5 px-5 font-medium text-[var(--text-primary)]">Local Networking</td>
                    <td className="py-3.5 px-5 font-mono text-sm text-[var(--text-secondary)]">
                      ESP-Mesh Auto-Root Election + Bluetooth LE Provisioning
                    </td>
                  </tr>
                  <tr className="bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition">
                    <td className="py-3.5 px-5 font-medium text-[var(--text-primary)]">Forecasting Engine</td>
                    <td className="py-3.5 px-5 font-mono text-sm text-[var(--text-secondary)]">
                      Auto-ARIMA (168-Hour Calibration, 24h Diurnal Seasonality)
                    </td>
                  </tr>
                  <tr className="bg-[var(--surface-hover)]/40 hover:bg-[var(--surface-hover)] transition">
                    <td className="py-3.5 px-5 font-medium text-[var(--text-primary)]">Sampling &amp; Alerts</td>
                    <td className="py-3.5 px-5 font-mono text-sm text-[var(--text-secondary)]">
                      1-Minute RMS Intervals · Web Push &amp; Dashboard Feed
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right Column (5 cols) — MCB Field Installation Photo Card */}
            <div data-landing-reveal data-landing-circuit-anchor className="lg:col-span-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    MCB Breaker Installation Rule
                  </h3>
                  <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-500">
                    SINGLE WIRE ONLY
                  </span>
                </div>

                <div className="relative mt-4 flex min-h-[220px] items-center justify-center rounded-xl border border-[var(--border)] bg-[#11120f] p-4">
                  <svg viewBox="0 0 400 200" className="h-full w-full" fill="none">
                    {/* MCB Breaker Enclosure */}
                    <rect x="40" y="20" width="100" height="160" rx="4" fill="#1e221b" stroke="#3d4235" strokeWidth="2" />
                    <rect x="55" y="40" width="70" height="40" fill="#2d3329" rx="2" />
                    <text x="90" y="65" fill="#f59e0b" fontSize="11" fontFamily="monospace" textAnchor="middle" fontWeight="bold">MCB 40A</text>

                    {/* Neutral Wire (Bypassing clamp) */}
                    <path d="M 120 180 L 120 20" stroke="#38bdf8" strokeWidth="3" />
                    <text x="130" y="110" fill="#38bdf8" fontSize="9" fontFamily="monospace">NEUTRAL</text>

                    {/* Live Wire (Passing THROUGH clamp) */}
                    <path d="M 65 180 L 65 20" stroke="#f59e0b" strokeWidth="4" />
                    <text x="25" y="110" fill="#f59e0b" fontSize="9" fontFamily="monospace">LIVE</text>

                    {/* SCT-013 Clamp Enclosing Live Wire Only */}
                    <rect x="35" y="70" width="60" height="60" rx="8" fill="#20221c" stroke="#10b981" strokeWidth="2.5" />
                    <circle cx="65" cy="100" r="14" fill="#11120f" stroke="#484a40" strokeWidth="1.5" />
                    <circle cx="65" cy="100" r="4" fill="#f59e0b" />

                    {/* Green Checkmark Badge */}
                    <circle cx="100" cy="70" r="12" fill="#10b981" />
                    <path d="M 94 70 L 98 74 L 106 66" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />

                    {/* Explanatory callout */}
                    <rect x="180" y="50" width="190" height="95" rx="6" fill="#191d16" stroke="#343a2c" />
                    <text x="195" y="75" fill="#10b981" fontSize="11" fontFamily="monospace" fontWeight="bold">CRITICAL PRINCIPLE:</text>
                    <text x="195" y="95" fill="#e5e5dc" fontSize="10">Clamp around 1 wire</text>
                    <text x="195" y="110" fill="#e5e5dc" fontSize="10">(Live or Neutral),</text>
                    <text x="195" y="125" fill="#ef4444" fontSize="10" fontWeight="bold">never both together.</text>
                  </svg>
                </div>

                <div className="mt-4 rounded-lg bg-[var(--canvas)] p-3 border border-[var(--border)] text-sm">
                  <p className="font-semibold text-emerald-500">
                    Golden Rule of AC Current Sensing:
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed">
                    Always clamp around a single phase conductor (Live or Neutral). Clamping both conductors cancels out the magnetic flux, causing a zero current reading.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* High-Contrast Bottom Callout Bar */}
          <div data-landing-circuit-anchor className="mt-14 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="max-w-2xl text-center lg:text-left">
              <h3 data-landing-reveal className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                Ready to audit your facility AC circuits?
              </h3>
              <p data-landing-reveal className="mt-2 text-base sm:text-lg text-[var(--text-secondary)]">
                Deploy Sentrix non-invasive monitoring across your cooling panels in under 15 minutes.
              </p>
            </div>

            <div data-landing-reveal className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <Link
                href="/signup"
                className="inline-flex h-12 w-full sm:w-auto items-center justify-center rounded-xl bg-amber-500 px-6 text-base font-semibold text-[#17140d] shadow-md shadow-amber-500/20 transition hover:bg-amber-400 text-center"
              >
                Create Facility Workspace →
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-12 w-full sm:w-auto items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-6 text-base font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] text-center"
              >
                Open Live Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative isolate border-t border-[var(--border)] bg-[var(--surface)] px-6 py-12 sm:px-8">
        <LandingCircuit pattern="footer" />
        <div className="mx-auto max-w-[1280px]">
          <div className="grid gap-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div data-landing-reveal data-landing-circuit-anchor>
              <Brand />
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
                Commercial AC electrical monitoring and predictive maintenance. Non-invasive clamp telemetry with automated 7-day ARIMA anomaly detection.
              </p>
            </div>

            <div data-landing-reveal>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Architecture
              </h3>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <a className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]" href="#overview">
                    Climate Overview
                  </a>
                </li>
                <li>
                  <a className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]" href="#how-it-works">
                    Hardware Deployment
                  </a>
                </li>
                <li>
                  <a className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]" href="#specifications">
                    Technical Specifications
                  </a>
                </li>
              </ul>
            </div>

            <div data-landing-reveal>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Operations
              </h3>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <Link className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]" href="/dashboard">
                    Live Panel Dashboard
                  </Link>
                </li>
                <li>
                  <Link className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]" href="/alerts">
                    Active Anomaly Alerts
                  </Link>
                </li>
                <li>
                  <Link className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]" href="/settings">
                    Facility Settings
                  </Link>
                </li>
              </ul>
            </div>

            <div data-landing-reveal>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Account
              </h3>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <Link className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]" href="/login">
                    Operator Sign In
                  </Link>
                </li>
                <li>
                  <Link className="text-sm font-semibold text-amber-500 transition hover:underline" href="/signup">
                    Create Facility Workspace
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div data-landing-reveal data-landing-circuit-anchor className="mt-10 flex flex-col gap-4 border-t border-[var(--border)] pt-6 font-mono text-xs uppercase tracking-wider text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <Image
                src={darkLogo}
                alt="Sentrix"
                className="h-4 w-auto object-contain logo-dark-theme"
              />
              <Image
                src={lightLogo}
                alt="Sentrix"
                className="h-4 w-auto object-contain logo-light-theme"
              />
            </span>
            <span>© 2026 Sentrix. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
