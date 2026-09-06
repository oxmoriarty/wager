import { cache } from "react";
import Link from "next/link";
import { PenLine, Search, Wallet } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUnreadNotificationCount } from "@/lib/queries/notifications";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationBell } from "@/components/notifications/notification-bell";

const getHeaderProfile = cache(async (userId: string) => {
  return prisma.profile.findUnique({
    where: { userId },
    select: { username: true, displayName: true, avatarUrl: true },
  });
});

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SearchLink() {
  return (
    <Link
      href="/search"
      prefetch={true}
      className="text-muted-foreground hover:text-foreground flex size-8 items-center justify-center transition-colors"
      aria-label="Search"
    >
      <Search className="size-5" />
    </Link>
  );
}

function WalletLink() {
  return (
    <Link
      href="/wallet"
      prefetch={true}
      className="text-muted-foreground hover:text-foreground flex size-8 items-center justify-center transition-colors"
      aria-label="Wallet"
    >
      <Wallet className="size-5" />
    </Link>
  );
}

export async function AppHeader() {
  const session = await auth();

  const [profile, unreadCount] = session?.user?.id
    ? await Promise.all([
        getHeaderProfile(session.user.id),
        getUnreadNotificationCount(session.user.id),
      ])
    : [null, 0];

  return (
    <header className="border-border flex items-center justify-between border-b px-4 py-3 sm:px-6">
      <Link
        href="/"
        prefetch={true}
        className="text-foreground text-lg font-semibold tracking-tight"
      >
        Wager
      </Link>

      {profile ? (
        <div className="flex items-center gap-3">
          <Button asChild size="sm" className="h-8 gap-1.5 px-3 text-xs">
            <Link href="/?compose=true" prefetch={true}>
              <PenLine className="size-3.5" />
              <span>Predict</span>
            </Link>
          </Button>
          <SearchLink />
          <WalletLink />
          <NotificationBell initialUnreadCount={unreadCount} />
          <Link
            href={`/${profile.username}`}
            prefetch={true}
            title="View your profile"
          >
            <Avatar className="size-8">
              <AvatarImage
                src={profile.avatarUrl ?? undefined}
                alt={profile.displayName}
              />
              <AvatarFallback className="text-xs">
                {initials(profile.displayName)}
              </AvatarFallback>
            </Avatar>
          </Link>
          <SignOutButton size="sm" />
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm">
          <SearchLink />
          <Link
            href="/sign-in"
            prefetch={true}
            className="text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            prefetch={true}
            className="text-foreground font-medium hover:underline"
          >
            Sign up
          </Link>
        </div>
      )}
    </header>
  );
}
