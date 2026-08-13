import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // arc/ is a separate Foundry (Solidity) project — its lib/ directory
    // vendors OpenZeppelin's own JS/TS test tooling, which isn't part of
    // the Next.js app and shouldn't be linted against this config.
    "arc/**",
  ]),
]);

export default eslintConfig;
