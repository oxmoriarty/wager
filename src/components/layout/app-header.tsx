import Link from "next/link";
import { Search, Wallet } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUnreadNotificationCount } from "@/lib/queries/notifications";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationBell } from "@/components/notifications/notification-bell";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function SearchLink() {
  return (
    <Link
      href="/search"
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
        prisma.profile.findUnique({
          where: { userId: session.user.id },
          select: { username: true, displayName: true, avatarUrl: true },
        }),
        getUnreadNotificationCount(session.user.id),
      ])
    : [null, 0];

  return (
    <header className="border-border flex items-center justify-between border-b px-4 py-3 sm:px-6">
      <Link
        href="/"
        className="text-foreground text-lg font-semibold tracking-tight"
      >
        Wager
      </Link>

      {profile ? (
        <div className="flex items-center gap-3">
          <SearchLink />
          <WalletLink />
          <NotificationBell initialUnreadCount={unreadCount} />
          <Link href={`/${profile.username}`} title="View your profile">
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
            className="text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-foreground font-medium hover:underline"
          >
            Sign up
          </Link>
        </div>
      )}
    </header>
  );
}
