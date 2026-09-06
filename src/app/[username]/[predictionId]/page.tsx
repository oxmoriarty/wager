import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getPredictionById } from "@/lib/queries/feed";
import { getCommentsPage } from "@/lib/queries/comments";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { PredictionCard } from "@/components/feed/prediction-card";
import { ConversationView } from "@/components/feed/conversation-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; predictionId: string }>;
}): Promise<Metadata> {
  const { predictionId } = await params;
  const prediction = await getPredictionById(predictionId);

  if (!prediction) return { title: "Prediction not found" };

  return {
    title: `${prediction.author.displayName}'s prediction`,
    description: prediction.content,
  };
}

export default async function PredictionDetailPage({
  params,
}: {
  params: Promise<{ username: string; predictionId: string }>;
}) {
  const { username, predictionId } = await params;
  const session = await auth();

  const prediction = await getPredictionById(predictionId, session?.user?.id);
  if (!prediction) {
    notFound();
  }

  // Keep the URL canonical (author's current username), same pattern as
  // any vanity-URL profile link.
  if (prediction.author.username !== username) {
    redirect(`/${prediction.author.username}/${predictionId}`);
  }

  const commentsPage = await getCommentsPage(predictionId, session?.user?.id);

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to feed
        </Link>
        <PredictionCard
          prediction={prediction}
          isAuthenticated={Boolean(session?.user)}
        />

        {/* Tree vertical connector line from Prediction Post into Conversation */}
        <div className="relative pl-6 -my-2">
          <div className="h-4 w-0.5 bg-border/80" />
        </div>

        <ConversationView
          predictionId={predictionId}
          initialComments={commentsPage.items}
          totalCount={commentsPage.totalCount}
          isAuthenticated={Boolean(session?.user)}
          currentUser={session?.user}
        />
      </main>
    </>
  );
}
