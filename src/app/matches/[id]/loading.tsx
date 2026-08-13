import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MatchDetailLoading() {
  return (
    <>
      <header className="border-border flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="size-8 rounded-full" />
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8 sm:px-6">
        <Card className="items-center gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-3 w-32" />
        </Card>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </main>
    </>
  );
}
