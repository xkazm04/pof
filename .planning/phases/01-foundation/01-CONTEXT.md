# Phase 1: Foundation - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Vendor the Dzin panel framework source into PoF, install its dependency (`fast-json-patch`), create a CSS theme bridge mapping Dzin tokens to PoF's design system, wire Tailwind CSS 4 density variants, and verify everything compiles cleanly. No panels are built — this is pure infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Copy Scope
- Full copy of all Dzin modules (density/, layout/, panel/, registry/, theme/, types/, state/, chat/, llm/, intent/) — keeps imports intact, avoids broken references
- Include demo/ panels as working reference for testing layout in later phases
- Include __tests__/ for reference
- Keep Dzin source as-is — no conversion to PoF conventions. Copy verbatim, only fix path references if needed. Easier to sync upstream changes later.
- Keep Dzin's barrel export (index.ts) as single import point
- Install `fast-json-patch` as a dependency (comes with state/ module)

### Theme Bridge
- Create a **separate bridge CSS file** at `src/lib/dzin/theme/pof-bridge.css` — keeps Dzin theming isolated and removable
- **Import Dzin's default.css first**, then override with bridge CSS — gets structural `data-dzin-*` selectors for free, override tokens to use PoF's vars
- Import order in globals.css: Dzin default.css → pof-bridge.css
- Bridge CSS maps `--dzin-surface1` → `var(--background)`, `--dzin-surface2` → `var(--surface)`, `--dzin-accent` → PoF accent, etc.

### Import Structure
- PoF components import from `@/lib/dzin/core` (mirrors package structure: dzin/core/src)
- Dzin internal imports stay relative (./density, ../types) — no tsconfig alias changes needed
- Enforce `import type { ... }` for type-only imports per PoF convention
- Example: `import { DzinLayout, useDensity } from '@/lib/dzin/core'`
- Example: `import type { PanelDensity, PanelDefinition } from '@/lib/dzin/core'`

### Density Variants
- Keep Dzin's state.css for frame-level animations (panel enter/exit, LLM glow). Framer-motion reserved for content-level animations inside panels only. Two systems, explicit boundary.

### Claude's Discretion
- **Dynamic accent colors**: Claude decides how chart-colors (MODULE_COLORS, STATUS_*) reach Dzin panels — CSS vars vs props vs inline styles. Pick what avoids specificity fights.
- **Animation timing alignment**: Claude decides whether to override Dzin's 200ms to match PoF's 220ms or keep both. Pick what feels best.
- **Tailwind density variant approach**: Claude decides between @custom-variant, plain CSS selectors, or useDensity()-only. Pick what works most reliably with Tailwind CSS 4. If @custom-variant, Claude decides cascade behavior (children vs element-only).

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The key validation is that `npm run typecheck` and `npm run build` pass clean with Dzin included, and that a test element renders using PoF's dark theme colors.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/globals.css`: PoF's `:root` block with `--background`, `--surface`, `--border`, `--text`, `--text-muted` and accent tiers — direct mapping targets for Dzin tokens
- `src/lib/chart-colors.ts`: `MODULE_COLORS`, `STATUS_*`, opacity helpers — dynamic accent colors for panels
- `src/lib/constants.ts`: `UI_TIMEOUTS` with timing values — reference for animation alignment

### Established Patterns
- `@/` alias maps to `src/` in tsconfig — Dzin lives at `src/lib/dzin/core/` so imports are `@/lib/dzin/core`
- Tailwind CSS 4 via `@tailwindcss/postcss` — `@custom-variant` available if needed
- `'use client'` directive required on all client components — Dzin components may need this added
- No barrel files in PoF convention, but Dzin keeps its barrel as an exception (decided above)

### Integration Points
- `globals.css` — where Dzin bridge CSS gets imported
- `package.json` — where `fast-json-patch` gets added
- `tsconfig.json` — may need adjustments if Dzin's TS settings conflict
- `postcss.config.mjs` / `tailwind.config` — if @custom-variant approach is chosen

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-14*
