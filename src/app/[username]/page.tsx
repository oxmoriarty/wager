import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProfileByUsername } from "@/lib/queries/profile";
import { getPredictionsByAuthor } from "@/lib/queries/feed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileStat } from "@/components/profile/profile-stat";
import { FollowButton } from "@/components/profile/follow-button";
import { AppHeader } from "@/components/layout/app-header";
import { PredictionCard } from "@/components/feed/prediction-card";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatMemberSince(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) return { title: "Profile not found" };

  return {
    title: `${profile.displayName} (@${profile.username})`,
    description: profile.bio ?? `${profile.displayName} on Wager.`,
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [profile, session] = await Promise.all([
    getProfileByUsername(username),
    auth(),
  ]);

  if (!profile) {
    notFound();
  }

  const isOwnProfile = session?.user?.id === profile.userId;

  const [isFollowing, isFollowingBack, predictions] = await Promise.all([
    session?.user?.id
      ? prisma.follow
          .findUnique({
            where: {
              followerId_followingId: {
                followerId: session.user.id,
                followingId: profile.userId,
              },
            },
            select: { id: true },
          })
          .then(Boolean)
      : Promise.resolve(false),
    // Does the profile owner follow the viewer back?
    session?.user?.id
      ? prisma.follow
          .findUnique({
            where: {
              followerId_followingId: {
                followerId: profile.userId,
                followingId: session.user.id,
              },
            },
            select: { id: true },
          })
          .then(Boolean)
      : Promise.resolve(false),
    getPredictionsByAuthor(profile.userId, session?.user?.id),
  ]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <Card className="items-center gap-4 text-center">
          <Avatar className="size-24">
            <AvatarImage
              src={profile.avatarUrl ?? undefined}
              alt={profile.displayName}
            />
            <AvatarFallback className="text-2xl">
              {initials(profile.displayName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-foreground text-xl font-semibold">
                {profile.displayName}
              </h1>
              {isOwnProfile && <Badge variant="secondary">You</Badge>}
            </div>
            <p className="text-muted-foreground text-sm">@{profile.username}</p>
          </div>

          {profile.bio && (
            <p className="text-foreground/90 max-w-md text-sm">{profile.bio}</p>
          )}

          <p className="text-muted-foreground text-xs">
            Member since {formatMemberSince(profile.memberSince)}
          </p>

          <CardContent className="w-full flex-row items-center justify-center gap-8 p-0 pt-2">
            <ProfileStat label="Predictions" value={profile.predictionCount} />
            <ProfileStat label="Followers" value={profile.followerCount} />
            <ProfileStat label="Following" value={profile.followingCount} />
          </CardContent>

          <CardContent className="w-full flex-row items-center justify-center gap-8 border-t p-0 pt-2">
            <ProfileStat label="Wins" value={profile.totalWins} />
            <ProfileStat
              label="Win Rate"
              value={`${Math.round(profile.winRate * 100)}%`}
            />
            <ProfileStat
              label="Claimed"
              value={`$${Number(profile.totalClaimed).toFixed(2)}`}
            />
          </CardContent>

          {!isOwnProfile && (
            <FollowButton
              username={profile.username}
              isAuthenticated={Boolean(session?.user)}
              initialIsFollowing={isFollowing}
              initialIsFollowingBack={isFollowingBack}
            />
          )}
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-sm font-medium">
            Predictions
          </h2>
          {predictions.length === 0 ? (
            <Card className="text-muted-foreground items-center py-10 text-center text-sm">
              {isOwnProfile
                ? "You haven't made any predictions yet."
                : `${profile.displayName} hasn't made any predictions yet.`}
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {predictions.map((prediction) => (
                <PredictionCard
                  key={prediction.id}
                  prediction={prediction}
                  isAuthenticated={Boolean(session?.user)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
