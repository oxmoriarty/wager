import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WagerLogo } from "@/components/ui/wager-logo";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <WagerLogo size="md" href="/" priority />
          
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-950/30 px-3 py-1 text-[11px] font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Studio Next 61997</span>
            <span className="text-zinc-600">&#8226;</span>
            <span>Arc Testnet</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-zinc-400">
          <a href="#how-it-works" className="transition-colors hover:text-white">
            How It Works
          </a>
          <a href="#consensus" className="transition-colors hover:text-white">
            AI Consensus
          </a>
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#architecture" className="transition-colors hover:text-white">
            Architecture
          </a>
          <a href="#faq" className="transition-colors hover:text-white">
            FAQ
          </a>
        </nav>

        {/* Action CTAs */}
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-xs font-semibold text-zinc-300 transition-colors hover:text-white px-2.5 py-1.5"
          >
            Sign in
          </Link>
          <Button
            asChild
            size="sm"
            className="h-9 gap-1.5 rounded-full bg-white px-4 text-xs font-bold text-zinc-950 shadow-sm transition-all hover:bg-zinc-200 hover:shadow-emerald-500/10"
          >
            <Link href="/sign-up">
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
