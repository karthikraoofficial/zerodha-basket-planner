import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Read-only app: the Kite SDK ships order-placement methods. See docs/adr/0004.
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "kiteconnect", message: "Banned: use lib/kite (allow-listed, read-only). See ADR 0004." }] },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".scratch/**"]),
]);
