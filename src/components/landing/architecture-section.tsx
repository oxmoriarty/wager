import { Bot, Coins, Database, Lock, ShieldCheck, Sparkles, Terminal } from "lucide-react";

const FLOW_NODES = [
  {
    step: "01",
    label: "Social Prediction Post",
    detail: "User publishes football match take on Wager",
    icon: Terminal,
    chain: "Frontend",
  },
  {
    step: "02",
    label: "Client PIN Execution",
    detail: "Circle User-Controlled Wallet challenges signed client-side",
    icon: Lock,
    chain: "Circle SDK",
  },
  {
    step: "03",
    label: "Arc Escrow Lock",
    detail: "USDC liquidity locked in Escrow.sol smart contract",
    icon: Coins,
    chain: "Arc Testnet",
  },
  {
    step: "04",
    label: "GenLayer Multi-LLM Oracle",
    detail: "Validators independently scrape official sports web sources",
    icon: Bot,
    chain: "Studio Next (61997)",
  },
  {
    step: "05",
    label: "prompt_comparative Consensus",
    detail: "Semantic equivalence principle confirms official score",
    icon: ShieldCheck,
    chain: "Consensus v0.6",
  },
  {
    step: "06",
    label: "Autonomous Claim Payout",
    detail: "Winning predictions withdraw USDC back to their wallet",
    icon: Sparkles,
    chain: "Instant Settlement",
  },
];

export function ArchitectureSection() {
  return (
    <section id="architecture" className="relative py-24 sm:py-32 border-t border-zinc-900 bg-zinc-950/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3.5 py-1 text-xs font-semibold text-zinc-300">
            <Database className="h-3.5 w-3.5 text-emerald-400" />
            <span>Dual-Chain Synergy</span>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Protocol Architecture
          </h2>
          <p className="mt-3 text-sm sm:text-base text-zinc-400 leading-relaxed">
            How Arc Network and GenLayer Studio Next interact to provide seamless staking and autonomous settlement.
          </p>
        </div>

        {/* Interactive Architecture Flow Diagram */}
        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FLOW_NODES.map((node) => {
            const Icon = node.icon;
            return (
              <div
                key={node.step}
                className="relative rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-lg backdrop-blur-md transition-all hover:border-zinc-700 hover:bg-zinc-900/90"
              >
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800/70">
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    Step {node.step}
                  </span>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                    {node.chain}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-emerald-400 shadow-inner">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {node.label}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                      {node.detail}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
