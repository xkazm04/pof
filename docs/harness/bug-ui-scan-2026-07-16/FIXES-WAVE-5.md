# Bug+UI Scan Fix Wave 5 — Visual Correctness & Design-System Highs (Fable-led)

> 5 commits, 10 High-severity UI findings closed. All five fix agents ran on Fable for maximum visual quality, in parallel on disjoint contexts.

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `5c2da6ad` fix(project-setup): re-skin SetupWizard to the app design system | project-setup-onboarding #6 | SetupWizard.tsx |
| 2 | `73b60f8a` fix(feature-matrix,inventory): measured sticky offset + keyboard-equippable slots | module-registry-feature-matrix #6, inventory-system #6 | FeatureMatrix/{index,FeatureList}.tsx, EquipmentLoadoutSection.tsx |
| 3 | `ddbe6afe` fix(world,ai-behavior): fit topology viewBox to nodes + robust drag past SVG bounds | world-quests-procgen #3, ai-behavior-squad-tactics #2 | TopologyGraph.tsx, useDragAngle.ts (+ both consumers), +3 new hook tests |
| 4 | `eb7c3e51` fix(character,progression): direction-aware comparison bars + derived grid + true max-level curve | character-genome-designer #6, progression-save-systems #1 #5 | ComparisonMatrix ×2, BuildPathComparison.tsx, _shared/data.ts ×2 |
| 5 | `aaea198f` fix(abilities,cli): reliable cross-tab search scroll + full-log rich rendering | abilities-gas-system #1, cli-terminal-task-system #6 | sub_ability/index.tsx, TerminalOutput/* (5 files), useScrollSync.ts, CompactTerminal.tsx |

## What was fixed

1. **SetupWizard foreign design system** — the app's first screen wore the layout-lab "Blueprint" identity (`--lab-*` vars, lab primitives). Re-skinned to the shared Project Setup design language (SurfaceCard, text tiers, accent-setup, UnderlineTabs, ui Button). Logic/testids untouched — visual only.
2. **Sticky headers vs. wrapping filter row** — hardcoded `top-[40px]` replaced by a measured `--fm-sticky-offset` (ref + ResizeObserver); headers sit flush at any wrap count.
3. **Mouse-only paper-doll** — equipment slots became real buttons: Enter/Space, aria-labels, rarity-colored focus-visible rings.
4. **Clipped topology nodes** — viewBox computed from actual node bounds (data spans x≈66–870 vs. the old `0 0 460 300`); responsive SVG; tooltip clamping follows.
5. **Drag drops at SVG edge** — `useDragAngle` now uses pointer capture + window-level pointerup/cancel; both consumers (FormationView, HeatmapSvg) migrated off `onPointerLeave`; 3 new hook tests.
6. **Comparison bars ignored stat direction** — lower-is-better rows now invert bar fill (longer = better everywhere), direction-aware best-value pick. *Context-map drift catch:* the scanned `GenomeComparisonTable.tsx` was deleted on this branch; the live bug sat in `unique-tabs/ComparisonMatrix` + `simulator/ComparisonMatrix` — both fixed.
7. **3-column grid for 5 presets** — columns derive from `BUILD_PRESETS.length`; toggle row wraps.
8. **XP curve never reached Max Level** — sampling now ends exactly at MAX_LEVEL(50); the "Max XP" pill matches the plotted level-50 cost.
9. **Cross-tab search scroll silently no-oped** — the 250ms-timeout-vs-300ms-animation race replaced by a bounded rAF poll waiting for the target element (scoped by a new `data-spellbook-tab` attribute), cancelled on re-navigation.
10. **Rich log rendering lost past 8 entries** — the react-window plain-text window removed; the full log rich-renders with memoized structurally-compared rows + `content-visibility:auto`, so Fix buttons/highlighting/entity tags survive scrolling with no perf regression.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors (full project, after all 5 commits) |
| Full `vitest run` | 4466 passed (+9 new tests) / 1 failed (LayoutLab.navigation, pre-existing) / 5 skipped — **0 regressions** |

Per-agent local suites during the wave: 22/22 (SetupWizard-area), 53 (FeatureMatrix/inventory), 17/17 (drag/topology, incl. 3 new), 49 (charts), 62/62 (terminal/ability).

## Pattern catalogue (items 10–12)

10. **Magic layout constants are wrap-fragile** — any hardcoded sticky offset / viewBox / column count that encodes "current content size" breaks the moment content grows (filter wraps, node coords expand, presets added). Derive from measurement (ResizeObserver/bounds/length), never restate the current value.
11. **Timeout-vs-animation races** — scrolling/focusing an element that mounts behind an exit animation must wait for the element, not a magic delay. Bounded rAF poll or effect-on-mount keyed by pending target.
12. **Direction-aware comparisons** — any bar/highlight comparing stats needs a per-stat higher-is-better flag wired into *every* visual channel (length, color, crown), not just one.

## Cumulative status (Waves 1–5)

- **9/9 Criticals + 28 Highs** closed (11 W3 + 7 W4 + 10 W5), 28 fix commits + 5 wave summaries.
- ~12 High remain (data-corruption cluster: slug/timestamp-ID collisions, global-state leaks, destructive-action guards, re-audit wipes, snooze expiry, remaining races: economy sim, GDD generate, layout-lab drain/produce-fix, blueprint parse/transpile, AI-testing mark-running, crash-pattern filter reset, blender hydration + name-keyed graph, loot UE5 import source, combo opener index, item tooltip artifact).

## What remains

Wave 6: the data-integrity High cluster above, then the Medium/Low tail + test backfill for the uncovered contexts (Character wizard, Inventory catalog, Global search).
