import { Check, Cpu, ExternalLink, Network, ShieldCheck } from "lucide-react";

export function ConsensusSection() {
  return (
    <section id="consensus" className="relative py-24 sm:py-32 border-t border-zinc-900 bg-zinc-950/60">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute right-1/4 top-1/2 -z-10 h-96 w-96 -translate-y-1/2 rounded-full bg-emerald-600/10 blur-[120px]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Text & Explanation */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-1 text-xs font-semibold text-emerald-300">
              <Cpu className="h-3.5 w-3.5 text-emerald-400" />
              <span>GenLayer Studio Next (Consensus v0.6)</span>
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl sm:leading-tight">
              Decentralized AI Oracles via Comparative Equivalence
            </h2>

            <p className="text-sm sm:text-base leading-relaxed text-zinc-400">
              Traditional prediction platforms rely on centralized admins or brittle Web2 oracle bots that break when website layouts shift. Wager pioneers GenLayer&apos;s intelligent contract equivalence principle:
            </p>

            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                  <Check className="h-3 w-3" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-white">Multi-Validator Independent Execution: </span>
                  <span className="text-zinc-400">
                    Leader and validator nodes independently fetch live match data across premier sports web sources.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                  <Check className="h-3 w-3" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-white">Semantic LLM Agreement (prompt_comparative): </span>
                  <span className="text-zinc-400">
                    A consensus LLM cross-validates leader and validator outputs, tolerating natural phrasing variations while strictly validating final scorelines.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                  <Check className="h-3 w-3" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-white">Non-Deterministic Web Scraping: </span>
                  <span className="text-zinc-400">
                    Executes directly inside intelligent contract runtime with zero API keys or external oracle dependencies.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <a
                href="https://explorer-studio-dev.genlayer.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
              >
                <span>View on GenLayer Studio Next Explorer</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Right: Code / Consensus Simulator Card */}
          <div className="lg:col-span-6">
            <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-2xl overflow-hidden backdrop-blur-xl">
              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                  </div>
                  <span className="ml-2 font-mono text-[11px] text-zinc-400">
                    fixture_discovery.py &#8226; consensus v0.6
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                  <Network className="h-3 w-3" />
                  <span>Chain ID: 61997</span>
                </div>
              </div>

              {/* Code Snippet */}
              <div className="p-4 sm:p-5 font-mono text-xs leading-relaxed text-zinc-300 space-y-2 overflow-x-auto">
                <p className="text-zinc-500"># GenLayer Comparative Equivalence Consensus</p>
                <p className="text-purple-400">
                  <span className="text-blue-400">result</span> = gl.eq_principle.prompt_comparative(
                </p>
                <p className="pl-4 text-emerald-300">
                  extract_fn,
                </p>
                <p className="pl-4 text-zinc-400">
                  principle=&quot;Matches are equivalent if team names match the same club and kickoff dates match.&quot;
                </p>
                <p className="text-purple-400">)</p>
                
                {/* Consensus Live Feedback Box */}
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-[11px] text-zinc-300 space-y-1.5">
                  <div className="flex items-center justify-between font-semibold text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Validator Agreement Finalized</span>
                    </span>
                    <span className="text-zinc-400">3/3 Nodes Agreed</span>
                  </div>
                  <p className="text-zinc-400">
                    Leader Output: <span className="text-white font-medium">&quot;Arsenal 2 - 1 Chelsea (FT)&quot;</span>
                  </p>
                  <p className="text-zinc-400">
                    Validator Output: <span className="text-white font-medium">&quot;Arsenal FC 2-1 Chelsea (Full Time)&quot;</span>
                  </p>
                  <p className="text-emerald-400 font-semibold pt-1">
                    Equivalence verdict: EQUIVALENT &#8226; Outcome: SUPPORT_WON
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
