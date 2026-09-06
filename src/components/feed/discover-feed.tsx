import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFeedPage, getOpenMarketsForComposer } from "@/lib/queries/feed";
import { PredictionComposer } from "@/components/feed/prediction-composer";
import { FeedList } from "@/components/feed/feed-list";

export async function DiscoverFeed() {
  const session = await auth();

  const [initialPage, markets, hasWallet] = await Promise.all([
    getFeedPage(undefined, session?.user?.id),
    getOpenMarketsForComposer(),
    session?.user?.id
      ? prisma.user
          .findUnique({
            where: { id: session.user.id },
            select: { arcWalletAddress: true },
          })
          .then((u) => Boolean(u?.arcWalletAddress))
      : Promise.resolve(false),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8 sm:px-6">
      <PredictionComposer
        markets={markets}
        isAuthenticated={Boolean(session?.user)}
        hasWallet={hasWallet}
      />
      <FeedList
        initialPage={initialPage}
        isAuthenticated={Boolean(session?.user)}
      />
    </div>
  );
}

