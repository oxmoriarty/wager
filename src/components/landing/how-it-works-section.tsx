import { Bot, Coins, PenLine, Sparkles } from "lucide-react";

const STEPS = [
  {
    number: "01",
    title: "Post Your Analysis",
    subtitle: "Every post is automatically an on-chain prediction market.",
    description:
      "Select an upcoming football fixture, write your tactical breakdown, and pick your side. Wager deploys a transparent Arc Escrow pool linked directly to your social post.",
    icon: PenLine,
    badge: "Social Layer",
  },
  {
    number: "02",
    title: "Stake Non-Custodially",
    subtitle: "1-click PIN confirmation. Zero seed phrases.",
    description:
      "Followers and rival fans support or challenge your prediction with USDC. Powered by Circle User-Controlled Wallets, signing happens client-side with your PIN-Wager never holds custody.",
    icon: Coins,
    badge: "Arc Network Escrow",
  },
  {
    number: "03",
    title: "Autonomous AI Settlement",
    subtitle: "Decentralized consensus without human oracles.",
    description:
      "At full-time, GenLayer Studio Next intelligent contracts independently fetch live results across authoritative sports data sources, reach consensus via comparative equivalence, and unlock payouts.",
    icon: Bot,
    badge: "GenLayer Studio Next",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-32 border-t border-zinc-900 bg-zinc-950/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3.5 py-1 text-xs font-semibold text-zinc-300">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Intuitive 3-Step Protocol</span>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            How Wager Works
          </h2>
          <p className="mt-3 text-sm sm:text-base text-zinc-400 leading-relaxed">
            Eliminating centralized betting houses and clunky Web3 onboarding with social prediction markets.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="group relative rounded-2xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/80 to-zinc-950 p-7 shadow-xl transition-all duration-300 hover:border-zinc-700 hover:-translate-y-1"
              >
                {/* Top Bar: Number & Badge */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-3xl font-black tracking-tight text-zinc-700 group-hover:text-emerald-400/80 transition-colors">
                    {step.number}
                  </span>
                  <span className="rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {step.badge}
                  </span>
                </div>

                {/* Icon Box */}
                <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-white shadow-inner group-hover:border-emerald-500/40 group-hover:text-emerald-400 transition-colors">
                  <Icon className="h-6 w-6" />
                </div>

                {/* Content */}
                <h3 className="mt-5 text-lg font-bold text-white group-hover:text-zinc-100">
                  {step.title}
                </h3>
                <p className="mt-1 text-xs font-medium text-emerald-400">
                  {step.subtitle}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
