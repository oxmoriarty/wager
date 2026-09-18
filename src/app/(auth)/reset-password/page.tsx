import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Set a new password"
      description="Enter the 6-digit code sent to your email and your new password."
      footer={
        <>
          Back to{" "}
          <Link
            href="/sign-in"
            className="text-white hover:text-white/80 font-medium underline underline-offset-4"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
