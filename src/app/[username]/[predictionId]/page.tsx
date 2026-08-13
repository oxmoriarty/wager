import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getPredictionById } from "@/lib/queries/feed";
import { getCommentsPage } from "@/lib/queries/comments";
import { AppHeader } from "@/components/layout/app-header";
import { PredictionCard } from "@/components/feed/prediction-card";
import { CommentComposer } from "@/components/feed/comment-composer";
import { CommentList } from "@/components/feed/comment-list";

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

  const commentsPage = await getCommentsPage(predictionId);

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8 sm:px-6">
        <PredictionCard
          prediction={prediction}
          isAuthenticated={Boolean(session?.user)}
        />
        <CommentComposer
          predictionId={predictionId}
          isAuthenticated={Boolean(session?.user)}
        />
        <CommentList predictionId={predictionId} initialPage={commentsPage} />
      </main>
    </>
  );
}
