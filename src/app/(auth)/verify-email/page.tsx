import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata: Metadata = { title: "Verify email" };

export default function VerifyEmailPage() {
  return (
    <AuthCard
      title="Verify your email"
      description="Enter the 6-digit code sent to your email to activate your account."
      footer={
        <>
          Already verified?{" "}
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
        <VerifyEmailForm />
      </Suspense>
    </AuthCard>
  );
}
