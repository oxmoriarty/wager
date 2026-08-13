import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { AppHeader } from "@/components/layout/app-header";
import { DiscoverFeed } from "@/components/feed/discover-feed";

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

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24">
        <Card className="w-full max-w-md items-center text-center">
          <CardTitle className="text-2xl">Wager</CardTitle>
          <CardDescription>
            Every post is a prediction. Social football forecasting on GenLayer
            and Arc.
          </CardDescription>
          <CardContent className="flex w-full flex-col gap-3">
            <Button className="w-full" asChild>
              <Link href="/sign-up">Sign up</Link>
            </Button>
            <Button className="w-full" variant="outline" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
