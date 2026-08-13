import { auth } from "@/auth";
import { getFeedPage, getOpenMarketsForComposer } from "@/lib/queries/feed";
import { PredictionComposer } from "@/components/feed/prediction-composer";
import { FeedList } from "@/components/feed/feed-list";

export async function DiscoverFeed() {
  const session = await auth();
  const [initialPage, markets] = await Promise.all([
    getFeedPage(undefined, session?.user?.id),
    getOpenMarketsForComposer(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8 sm:px-6">
      <PredictionComposer markets={markets} />
      <FeedList
        initialPage={initialPage}
        isAuthenticated={Boolean(session?.user)}
      />
    </div>
  );
}
