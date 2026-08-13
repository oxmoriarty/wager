"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { onboardingSchema } from "@/lib/validation/profile";
import type { ApiError, ApiSuccess } from "@/lib/api-response";

const BIO_MAX_LENGTH = 280;
const USERNAME_FORMAT = /^[a-z0-9_]{3,20}$/;

type FieldErrors = Partial<Record<"username" | "displayName" | "bio", string>>;
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";
type CheckResult = { username: string; available: boolean } | null;

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function OnboardingForm({
  initialUsername,
  initialDisplayName,
  initialBio,
  initialAvatarUrl,
}: {
  initialUsername: string;
  initialDisplayName: string;
  initialBio: string;
  initialAvatarUrl: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(initialUsername);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarPreview, setAvatarPreview] = useState(initialAvatarUrl);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [checkResult, setCheckResult] = useState<CheckResult>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasChanged = username !== initialUsername;
  const formatValid = USERNAME_FORMAT.test(username);

  // Purely derived from existing state — never set synchronously in the
  // effect below, which only performs the actual (debounced, async)
  // availability check.
  const usernameStatus: UsernameStatus = !hasChanged
    ? "idle"
    : !formatValid
      ? username.length > 0
        ? "invalid"
        : "idle"
      : checkResult?.username === username
        ? checkResult.available
          ? "available"
          : "taken"
        : "checking";

  useEffect(() => {
    if (!hasChanged || !formatValid) return;

    const timeout = setTimeout(() => {
      fetch(
        `/api/profile/username-availability?username=${encodeURIComponent(username)}`,
      )
        .then((response) => response.json())
        .then((body: ApiSuccess<{ available: boolean }>) => {
          setCheckResult({
            username,
            available: Boolean(body.data?.available),
          });
        })
        .catch(() => {
          // Network hiccup — leave status as "checking"; the user can
          // still submit and the server re-validates authoritatively.
        });
    }, 400);

    return () => clearTimeout(timeout);
  }, [username, hasChanged, formatValid]);

  async function handleAvatarChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setAvatarPreview(localPreview);
    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as
        ApiSuccess<{ avatarUrl: string }> | ApiError;

      if (!body.success) {
        toast.error(body.message);
        setAvatarPreview(avatarUrl);
        return;
      }

      setAvatarUrl(body.data.avatarUrl);
      setAvatarPreview(body.data.avatarUrl);
    } catch {
      toast.error("Couldn't upload your avatar. Please try again.");
      setAvatarPreview(avatarUrl);
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});

    const parsed = onboardingSchema.safeParse({
      username,
      displayName,
      bio,
      avatarUrl: avatarUrl ?? "",
    });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    if (usernameStatus === "taken") {
      setFieldErrors({ username: "That username is already taken." });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/profile/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as ApiSuccess<unknown> | ApiError;

      if (!body.success) {
        if (body.code === "USERNAME_TAKEN") {
          setFieldErrors({ username: body.message });
        } else {
          toast.error(body.message);
        }
        return;
      }

      toast.success("Profile set up. Welcome to Wager.");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const usernameHint: Record<UsernameStatus, string | null> = {
    idle: null,
    checking: "Checking availability…",
    available: "Username is available",
    taken: "That username is already taken",
    invalid: "3-20 characters: letters, numbers, underscores",
  };
  const usernameHintClass: Record<UsernameStatus, string> = {
    idle: "text-muted-foreground",
    checking: "text-muted-foreground",
    available: "text-success",
    taken: "text-error",
    invalid: "text-error",
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col items-center gap-3">
        <Avatar className="size-20">
          <AvatarImage src={avatarPreview ?? undefined} alt={displayName} />
          <AvatarFallback className="text-lg">
            {initials(displayName || "?")}
          </AvatarFallback>
        </Avatar>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleAvatarChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploadingAvatar}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploadingAvatar ? "Uploading…" : "Choose photo"}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          aria-invalid={
            Boolean(fieldErrors.username) || usernameStatus === "taken"
          }
          disabled={isSubmitting}
        />
        {fieldErrors.username ? (
          <p className="text-error text-sm">{fieldErrors.username}</p>
        ) : (
          usernameHint[usernameStatus] && (
            <p className={`text-sm ${usernameHintClass[usernameStatus]}`}>
              {usernameHint[usernameStatus]}
            </p>
          )
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
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
        <div className="flex items-center justify-between">
          <Label htmlFor="bio">Bio</Label>
          <span className="text-muted-foreground text-xs">
            {bio.length}/{BIO_MAX_LENGTH}
          </span>
        </div>
        <Textarea
          id="bio"
          value={bio}
          maxLength={BIO_MAX_LENGTH}
          onChange={(e) => setBio(e.target.value)}
          aria-invalid={Boolean(fieldErrors.bio)}
          disabled={isSubmitting}
          placeholder="Tell people what you're about."
        />
        {fieldErrors.bio && (
          <p className="text-error text-sm">{fieldErrors.bio}</p>
        )}
      </div>

      <Button
        type="submit"
        className="mt-2 w-full"
        disabled={isSubmitting || isUploadingAvatar}
      >
        {isSubmitting ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
