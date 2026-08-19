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
        {
          // Legibility floor: no Tailwind text-[<12px] arbitrary sizes. The design system's
          // floor is 12px (text-xs); dense meta uses text-2xs (10px) via ui/MicroLabel or the
          // TEXT_SCALE tokens, which own the justified exceptions.
          //
          // The regex covers 6 and 7 as well as 8–11: the original range silently
          // exempted the smallest sizes in the codebase (SVG chart labels), which is
          // the opposite of what a floor should do.
          selector: "Literal[value=/text-\\[(?:6|7|8|9|10|11)px\\]/]",
          message: "Text below the 12px legibility floor. Use text-xs (12px), or ui/MicroLabel / TEXT_SCALE for justified dense meta (WCAG 1.4.4).",
        },
        {
          // Same floor, seen through a template literal. A `Literal` selector only
          // matches plain string classNames, so every `className={`… text-[9px] …`}`
          // escaped the rule entirely — and template classNames are the dominant
          // form in this codebase.
          selector: "TemplateElement[value.raw=/text-\\[(?:6|7|8|9|10|11)px\\]/]",
          message: "Text below the 12px legibility floor (in a template className). Use text-xs (12px), or ui/MicroLabel / TEXT_SCALE for justified dense meta (WCAG 1.4.4).",
        },
        {
          // Same floor, expressed as an inline style. `style={{ fontSize: 9 }}` renders
          // exactly as illegibly as `text-[9px]` but was invisible to a className-only
          // rule. Numeric literals only — a computed size can't be judged statically.
          selector: "Property[key.name='fontSize'] > Literal[value<12][value>0]",
          message: "Inline fontSize below the 12px legibility floor. Use text-xs (12px), or ui/MicroLabel / TEXT_SCALE for justified dense meta (WCAG 1.4.4).",
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
    // Standalone tooling (e.g. the pof-mcp headless server) — separate package,
    // own tsconfig/lint; not part of the Next app build.
    "tools/**",
    // Git worktrees created under .claude/worktrees are full duplicate checkouts
    // of the app source; linting them double-counts every problem (and reports
    // stale copies of files being refactored). They are not part of this build.
    ".claude/**",
  ]),
]);

export default eslintConfig;
