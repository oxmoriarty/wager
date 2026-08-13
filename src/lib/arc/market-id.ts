import { keccak256, stringToBytes } from "viem";
import type { Hex } from "viem";

/**
 * Derives the `bytes32` market id `Market.sol`/`Escrow.sol` use on-chain
 * from Wager's own Prisma `Market.id` (a cuid string). The chain never
 * sees the cuid directly — this hash is the only thing that crosses the
 * boundary, and it must be computed identically every time for a given
 * Prisma id (same input -> same hash, always).
 *
 * See `arc/README.md`'s "Market Contract" section — this is documented
 * there too, since both sides of the boundary need to agree on it.
 */
export function toOnChainMarketId(prismaMarketId: string): Hex {
  return keccak256(stringToBytes(prismaMarketId));
}
