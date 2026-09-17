import {
  Coins,
  Cpu,
  Lock,
  MessagesSquare,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    title: "Non-Custodial Circle Wallets",
    description:
      "Onboard in 10 seconds with a secure 6-digit PIN. No browser extensions or 24-word seed phrases required. You retain sovereign control over your funds.",
    icon: Lock,
    tag: "Security",
  },
  {
    title: "Autonomous AI Resolution",
    description:
      "Powered by GenLayer Studio Next. Multiple independent LLM validator nodes reach consensus on official scorelines directly from the web.",
    icon: Cpu,
    tag: "GenLayer v0.6",
  },
  {
    title: "On-Chain Arc Escrow",
    description:
      "Every prediction market has its own transparent escrow pool on Arc Testnet. Automatic 100% refund protection if a fixture is abandoned or voided.",
    icon: Coins,
    tag: "Smart Contracts",
  },
  {
    title: "Threaded Tactical Debates",
    description:
      "True tree-structured discussion threads with visual connector spines, collapsible branches, comment likes, and real-time live updates.",
    icon: MessagesSquare,
    tag: "Social",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 sm:py-32 border-t border-zinc-900 bg-zinc-950/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3.5 py-1 text-xs font-semibold text-zinc-300">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Engineered for Reliability</span>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Why Football Fans Choose Wager
          </h2>
          <p className="mt-3 text-sm sm:text-base text-zinc-400 leading-relaxed">
            Combining the viral community dynamics of social networks with the financial transparency of decentralized protocols.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-6 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/90 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-white shadow-inner group-hover:border group-hover:border-emerald-500/40 group-hover:text-emerald-400 transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                    {feature.tag}
                  </span>
                </div>

                <h3 className="mt-5 text-base font-bold text-white group-hover:text-zinc-100">
                  {feature.title}
                </h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
