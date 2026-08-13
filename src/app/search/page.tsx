import type { Metadata } from "next";
import { Suspense } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { SearchForm } from "@/components/search/search-form";
import { SearchResults } from "@/components/search/search-results";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Search" };

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="flex-row items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <Skeleton className="h-4 flex-1" />
        </Card>
      ))}
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8 sm:px-6">
        <SearchForm />
        {query ? (
          <Suspense fallback={<ResultsSkeleton />} key={query}>
            <SearchResults query={query} />
          </Suspense>
        ) : (
          <p className="text-muted-foreground py-10 text-center text-sm">
            Search for people, teams, or competitions.
          </p>
        )}
      </main>
    </>
  );
}
