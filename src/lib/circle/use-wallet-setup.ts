"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { executeCircleChallenge } from "@/lib/circle/web-sdk";
import type { ApiError, ApiSuccess } from "@/lib/api-response";

type WalletInitData = {
  hasWallet: boolean;
  arcWalletAddress: string | null;
  challengeId?: string;
  userToken: string;
  encryptionKey: string;
};

async function parseApiResponse<T>(
  response: Response,
): Promise<ApiSuccess<T> | ApiError> {
  return (await response.json()) as ApiSuccess<T> | ApiError;
}

const CIRCLE_APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;

/**
 * Drives Circle wallet provisioning: `POST /api/wallet/init` for a
 * challenge (or a fresh token if the wallet already exists), the client
 * Web SDK to complete it, then `POST /api/wallet/setup-confirm` to
 * persist the result. Shared by `MarketStakePanel` (inline "set up
 * wallet to stake" prompt) and `WalletCard` (the `/wallet` page's own
 * setup CTA) — written once here rather than duplicated in both.
 */
export function useWalletSetup() {
  const router = useRouter();
  const [isSettingUp, setIsSettingUp] = useState(false);

  async function setupWallet(): Promise<boolean> {
    setIsSettingUp(true);
    try {
      if (!CIRCLE_APP_ID) {
        toast.error("Wallet setup isn't configured yet — missing app id.");
        return false;
      }

      const response = await fetch("/api/wallet/init", { method: "POST" });
      const body = await parseApiResponse<WalletInitData>(response);
      if (!body.success) {
        toast.error(body.message);
        return false;
      }

      if (!body.data.hasWallet && body.data.challengeId) {
        await executeCircleChallenge({
          appId: CIRCLE_APP_ID,
          userToken: body.data.userToken,
          encryptionKey: body.data.encryptionKey,
          challengeId: body.data.challengeId,
        });

        const confirmResponse = await fetch("/api/wallet/setup-confirm", {
          method: "POST",
        });
        const confirmBody = await parseApiResponse<{
          arcWalletAddress: string;
        }>(confirmResponse);
        if (!confirmBody.success) {
          toast.error(confirmBody.message);
          return false;
        }
      }

      toast.success("Your Arc wallet is ready.");
      router.refresh();
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Wallet setup failed.",
      );
      return false;
    } finally {
      setIsSettingUp(false);
    }
  }

  return { isSettingUp, setupWallet };
}
