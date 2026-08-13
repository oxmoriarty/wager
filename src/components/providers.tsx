"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { Toaster } from "sonner";

import { UserRoomSync } from "@/components/realtime/user-room-sync";

export function Providers({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <UserRoomSync />
      {children}
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--surface)",
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
          },
        }}
      />
    </SessionProvider>
  );
}
