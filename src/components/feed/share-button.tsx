"use client";

import { useState } from "react";
import { Check, Share } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ShareButton({
  username,
  predictionId,
  className,
}: {
  username: string;
  predictionId: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "";
    const url = `${origin}/${username}/${predictionId}`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success("Post link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link to clipboard.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      title={copied ? "Link copied!" : "Share post"}
      className={cn(
        "flex items-center gap-1.5 transition-colors text-muted-foreground hover:text-foreground",
        copied && "text-emerald-500 hover:text-emerald-500",
        className,
      )}
    >
      {copied ? (
        <Check className="size-4 text-emerald-500" />
      ) : (
        <Share className="size-4" />
      )}
    </button>
  );
}
