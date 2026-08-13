import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <>
      <header className="border-border flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="size-8 rounded-full" />
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <Card className="items-center gap-4">
          <Skeleton className="size-24 rounded-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
          <CardContent className="w-full flex-row items-center justify-center gap-8 p-0 pt-2">
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-10 w-16" />
          </CardContent>
        </Card>
        <Skeleton className="h-32 w-full" />
      </main>
    </>
  );
}
