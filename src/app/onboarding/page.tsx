import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AuthCard } from "@/components/auth/auth-card";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const metadata: Metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      onboardedAt: true,
    },
  });

  if (!profile) {
    redirect("/sign-in");
  }
  if (profile.onboardedAt) {
    redirect("/");
  }

  return (
    <AuthCard
      title="Set up your profile"
      description="This is how other predictors will see you."
    >
      <OnboardingForm
        initialUsername={profile.username}
        initialDisplayName={profile.displayName}
        initialBio={profile.bio ?? ""}
        initialAvatarUrl={profile.avatarUrl}
      />
    </AuthCard>
  );
}
