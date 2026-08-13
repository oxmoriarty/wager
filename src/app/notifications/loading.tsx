import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <>
      <header className="border-border flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="size-8 rounded-full" />
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-6 w-40" />
        {[0, 1, 2].map((i) => (
          <Card key={i} className="flex-row items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </Card>
        ))}
      </main>
    </>
  );
}
