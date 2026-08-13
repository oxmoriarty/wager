import { Card } from "@/components/ui/card";
import { formatRelativeTime, formatUsdcAmount } from "@/lib/format";
import type { TransactionRow } from "@/lib/queries/wallet";

const TRANSACTION_TYPE_LABEL: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  ESCROW_LOCK: "Staked",
  ESCROW_RELEASE: "Escrow released",
  PAYOUT: "Payout",
  CLAIM: "Claimed",
};

export function TransactionsList({ items }: { items: TransactionRow[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        No transactions yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((tx) => (
        <Card
          key={tx.id}
          className="flex-row items-center justify-between gap-3 p-3"
        >
          <div className="min-w-0">
            <p className="text-foreground text-sm font-medium">
              {TRANSACTION_TYPE_LABEL[tx.type] ?? tx.type}
            </p>
            <p className="text-muted-foreground text-xs">
              {formatRelativeTime(tx.createdAt)}
              {tx.arcTxHash && (
                <>
                  {" · "}
                  <a
                    href={`https://testnet.arcscan.app/tx/${tx.arcTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground hover:underline"
                  >
                    View on Arcscan
                  </a>
                </>
              )}
            </p>
          </div>
          <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
            {formatUsdcAmount(tx.amount)} USDC
          </span>
        </Card>
      ))}
    </div>
  );
}
