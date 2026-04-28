# UI Perfectionist Wave 2 — Followups

## Fix 6 (07.1) — CombatSimulatorView "parallel design system"

**Status:** SKIPPED in wave 2 — re-investigate scope.

The finding claimed CombatSimulatorView uses Tailwind named colours (`bg-amber-400` etc.) while siblings `EconomySimulatorView` and `PostProcessStudioView` use `BlueprintPanel` + chart-colors tokens. On inspection both `CombatSimulatorView.tsx` and `EconomySimulatorView.tsx` use `SurfaceCard` + identical Tailwind named-colour patterns (`text-amber-400`, `text-emerald-400`, `bg-amber-500/10`, etc.). They are not divergent in the way described.

`PostProcessStudioView` may still use BlueprintPanel (not checked in this wave) — if so the divergence is between Combat/Economy (one cluster) and PostProcess (another), not between Combat alone and the others.

**Recommended next step:** open all three siblings side-by-side, decide canonical pattern, then either bring all to BlueprintPanel or accept SurfaceCard + named-colour as the evaluator-module convention. Wave 2 declined to make a unilateral migration without that decision.

## Out-of-scope drift spotted during wave 2

- `EconomySimulatorView.tsx` — same Tailwind named-colour usage as Combat (`text-amber-400`, `text-emerald-400`, `text-red-400`, `text-violet-400`). Migrate alongside CombatSimulatorView once canonical pattern decided.
- Project-setup `StatusChecklist.tsx` — uses `bg-red-400` / `text-red-400` for failure states; should use `STATUS_ERROR` token (`text-status-error` if such Tailwind class exists). Out of scope for wave 2 (only 4 listed files).
- `LootTableVisualizer/codegen.ts` — depended on the loose-typed `RARITY_COLOR_MAP` index access; widened the canonical export's signature with a `Record<string, string>` intersection. A stricter consumer-side fix would be `RARITY_COLOR_MAP[minRarity as CanonicalRarity]`.
- AILootDesigner `constants.ts` and ItemEconomySimulator `constants.ts` — STATUS_NEUTRAL/STATUS_SUCCESS imports retained from before; some are now unused since RARITY_COLORS no longer references them. Leave for a tree-shake pass.
- `MenuFlowDiagram.tsx` line 513 — `stroke={isSelected ? 'rgba(167,139,250,1)' : ...}` could be replaced with the canonical `ACCENT_VIOLET` constant rather than the rgba literal.
