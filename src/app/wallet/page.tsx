import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  getPositionsForUser,
  getRewardsStats,
  getTransactionsPage,
  getWalletOverview,
} from "@/lib/queries/wallet";
import { AppHeader } from "@/components/layout/app-header";
import { WalletCard } from "@/components/wallet/wallet-card";
import { WalletTabs } from "@/components/wallet/wallet-tabs";

export const metadata: Metadata = { title: "Wallet" };

export default async function WalletPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const [overview, positions, transactionsPage, rewardsStats] =
    await Promise.all([
      getWalletOverview(session.user.id),
      getPositionsForUser(session.user.id),
      getTransactionsPage(session.user.id),
      getRewardsStats(session.user.id),
    ]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 sm:px-6">
        <h1 className="text-foreground text-lg font-semibold">Wallet</h1>

        <WalletCard overview={overview} rewardsStats={rewardsStats} />

        <WalletTabs
          positions={positions}
          transactions={transactionsPage.items}
        />
      </main>
    </>
  );
}
