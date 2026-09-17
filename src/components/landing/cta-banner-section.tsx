import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaBannerSection() {
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900 via-zinc-900/95 to-zinc-950 px-6 py-16 sm:px-12 sm:py-20 text-center shadow-2xl">
          {/* Ambient Glow */}
          <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-96 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-24 left-1/2 -z-10 h-72 w-96 -translate-x-1/2 rounded-full bg-teal-500/10 blur-[100px]" />

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-4 py-1.5 text-xs font-semibold text-emerald-300">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Join the Future of Sports Forecasting</span>
          </div>

          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Ready to Back Your Football Knowledge?
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base leading-relaxed text-zinc-400">
            Set up your non-custodial wallet in 10 seconds. Stake on upcoming Premier League, Champions League, and European clashes with zero seed phrase friction.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Button
              asChild
              size="lg"
              className="h-12 w-full sm:w-auto gap-2 rounded-full bg-white px-8 text-sm font-bold text-zinc-950 shadow-xl transition-all hover:bg-zinc-200 hover:scale-[1.02]"
            >
              <Link href="/sign-up">
                <span>Create Free Account</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 w-full sm:w-auto gap-2 rounded-full border-zinc-700 bg-zinc-800/80 px-8 text-sm font-semibold text-zinc-200 backdrop-blur-md transition-all hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
            >
              <Link href="/sign-in">
                <span>Sign in</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
