"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton({ size }: { size?: "default" | "sm" }) {
  return (
    <Button
      variant="outline"
      size={size}
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      Log out
    </Button>
  );
}
