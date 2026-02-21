import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Warn on raw console usage — use src/lib/logger.ts instead.
      // console.error is allowed since it's the standard error-reporting path.
      "no-console": ["warn", { allow: ["error"] }],
      // Warn on explicit 'any' to encourage proper typing.
      "@typescript-eslint/no-explicit-any": "warn",
      // Discourage hardcoded hex colors — use chart-colors.ts tokens or CSS variables instead.
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{6,8}$/]",
          message: "Avoid hardcoded hex colors. Import from @/lib/chart-colors or use a CSS variable.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
