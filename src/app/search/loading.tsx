import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <>
      <header className="border-border flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="size-8 rounded-full" />
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-10 w-full rounded-md" />
        <p className="text-muted-foreground py-10 text-center text-sm">
          Search for people, teams, or competitions.
        </p>
      </main>
    </>
  );
}
