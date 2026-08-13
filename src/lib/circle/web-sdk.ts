/** Minimal shape we actually read off Circle's challenge result. Not
 * imported from `@circle-fin/w3s-pw-web-sdk` directly — its `ChallengeResult`
 * type isn't re-exported from the package root, only from an internal
 * subpath that isn't part of its public API surface. */
export interface CircleChallengeOutcome {
  status: string;
}

/**
 * Wraps Circle's `W3SSdk.execute()` (a callback API) in a Promise so
 * components can `await` it. Dynamically imports the SDK — it touches
 * `window`/injects an iframe on construction, so it must never load
 * during server rendering; only call this from a Client Component.
 *
 * Resolves once the user completes the challenge in Circle's hosted
 * PIN/passkey modal (wallet setup, or authorizing a stake transaction).
 * Rejects on error, expiry, or explicit failure.
 */
export async function executeCircleChallenge(params: {
  appId: string;
  userToken: string;
  encryptionKey: string;
  challengeId: string;
}): Promise<CircleChallengeOutcome> {
  const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");

  const sdk = new W3SSdk({
    appSettings: { appId: params.appId },
    authentication: {
      userToken: params.userToken,
      encryptionKey: params.encryptionKey,
    },
  });

  return new Promise<CircleChallengeOutcome>((resolve, reject) => {
    sdk.execute(params.challengeId, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      if (!result) {
        reject(new Error("Circle challenge completed with no result."));
        return;
      }
      resolve(result as CircleChallengeOutcome);
    });
  });
}
