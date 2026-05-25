# Phase 11 · Design-system + a11y + observability · Batch Roadmap

> Multi-session work. ~37 KEEP-INFRA ideas, mostly cross-cutting polish.

## Status (2026-05-25) — CUTOVER-CRITICAL SLICE DONE; remainder triaged

Reframed against the Phase 12 cutover: only infra that hardens the **surfaces ECW keeps** is in
scope. The bulk of the 37 ideas polish **legacy UI that cutover deletes** (combat/range sliders, cook
toggles, BP design-system extract, planning-view headers, autosave radios, disclosure widgets, …) —
**moot at cutover, dropped.** Shipped the concentrated ECW-relevant infra:

- ✅ **Batch 1 (earlier):** GlossaryTerm + 28-entry glossary, computeVelocityForecast + ForecastCard real numbers (`ecw-phase-11-batch1-complete`).
- ✅ **11-DS — `FindingList`** (`858eb36` + `43b672b`): shared lint-finding list colored from `SEVERITY_TOKENS` (not hardcoded `text-*-500`); the 5 analysis facets (Balance/Economy/Combat/Zone/Montage) refactored onto it (removed 5 duplicated ICON/COLOR maps). Covers `1a0c060d`/`ae37291c` (token + card/color unify) where it ships.
- ✅ **11-OBS / a11y — `FacetErrorBoundary`** (`748a701`): isolates a throwing facet so it can't white-screen the inspector once ECW is the only shell; logs via console.error; `role=tabpanel` added to the facet tab strip. Cutover-critical robustness (no legacy fallback post-12).

**Deferred (genuine ECW enhancements, NOT cutover blockers):** `3b8efd65` retry/DLQ for CLI dispatch
(touches useModuleCLI — bigger piece), arrow-key roving-tabindex on the L1/facet tablists (current
tabs already have role/aria-selected + focus-ring), `5258d1c7` Shiki in CLI code blocks (shared
highlighter already exists). These can land post-cutover without risk.

**Verdict: Phase 11 resolved for cutover purposes.** The default shell has consistent design-system
severity coloring and per-facet error isolation; nothing legacy-polish-shaped blocks Phase 12.

## Batch 11-DS · Design system unification

Tokenization + primitive extraction:
- `1a0c060d` (type + status tokens), `874fca7f` (typography + contrast)
- `19e9e14d` (stat-card unify), `ae37291c` (card + color unify)
- `22128354` (range slider primitive), `fa9c6bcf` (combat slider a11y)
- `accb9971` (tooltip primitive), `6c133627` (chart a11y)
- `3e4198df` (NotifyTrack primitive)
- `53283c35` (BP design-system extract)
- `da8d4fef` (asset picker), `e4e85439` (image ID picker)
- `15c6b41d` (planning view headers)

## Batch 11-A11Y · Accessibility pass

- `44258ac1` (kbd + screen reader), `0e92c0c3` (SVG a11y)
- `15133ebe` (graph kbd nav)
- `7ee002af` (type-scale floor), `5dacc4ff` (legibility floor)
- `dbe94b74` (focus ring/ARIA), `df8cc965` (disclosure kbd/ARIA)
- `bd6e00e8` (cook toggle a11y), `b9507567` (autosave → radio)

## Batch 11-UX · UX polish

- `143ff660` (glossary), `53af0c30` (glossary tooltips)
- `d3b45c2e` (TopBar de-jargon)
- `bd48e23d` (panel transitions), `c9ca41c5` (pipeline stepper)
- `1d0dd943` (error-proof simulation controls)

## Batch 11-OBS · Observability + CLI infra

- `2cbadfe1` (knowledge inbox)
- `3b8efd65` (retry/DLQ for CLI dispatch)
- `5258d1c7` (Shiki highlight in code blocks), `57d2e3ce` (adapter code highlight)
- `a2af29d5` (persist chat/layout)
- `ce85ff81` (bridge status strip)
- `b09719f3` (harmonize evolution UI)

## Sequencing recommendation
1. 11-DS first — unblocks 11-UX (depends on tokens) and improves the foundation visible in 11-A11Y.
2. 11-A11Y — independent, can run any time.
3. 11-UX + 11-OBS — last.

Each batch gets a dedicated plan file written when starting.
