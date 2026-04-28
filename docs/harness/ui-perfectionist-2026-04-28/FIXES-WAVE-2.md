# Wave 2 Fix Summary — UI Perfectionist 2026-04-28

> 7 commits (6 fixes + 1 followups doc), 7 findings closed (1 skipped to followup).

## Per-commit table

| # | hash | finding | files |
|---|------|---------|-------|
| 1 | f2bf755 | 18.1 | src/components/modules/game-systems/TacticalCoverAnalysis.tsx |
| 2 | e27f07c | 06.1 | src/lib/economy/definitions.ts; src/components/modules/core-engine/unique-tabs/{LootTableVisualizer/data.ts, ItemEconomySimulator/constants.ts, AILootDesigner/constants.ts} |
| 3 | 911bfbb | 12.1, 12.4 | src/components/modules/content/ui-hud/{InventoryGridDesigner.tsx, MenuFlowDiagram.tsx} |
| 4 | ae3b8ab | 26.1, 26.6 | src/components/modules/project-setup/{SetupWizard.tsx, PathBrowser.tsx, ProjectFilesPanel.tsx, ProjectSetupModule.tsx} |
| 5 | 82cb4b5 | 18.2, 18.AIBehaviorView | src/components/modules/game-systems/{FlankAngleHeatmap.tsx, TacticalCoverAnalysis.tsx, SquadChoreographyEditor.tsx, AIBehaviorView.tsx} |
| 6 | — | 07.1 (skipped) | followup logged |
| 7 | a795ae6 | 15.2 | src/components/modules/content/audio/{AudioEventCatalog.tsx, SpatialAudioGeneratorPanel.tsx, AudioPipelineDiagram.tsx} |
| — | 57f50a8 | docs | docs/harness/followups-2026-04-28.md |

## What was fixed

**Fix 1 — Mountain SVG positioning bug.** Lucide icons render as `<svg>` elements; `x`/`y` props are silently ignored. The TacticalCoverAnalysis cover diagram had its obstacle markers collapsed to (0,0) regardless of the obstacle position. Wrapped each `<Mountain>` in a `<g transform="translate(...)">`.

**Fix 2 — Rarity colour single source of truth.** Three loot consumers had forked rarity → colour maps with subtly different values. Promoted the LootTableVisualizer set into `@/lib/economy/definitions.ts` as `RARITY_COLOR_MAP` and rewired all three sites to consume it. Legacy LootTableVisualizer export is now a re-export for back-compat.

**Fix 3 — HUD/Models indigo to violet.** InventoryGridDesigner and MenuFlowDiagram had ~120 hard-coded indigo values (`text-indigo-*`, `border-indigo-*`, `rgba(99,102,241,...)`). Mapped to the violet Tailwind palette + violet rgba — the Tailwind class set aligned with `ACCENT_VIOLET` in chart-colors.

**Fix 4 — Project Setup brand-green to token.** Four project-setup files inlined `#00ff88` via Tailwind arbitrary-value classes. Mechanical swap to the `accent-setup` Tailwind token already wired through globals.css and used by sibling files like StatusChecklist.

**Fix 5 — AI behaviour heatmap ramps.** Three game-system surfaces each had a hand-rolled red→yellow→green RGB lerp. Replaced with the canonical `heatmapScale()` from chart-colors. AIBehaviorView pass/fail counters and delete-hover replaced raw `text-[#4ade80]` / `text-[#f87171]` with `STATUS_SUCCESS`/`STATUS_ERROR` (and Tailwind `red-400` for the hover where inline style was awkward).

**Fix 6 — CombatSimulatorView (skipped).** On inspection, the divergence claimed in finding 07.1 (`SurfaceCard` vs `BlueprintPanel` between Combat and its siblings) does not match the current state — `EconomySimulatorView` uses the same `SurfaceCard` + Tailwind named-colour pattern as Combat. Logged as followup pending review of `PostProcessStudioView` and a canonical-pattern decision.

**Fix 7 — Audio cyber-blue to content amber.** Three audio panels hard-coded a cyber-blue palette. Mapped Tailwind `blue-*` → `amber-*` (the palette aligned with `MODULE_COLORS.content` / `#f59e0b`) and rewrote `rgba(59,130,246,...)` → equivalent amber rgba.

## Patterns established (catalogue items 7-13)

7. **Lucide icons inside SVG: wrap, don't position.** `<Mountain x={...} y={...}>` is silently broken — wrap in `<g transform="translate(x, y)">`.
8. **Single-source rarity map.** `@/lib/economy/definitions.ts` exports `RARITY_COLOR_MAP` (capitalised keys, optional widening). All loot consumers re-export or import; no per-file forks.
9. **Indigo theme is just violet in disguise.** When migrating raw indigo, use the Tailwind `violet-*` palette plus `rgba(167,139,250,...)` — these match the `ACCENT_VIOLET` (`#a78bfa`) chart-colors token. Don't introduce a new token; reuse the existing.
10. **`accent-setup` not `[#00ff88]`.** The `accent-setup` Tailwind class is wired via `var(--setup)` in globals.css. Always prefer named tokens over arbitrary-value brackets when the token already exists.
11. **`heatmapScale()` over hand-rolled lerps.** Any 0-1 → red→yellow→green ramp belongs to `heatmapScale()`. Do not re-derive RGB midpoints inline.
12. **Module accent ≠ closest hue.** Audio panels used cyber-blue, but the canonical content-module accent is amber. Migrate to module accent even when the visual change is dramatic — the report sketch explicitly calls out `MODULE_COLORS.<module>` as the target.
13. **Mechanical class swaps via PowerShell regex.** For Tailwind class migrations across 100+ sites, regex find-replace with negative-numeric lookaheads (`blue-500(?!\d)`) is faster than per-line edits and verifiable via `grep` post-pass.

## What remains (out-of-scope drift spotted)

- **EconomySimulatorView** uses identical Tailwind named-colour patterns to CombatSimulatorView — re-evaluate alongside fix 6's followup.
- **StatusChecklist.tsx** in project-setup uses `bg-red-400`/`text-red-400` for failure states; should map to a `STATUS_ERROR`-derived token.
- **Unused imports** post-migration in `AILootDesigner/constants.ts` and `ItemEconomySimulator/constants.ts` (STATUS_NEUTRAL/STATUS_SUCCESS no longer referenced after RARITY_COLORS rewire). Tree-shake pass deferred.
- **MenuFlowDiagram.tsx** line 513: `stroke={isSelected ? 'rgba(167,139,250,1)' : ...}` — could become the `ACCENT_VIOLET` constant.
- **Codegen consumer** in LootTableVisualizer indexes `RARITY_COLOR_MAP[stringVar]`; the canonical export was widened with `Record<string, string>` to keep it loose. Stricter cast at the call site is the more correct fix.
- **Other audio panels** (not in scope: `AudioMixerPreview`, `BeatGridPanel` if present) may also use the cyber-blue theme — out of scope for this wave.

## Verification

`npx tsc --noEmit` → 0 errors after every fix and at end of wave.
