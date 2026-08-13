import { formatUnits } from "viem";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  ARC_FAUCET_URL,
  arcTestnet,
  getArcPublicClient,
} from "@/lib/arc/config";

const TRANSACTIONS_PAGE_SIZE = 20;

const transactionSelect = {
  id: true,
  type: true,
  status: true,
  amount: true,
  arcTxHash: true,
  createdAt: true,
} satisfies Prisma.TransactionSelect;

export type TransactionRow = Omit<
  Prisma.TransactionGetPayload<{ select: typeof transactionSelect }>,
  "amount"
> & { amount: string };

export async function getTransactionsPage(userId: string, cursor?: string) {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    take: TRANSACTIONS_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: transactionSelect,
  });

  const hasMore = transactions.length > TRANSACTIONS_PAGE_SIZE;
  const page = hasMore
    ? transactions.slice(0, TRANSACTIONS_PAGE_SIZE)
    : transactions;

  const items: TransactionRow[] = page.map((tx) => ({
    ...tx,
    amount: tx.amount.toString(),
  }));

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

const positionSelect = {
  id: true,
  side: true,
  amount: true,
  status: true,
  createdAt: true,
  market: {
    select: {
      id: true,
      type: true,
      status: true,
      outcome: true,
      match: {
        select: { id: true, homeTeam: true, awayTeam: true, competition: true },
      },
    },
  },
} satisfies Prisma.PositionSelect;

export type PositionRow = Omit<
  Prisma.PositionGetPayload<{ select: typeof positionSelect }>,
  "amount"
> & { amount: string };

/**
 * Address + live on-chain balance for a user's Arc wallet. Shared by
 * `GET /api/wallet` and the `/wallet` page server component — deliberately
 * not duplicated between them.
 */
export interface WalletOverview {
  hasWallet: boolean;
  arcWalletAddress: string | null;
  balance: string | null;
  faucetUrl: string;
}

export async function getWalletOverview(
  userId: string,
): Promise<WalletOverview> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { arcWalletAddress: true },
  });

  if (!user.arcWalletAddress) {
    return {
      hasWallet: false,
      arcWalletAddress: null,
      balance: null,
      faucetUrl: ARC_FAUCET_URL,
    };
  }

  const balanceWei = await getArcPublicClient().getBalance({
    address: user.arcWalletAddress as `0x${string}`,
  });

  return {
    hasWallet: true,
    arcWalletAddress: user.arcWalletAddress,
    balance: formatUnits(balanceWei, arcTestnet.nativeCurrency.decimals),
    faucetUrl: ARC_FAUCET_URL,
  };
}

/** All of a user's positions, most recent first — used on the wallet
 * page. Not paginated: a user's own position count is bounded by how
 * many markets they've staked on, which is small enough not to need
 * cursor pagination the way the global transaction/feed lists do. */
export async function getPositionsForUser(
  userId: string,
): Promise<PositionRow[]> {
  const positions = await prisma.position.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: positionSelect,
  });

  return positions.map((position) => ({
    ...position,
    amount: position.amount.toString(),
  }));
}
