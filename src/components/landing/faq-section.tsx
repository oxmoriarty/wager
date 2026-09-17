"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

const FAQS = [
  {
    q: "Do I need MetaMask or an external crypto wallet to play?",
    a: "No! Wager uses Circle User-Controlled Wallets. When you sign up, an embedded non-custodial Arc wallet is created for you in seconds. You secure it with a 6-digit PIN-no seed phrases, browser extensions, or private key management needed.",
  },
  {
    q: "How are match scores resolved without human intervention?",
    a: "Wager runs on GenLayer Studio Next intelligent contracts. Multiple decentralized validator nodes independently scrape live sports data from the web and evaluate final scorelines using GenLayer's built-in comparative equivalence principle (prompt_comparative). This eliminates centralized oracle vulnerabilities.",
  },
  {
    q: "How do payouts and claims work?",
    a: "Stakes are locked in transparent Arc smart contract escrow pools. Winning positions can be claimed with 1 click directly in your in-app wallet tab. USDC payouts are credited instantly to your Arc address.",
  },
  {
    q: "What happens if a fixture is postponed or abandoned?",
    a: "If a match is called off or declared void, the intelligent contract recognizes the non-completion and marks the market VOID. All participants can immediately claim a 100% refund of their staked USDC with zero platform fees.",
  },
  {
    q: "Can I withdraw my USDC balance to an external wallet?",
    a: "Yes. From your in-app Wallet page, you can click Withdraw at any time to transfer your USDC to any valid Arc Testnet address by authorizing with your PIN.",
  },
];

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 sm:py-32 border-t border-zinc-900 bg-zinc-950/40">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3.5 py-1 text-xs font-semibold text-zinc-300">
            <HelpCircle className="h-3.5 w-3.5 text-emerald-400" />
            <span>Got Questions?</span>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-sm text-zinc-400">
            Everything you need to know about Wager&apos;s dual-chain protocol and non-custodial betting.
          </p>
        </div>

        <div className="mt-12 space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={faq.q}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-white hover:text-zinc-200 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-emerald-400" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm leading-relaxed text-zinc-400 border-t border-zinc-800/40 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
