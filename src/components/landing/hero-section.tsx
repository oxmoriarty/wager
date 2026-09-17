"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Flame,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  const [selectedSide, setSelectedSide] = useState<"SUPPORT" | "CHALLENGE">("SUPPORT");

  return (
    <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-32">
      {/* Background Ambient Glows and Grid */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[480px] w-[700px] rounded-full bg-gradient-to-tr from-emerald-500/10 via-teal-500/10 to-indigo-500/10 blur-[130px] opacity-70" />
        <div className="absolute top-1/4 h-[350px] w-[500px] rounded-full bg-emerald-600/10 blur-[140px]" />
      </div>

      {/* Decorative Grid Overlay */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,#27272a15_1px,transparent_1px),linear-gradient(to_bottom,#27272a15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Announcement Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-4 py-1.5 text-xs font-semibold text-emerald-300 shadow-sm backdrop-blur-md transition-all hover:border-emerald-500/50">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Built on GenLayer Studio Next &amp; Arc Testnet</span>
            <ChevronRight className="h-3 w-3 text-emerald-400/80" />
          </div>

          {/* Hero Headline */}
          <h1 className="mt-7 max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-[1.12]">
            Every Post Is a{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent">
              Prediction Market
            </span>
          </h1>

          {/* Hero Subhead */}
          <p className="mt-5 max-w-2xl text-base text-zinc-400 sm:text-lg sm:leading-relaxed">
            Social football discourse meets autonomous multi-LLM consensus. Share match takes, stake testnet USDC non-custodially, and settle outcomes trustlessly without centralized oracles.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto">
            <Button
              asChild
              size="lg"
              className="h-12 w-full sm:w-auto gap-2 rounded-full bg-white px-7 text-sm font-bold text-zinc-950 shadow-lg shadow-white/10 transition-all hover:bg-zinc-200 hover:scale-[1.02]"
            >
              <Link href="/sign-up">
                <span>Start Forecasting</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 w-full sm:w-auto gap-2 rounded-full border-zinc-700 bg-zinc-900/80 px-7 text-sm font-semibold text-zinc-200 backdrop-blur-md transition-all hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
            >
              <a href="#how-it-works">
                <span>How It Works</span>
              </a>
            </Button>
          </div>

          {/* Value Props Bar */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Embedded Non-Custodial Wallets (PIN-only)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Decentralized Multi-LLM Oracles</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Verifiable Arc Escrow Pools</span>
            </div>
          </div>
        </div>

        {/* Floating Spatial Hero Preview Card */}
        <div className="relative mt-16 sm:mt-20 flex justify-center">
          {/* Subtle Glow beneath card */}
          <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-blue-500/20 blur-xl opacity-60" />

          {/* Glass Card */}
          <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-800/90 bg-zinc-900/85 p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
            {/* Top Post Meta */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-xs font-bold text-zinc-950 shadow-md">
                  NB
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white">@neurobuilder</span>
                    <span className="rounded-full bg-emerald-950/70 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/60">
                      Top Analyst
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">Premier League &#8226; Gameweek 28</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 rounded-full border border-zinc-700/80 bg-zinc-800/60 px-3 py-1 text-xs font-medium text-zinc-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Market Open</span>
              </div>
            </div>

            {/* Prediction Body */}
            <div className="mt-4 text-left">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <Flame className="h-3.5 w-3.5" />
                <span>Match Winner &#8226; Arsenal vs Chelsea</span>
              </div>
              <p className="mt-2 text-base font-medium text-white leading-relaxed">
                &ldquo;Arsenal&apos;s high press and set-piece efficiency will overwhelm Chelsea at Emirates. Saka to score or assist. 2-1 Gunners victory.&rdquo;
              </p>
            </div>

            {/* Split Probability Bar */}
            <div className="mt-5 space-y-2 text-left">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-400">Support (Arsenal) &#8226; 68%</span>
                <span className="text-amber-400">Challenge (Chelsea) &#8226; 32%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800 p-0.5 flex">
                <div className="h-full rounded-l-full bg-emerald-500 transition-all" style={{ width: "68%" }} />
                <div className="h-full rounded-r-full bg-amber-500 transition-all" style={{ width: "32%" }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>$1,840 USDC staked</span>
                <span>$860 USDC staked</span>
              </div>
            </div>

            {/* Interactive Stake Preview Buttons */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedSide("SUPPORT")}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
                  selectedSide === "SUPPORT"
                    ? "bg-emerald-500 text-zinc-950 ring-2 ring-emerald-400 shadow-md"
                    : "bg-zinc-800/80 text-zinc-300 border border-zinc-700/80 hover:bg-zinc-800"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                <span>Support Arsenal (1.47x)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSide("CHALLENGE")}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
                  selectedSide === "CHALLENGE"
                    ? "bg-amber-500 text-zinc-950 ring-2 ring-amber-400 shadow-md"
                    : "bg-zinc-800/80 text-zinc-300 border border-zinc-700/80 hover:bg-zinc-800"
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Challenge Take (3.12x)</span>
              </button>
            </div>

            {/* Bottom Consensus Verification Badge */}
            <div className="mt-5 flex items-center justify-between border-t border-zinc-800/80 pt-4 text-xs">
              <div className="flex items-center gap-2 text-zinc-400">
                <Bot className="h-4 w-4 text-emerald-400" />
                <span>Oracle: GenLayer Intelligent Contract (Consensus v0.6)</span>
              </div>
              <span className="font-mono text-[11px] text-zinc-400">Arc Escrow #0x36B...90f</span>
            </div>
          </div>

          {/* Floating Pill 1 (Top Right) */}
          <div className="hidden lg:flex absolute -right-8 -top-6 items-center gap-2 rounded-2xl border border-zinc-700/80 bg-zinc-900/90 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md animate-bounce [animation-duration:4s]">
            <Trophy className="h-4 w-4 text-amber-400" />
            <div>
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Recent Payout</p>
              <p className="font-bold text-emerald-400">+54.20 USDC Claimed</p>
            </div>
          </div>

          {/* Floating Pill 2 (Bottom Left) */}
          <div className="hidden lg:flex absolute -left-8 -bottom-4 items-center gap-2 rounded-2xl border border-zinc-700/80 bg-zinc-900/90 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Consensus Principle</p>
              <p className="font-bold text-white">prompt_comparative v0.6</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
