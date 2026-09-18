"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpSchema, verifyEmailSchema } from "@/lib/validation/auth";
import type { ApiError, ApiSuccess } from "@/lib/api-response";

type FieldErrors = Partial<
  Record<"displayName" | "email" | "password" | "code", string>
>;

export function SignUpForm() {
  const router = useRouter();
  const [step, setStep] = useState<"DETAILS" | "VERIFY">("DETAILS");

  // Step 1: Details
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2: Verification
  const [code, setCode] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function handleSignUpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});

    const parsed = signUpSchema.safeParse({ displayName, email, password });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as ApiSuccess<unknown> | ApiError;

      if (!body.success) {
        if (body.code === "EMAIL_TAKEN") {
          setFieldErrors({ email: body.message });
        } else {
          toast.error(body.message);
        }
        return;
      }

      toast.success("Verification code sent to your email.");
      setStep("VERIFY");
      setResendCooldown(60);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});

    const parsed = verifyEmailSchema.safeParse({ email, code });
    if (!parsed.success) {
      setFieldErrors({ code: parsed.error.issues[0]?.message });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json()) as ApiSuccess<unknown> | ApiError;

      if (!body.success) {
        setFieldErrors({ code: body.message });
        toast.error(body.message);
        return;
      }

      // Automatically sign in now that email is verified
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        toast.success("Email verified! Please sign in.");
        router.push("/sign-in");
        return;
      }

      toast.success("Welcome to Wager.");
      router.push("/onboarding");
      router.refresh();
    } catch {
      toast.error("Verification failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (!email || resendCooldown > 0 || isResending) return;

    setIsResending(true);
    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type: "EMAIL_VERIFICATION" }),
      });
      const body = (await res.json()) as ApiSuccess<unknown> | ApiError;

      if (!body.success) {
        toast.error(body.message);
        return;
      }

      toast.success("A new 6-digit code has been sent.");
      setResendCooldown(60);
    } catch {
      toast.error("Failed to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  }

  if (step === "VERIFY") {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={handleVerifySubmit}
        noValidate
      >
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center text-sm text-muted-foreground">
          Enter the 6-digit code sent to{" "}
          <span className="font-semibold text-white">{email}</span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="code">Verification code</Label>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendCooldown > 0 || isResending}
              className="text-xs text-white/70 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : isResending
                  ? "Sending…"
                  : "Resend code"}
            </button>
          </div>
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="text-center font-mono text-lg tracking-widest"
            disabled={isSubmitting}
            autoFocus
          />
          {fieldErrors.code && (
            <p className="text-error text-center text-sm">
              {fieldErrors.code}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="mt-2 w-full"
          disabled={isSubmitting || code.length !== 6}
        >
          {isSubmitting ? "Verifying…" : "Verify & continue"}
        </Button>

        <button
          type="button"
          onClick={() => {
            setStep("DETAILS");
            setCode("");
            setFieldErrors({});
          }}
          className="text-xs text-white/60 hover:text-white transition-colors text-center mt-1"
        >
          Entered wrong email? Edit details
        </button>
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSignUpSubmit}
      noValidate
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          aria-invalid={Boolean(fieldErrors.displayName)}
          disabled={isSubmitting}
        />
        {fieldErrors.displayName && (
          <p className="text-error text-sm">{fieldErrors.displayName}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(fieldErrors.email)}
          disabled={isSubmitting}
        />
        {fieldErrors.email && (
          <p className="text-error text-sm">{fieldErrors.email}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(fieldErrors.password)}
          disabled={isSubmitting}
        />
        {fieldErrors.password && (
          <p className="text-error text-sm">{fieldErrors.password}</p>
        )}
      </div>

      <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
