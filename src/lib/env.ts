import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),

  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),

  DATABASE_URL: z.url().or(z.string().startsWith("postgresql://")),

  GENLAYER_RPC_URL: z.url().optional(),
  GENLAYER_CHAIN_ID: z.coerce.number().optional(),
  GENLAYER_PRIVATE_KEY: z.string().optional(),
  GENLAYER_FIXTURE_DISCOVERY_CONTRACT_ADDRESS: z.string().optional(),
  GENLAYER_MATCH_MONITORING_CONTRACT_ADDRESS: z.string().optional(),
  GENLAYER_SETTLEMENT_CONTRACT_ADDRESS: z.string().optional(),

  ARC_RPC_URL: z.url().optional(),
  ARC_CHAIN_ID: z.coerce.number().optional(),
  ARC_PRIVATE_KEY: z.string().optional(),
  ARC_USDC_ADDRESS: z.string().optional(),
  ARC_ESCROW_CONTRACT_ADDRESS: z.string().optional(),
  ARC_MARKET_CONTRACT_ADDRESS: z.string().optional(),
  ARC_REWARDS_CONTRACT_ADDRESS: z.string().optional(),

  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "❌ Invalid environment variables:",
      z.treeifyError(parsed.error),
    );
    throw new Error("Invalid environment variables. See .env.example.");
  }

  return parsed.data;
}

// Skip hard validation during `next build`'s static analysis pass and in
// test runs where secrets are intentionally absent; real requests still
// go through loadEnv() via the exported `env` below at runtime.
export const env = loadEnv();
