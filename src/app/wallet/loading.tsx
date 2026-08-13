import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function WalletLoading() {
  return (
    <>
      <header className="border-border flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="size-8 rounded-full" />
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 sm:px-6">
        <Skeleton className="h-6 w-24" />
        <Card className="gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-3 w-56" />
        </Card>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
      </main>
    </>
  );
}
