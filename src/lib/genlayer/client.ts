import { createClient, createAccount, isSuccessful } from "genlayer-js";
import type { Address } from "genlayer-js/types";
import { GENLAYER_CHAIN, GENLAYER_EXPLORER_URL } from "./network";

export { isSuccessful };

const globalForGenLayer = globalThis as unknown as {
  genLayerClient: ReturnType<typeof createClient> | undefined;
};

/**
 * Shared GenLayer client targeting Studio Next (Consensus v0.6).
 *
 * Lazily created so importing this module has no side effects when
 * GenLayer env vars aren't set (e.g. local dev without a deployed
 * contract yet) — the error only surfaces if something actually tries
 * to use the client.
 */
export function getGenLayerClient() {
  if (globalForGenLayer.genLayerClient) {
    return globalForGenLayer.genLayerClient;
  }

  const privateKey = process.env.GENLAYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "GENLAYER_PRIVATE_KEY is not set. Required to sign write calls " +
        "(e.g. triggering fixture discovery) against GenLayer Studio Next.",
    );
  }

  const account = createAccount(privateKey as `0x${string}`);
  const client = createClient({ chain: GENLAYER_CHAIN, account });

  globalForGenLayer.genLayerClient = client;
  return client;
}

export function getFixtureDiscoveryAddress(): Address {
  const address = process.env.GENLAYER_FIXTURE_DISCOVERY_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error(
      "GENLAYER_FIXTURE_DISCOVERY_CONTRACT_ADDRESS is not set. Deploy " +
        "genlayer/contracts/fixture_discovery.py to Studio Next first " +
        `(see genlayer/README.md or ${GENLAYER_EXPLORER_URL}).`,
    );
  }
  return address as Address;
}

export function getMatchMonitoringAddress(): Address {
  const address = process.env.GENLAYER_MATCH_MONITORING_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error(
      "GENLAYER_MATCH_MONITORING_CONTRACT_ADDRESS is not set. Deploy " +
        "genlayer/contracts/match_monitoring.py to Studio Next first " +
        `(see genlayer/README.md or ${GENLAYER_EXPLORER_URL}).`,
    );
  }
  return address as Address;
}

export function getSettlementContractAddress(): Address {
  const address = process.env.GENLAYER_SETTLEMENT_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error(
      "GENLAYER_SETTLEMENT_CONTRACT_ADDRESS is not set. Deploy " +
        "genlayer/contracts/settlement.py to Studio Next first " +
        `(see genlayer/README.md or ${GENLAYER_EXPLORER_URL}).`,
    );
  }
  return address as Address;
}
