import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { DiscoverFeed } from "@/components/feed/discover-feed";
import { LandingPage } from "@/components/landing/landing-page";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { onboardedAt: true },
    });

    if (!profile?.onboardedAt) {
      redirect("/onboarding");
    }

    return (
      <>
        <AppHeader />
        <DiscoverFeed />
      </>
    );
  }

  return <LandingPage />;
}
