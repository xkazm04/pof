# UI Perfectionist — Wave 7 Fix Summary

> 7 commits, 7 findings closed (or canonically-bridged).

Wave 7 is the final wave of the scan-fix pipeline. Focus this wave was a11y polish, fixing Tailwind JIT-incompatible runtime classes, and unifying the severity vocabulary across four sibling subsystems. Where prior waves built primitives and consolidated patterns, this wave repaired the gaps those primitives could not see — keyboard focus indication, JIT class emission, and cross-engine type vocabulary.

## Per-commit table

| # | Hash    | Subject                                                                  | Files | Findings closed |
|---|---------|--------------------------------------------------------------------------|-------|-----------------|
| 1 | 8e9dec1 | add focus-visible ring to InteractivePill                                | 1     | 29 polish       |
| 2 | 834b57f | add focus-visible rings to ActivityFeed + ErrorBoundary buttons          | 2     | 30.4            |
| 3 | b8685e5 | replace JIT-incompatible runtime classes with static/style               | 5     | 32.3 + 28.2     |
| 4 | 95fb3d0 | add proper a11y to Tooltip primitive                                     | 1     | 29.2            |
| 5 | 4f9e91b | add focus-visible rings to materials buttons                             | 2     | 14 polish       |
| 6 | 2797a67 | SidebarL1 layoutId indicator + CLI tab height stability                  | 2     | 30.2 + 30.3     |
| 7 | 8dbc3ee | canonical Severity vocabulary + per-engine bridge                        | 5     | 21.1 + 22.1     |
| 8 | (this doc) | wave-7 fix summary + cumulative summary                               | 2     | —               |

## What was fixed

### Fix 2 — `InteractivePill` focus ring (29 polish)

`InteractivePill` and `MultiInteractivePill` (`src/components/ui/InteractivePill.tsx`) used `focus:outline-none` with no replacement, removing the keyboard focus indicator entirely. Added `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` so the ring shows for keyboard users only (not mouse clicks). Two button sites updated.

### Fix 7 — ActivityFeed + ErrorBoundary focus rings (finding 30.4)

`ActivityFeedPanel.tsx` "Read all" / close / Fix / Dismiss buttons + `ModuleErrorBoundary.tsx` Retry / Copy / details-toggle buttons previously had no visible focus indicator. Added `focus-visible:ring-2 focus-visible:ring-accent` across these chrome buttons. For the opacity-on-hover Fix and Dismiss buttons, `focus-visible` also reveals the button (`focus-visible:opacity-100 focus-visible:scale-100`) so keyboard users can see what's focused.

### Fix 4 — JIT-incompatible runtime classes (findings 32.3 + 28.2)

Tailwind JIT scans source for static class strings; template-string classes built from runtime values silently emit no styling. Two patterns fixed:

- `bg-[${STATUS_WARNING}${OPACITY_10}]` and `text-[${STATUS_WARNING}]` in `SessionAnalyticsDashboard.tsx` (2 sites) → switched to inline `style={{ backgroundColor, color }}` since `STATUS_WARNING` and `OPACITY_10` are raw hex/alpha values.
- `hover:${CLI_COLORS.error}` (a Tailwind class) in `InlineTerminal.tsx`, `TerminalHeader.tsx` and `disabled:hover:${CLI_COLORS.prompt}` in `ErrorCard.tsx` (2 sites) and `WarningAggregator.tsx` (1 site) → inlined the literal `hover:text-red-400` / `disabled:hover:text-blue-400` so JIT sees them statically.

The non-disabled `hover:` cases in ErrorCard/WarningAggregator that used `${CLI_COLORS.prompt}` as a non-prefixed class (template-as-classname rather than template-after-Tailwind-prefix) work fine — those just expand to `text-blue-400` and JIT picks them up. Only the prefix-after-template forms were broken.

### Fix 1 — Tooltip a11y rewrite (finding 29.2)

`src/components/ui/Tooltip.tsx` was hover-only: no `role="tooltip"`, no `aria-describedby` linkage to the trigger, no keyboard focus support, no Escape-to-dismiss. Rewrote to clone the single child trigger with `aria-describedby`/`onFocus`/`onBlur`/`onKeyDown`, add `role="tooltip"` with a stable `useId`, show on focus and hover, and dismiss on Escape (both via the trigger's onKeyDown and a global keydown listener while open). Visual API preserved (relative positioning, same surface tokens, same z-index). Portal/positioning intentionally deferred — the report noted those are bigger PRs. The component had no current consumers in the codebase, so the API change (children must be a single ReactElement) is forward-only.

### Fix 3 — Materials button focus rings (finding 14 polish)

Material generate / preview buttons in `PostProcessStackBuilder.tsx` (2 sites) and `MaterialPatternCatalog.tsx` (2 sites) used `outline-none` with no replacement. Added `focus-visible:ring-1 focus-visible:ring-text/40` to the four primary action buttons. The text-input `outline-none` cases in `MaterialsView.tsx`, `MaterialStyleTransfer.tsx`, and `MaterialPatternCatalog.tsx` (3 sites) were already paired with `focus:border-border-bright`, which gives a focus indicator via the border color change — those were left untouched.

### Fix 6 — SidebarL1 indicator math + CLI tab 2px-jump (findings 30.2 + 30.3)

`SidebarL1.tsx` used hard-coded `BUTTON_STRIDE = 44` and `TOP_OFFSET = 22` magic numbers to position the active indicator. Any change to button height or padding would silently desync the indicator from the active item. Replaced with a Framer Motion `layoutId` span rendered inside the active button — positioning derives from the live DOM, animation uses Framer's spring, and `useReducedMotion` disables the animation when requested.

`CLITabBar.tsx` applied `border-t-2` only to the active tab, adding 2px height and shifting non-active siblings vertically. Now always reserves the 2px with `border-t-2 border-transparent` and only colors it when active — tab heights are stable across active/inactive states.

### Fix 5 — Canonical Severity vocabulary (findings 21.1 + 22.1)

Four sibling subsystems declared four overlapping severity scales:

- crash-analyzer: `'critical' | 'high' | 'medium' | 'low'`
- codebase-archeologist: `'critical' | 'warning' | 'info'`
- asset-code-oracle: `'error' | 'warning' | 'info'`
- performance-profiling: `'critical' | 'high' | 'medium' | 'low'` (named `OptimizationPriority`)

Created `src/types/severity.ts` with a canonical `Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'positive'`, `SEVERITY_RANK` for sort order, `compareSeverityDesc`, and `legacyToCanonical(input)` — the safe-default mapper that handles `error → high`, `warning → medium`, `major → high`, `minor → medium`, `fatal → critical`, and unknown → `medium`. Per-engine types now document either:

1. Strict subset of canonical (crash, performance) → pass through, no conversion needed
2. Engine-internal scale, deprecated for UI use (codebase, asset-oracle) → views should call `legacyToCanonical(severity)` at the boundary

The engine-internal logic (e.g. `severityWeight()` in codebase-archeologist's aggregate counts, the `error/warning/info` discriminator in asset-oracle's violation reports) is left intact, so persisted DB enums and existing aggregations are untouched. This is the conservative ship the brief called for ("canonical type alias + 1 vocab migration"), with the migration done as documentation/aliasing rather than physical type-renames — full call-site migration is a follow-up.

## Patterns established (catalogue items 33–37)

- **33. Canonical `Severity` vocabulary** (`src/types/severity.ts`) — `Severity`, `SEVERITY_RANK`, `compareSeverityDesc`, `legacyToCanonical`. UI components consume this; engine-internal types map at the boundary.
- **34. `focus-visible:ring-2 focus-visible:ring-accent` chrome pattern** — the canonical replacement for `focus:outline-none` on button-shaped chrome. Shows on keyboard focus, suppressed on mouse click. Combine with `focus-visible:ring-offset-1` for inset/depth-tinted surfaces.
- **35. Inline `style={{ backgroundColor, color }}` for hex+alpha** — when a class string can't be statically known (because the color comes from a hex constant + opacity hex), emit via `style` rather than `bg-[${...}]` template-class. JIT cannot scan the latter.
- **36. `<motion.span layoutId={...}>` for sliding active indicators** — replaces `transform: translateY(N * STRIDE + OFFSET)` magic-number positioning. Indicator positioning derives from live DOM via Framer Motion's shared-layout animation, no measurement hooks needed.
- **37. `border-t-2 border-transparent` reservation for tab indicators** — when the active tab needs a colored top border, always reserve the height with `border-transparent` so non-active siblings don't shift when the active state moves.

## What remains (followups / skipped)

### Skipped or partial this wave

- **Fix 1 (finding 29.2) — portal + positioning skipped.** Tooltip still uses `position: absolute` relative to its container; clipped tooltips at edges of overflow-hidden parents will still clip. Portal+positioning is the next layer (e.g. swap to Radix or `@floating-ui/react`) — significantly larger PR.
- **Fix 5 (findings 21.1 + 22.1) — full call-site migration skipped.** The canonical type, helpers, and per-engine annotations ship; the engine-internal switch statements (`severityWeight`, `bySeverity` aggregates, view-layer color maps) still consume legacy values directly. Sweeping every consumer to use `legacyToCanonical` was out of scope for the wave's risk budget.
- **Findings 22.2 (lifecycle vocabularies), 22.3 (engine-emoji output), 22.4 (health-band thresholds), 22.5 (InsightCategory presentation map)** were not addressed this wave — each is a structurally similar consolidation that deserves its own focused pass.

### Followups (within the closed findings)

- **30.4 — focus-ring sweep.** Other chrome buttons (header bar, command palette, modal close buttons) likely still have `focus:outline-none` without replacement. The pattern is now established and easy to replicate — a future "grep `focus:outline-none` without `focus-visible:`" sweep could close them in one wave.
- **30.2 — SidebarL2 active indicator.** The L2 sidebar may have the same magic-number positioning. Wasn't audited this wave.
- **32.3 / 28.2 — JIT runtime-class sweep.** Other components may have similar `bg-[${...}]` patterns. A future grep sweep would close any remaining ones in one wave.

`tsc --noEmit` was 0 before each commit and remains 0 after the wave.
