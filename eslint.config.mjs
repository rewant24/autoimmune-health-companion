import { defineConfig, globalIgnores } from "eslint/config";
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores([
    "convex/_generated/**",
    ".next/**",
    "bakeoff-output/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
  coreWebVitals,
  typescript,
  {
    rules: {
      // React Compiler-era rules: real findings, but fixing them is a page-level
      // refactor (the setState-in-effect hits are the localStorage get-or-create
      // snippet that the auth-seams refactor removes). Warn until that burn-down.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      // _-prefixed bindings are the project's intentional-unused convention.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);
