# Generation Quality (CLI #1) — Status & Next Directions

**Goal:** Encode the vertical-slice initiative's hard-won UE lessons into PoF's prompt/generation machinery so future autonomous runs produce wired, runnable-out-of-the-box C++/Python on first generation.

**Spec:** `docs/superpowers/specs/2026-05-23-generation-quality-design.md`
**Branch:** `master` (PoF app repo) — committed locally; user pushes manually.

> The original 8-task TDD plan is fully implemented. The detailed step-by-step content has been removed (it now lives in the code + commits below). What remains here is a delivery ledger plus proposed next directions.

---

## Delivered (implemented + tested)

All six new vitest files pass (31 new tests). Typecheck clean; the touched files introduce zero new lint errors.

| Area | What shipped | Commit |
|------|--------------|--------|
| Knowledge pack | `src/lib/knowledge/{types,ue-gotchas,binary-content}.ts` — `PromptKind`, `UE_GOTCHAS` (7 seeded pitfalls), `formatGotchas`, binary-content tripwire | `6a490d8`, `0ddb76c` |
| Context header | `prompt-context.ts` injects gotchas + tripwire for UE prompts via `ContextHeaderOptions.promptKind` (default `'ue-cpp'`); web branch untouched | `6a0451e` |
| Wiring section | `PromptBuilder.withWiringRequirements()` emits the `## Wiring Requirements` section (granting / activation / dependencies / verification) + a `wiring` output-schema field; `audit()` reports it | `e4dc5c3` |
| Evaluator | `module-eval-prompts.ts` Pass 0 "Ground Truth" prepended to `EVAL_PASSES`; the two exhaustive `Record<EvalPass,…>` literals in `ScanTab.tsx` patched | `8249c7f` |
| Wiring assets | `feature-definitions.ts` `WiringAsset`, `MODULE_WIRING_ASSETS` (explicit entry for all 37 `SubModuleId`s), `getWiringAssets`, `moduleNeedsBinaryContent` | `e8edf5c` |
| Matrix surface | `FeatureMatrix.tsx` "needs binary content" badge driven by `moduleNeedsBinaryContent` | `ed4036d` |

---

## Still out of CLI #1 scope (owned elsewhere)

Unchanged from the spec's non-goals — listed so they are not re-attempted here:

- **UE-project (`pof-exp`) edits** — owned by the system CLIs (#2/#3/#4/#7).
- **`game.md` conventions** (DefaultAbilities base, code-widget base, lifecycle logs, WITH_EDITOR audit, self-check console commands) — owned by the UE-side CLIs.
- **LRU-suspend / dispatch-reliability** — owned by CLI #8.

---

## Proposed Next Development Directions

The machinery now exists but is only partially *connected*. The defaults make the knowledge injection active for UE prompts, yet the two opt-in surfaces (`promptKind` overrides and `withWiringRequirements`) have no callers, and the `wiring` field the model is now asked to emit is not yet captured. The highest-leverage follow-ups close those loops.

### 1. Route the correct `promptKind` from the task layer (highest leverage)

**Today:** every UE prompt resolves to `'ue-cpp'`, so Python-only gotchas (Constant3Vector pin, Interchange-FBX crash, plugin-content rescan, FBX scale) and the packaging gotcha (`cmd.exe` quote-wrap) are never injected where they actually bite.

**Do:** thread a `promptKind` through `buildTaskPrompt(task, ctx)` / the `TaskFactory` methods in `src/lib/cli-task.ts` and the per-module builders in `src/lib/prompts/`. Asset/Python automation tasks pass `'ue-python'`; cook/build/packaging tasks pass `'packaging'`; everything else keeps the `'ue-cpp'` default. Add a unit test asserting a packaging task's header contains the `cmd.exe` quote-wrap gotcha and a python task's contains the Constant3Vector one.

### 2. Feed `MODULE_WIRING_ASSETS` into the prompts via `withWiringRequirements`

**Today:** `withWiringRequirements` is defined but unused, and `getWiringAssets` is only consumed by the matrix badge — so the known per-module wiring hints never reach Claude.

**Do:** in the checklist / feature-fix prompt builders, map `getWiringAssets(moduleId)` → `WiringRequirement[]` and call `.withWiringRequirements(...)` so the known WBP/BT/ABP/DataTable hints render as the section's table. This turns the static asset map into live prompt guidance with near-zero added code.

### 3. Capture and surface the `wiring` output field end-to-end

**Today:** the prompt asks the model for a `wiring` field per artifact, but the callback parser/validator in `src/lib/cli-task.ts` ignores it and the feature-matrix DB has nowhere to store it.

**Do:** extend the callback schema + feature-matrix row to persist the model's declared wiring (granted-by / activated-by / deps / verification) and show it in the `FeatureMatrix` expanded detail. This makes "did it actually wire this?" auditable after a run, not just requested before one.

### 4. Make Pass 0 a gate, not just a first pass

**Today:** Ground Truth runs first but is treated like any other pass in `DeepEvalResults`/`ScanTab` — its output doesn't influence whether the later passes run.

**Do:** if the Ground-Truth pass reports it could not confirm a referenced class/property, short-circuit the structure/quality/performance passes for that module and emit a single "request read-only inventory first" finding. Surface the gate distinctly in the eval UI.

### 5. Auto-promote recurring build errors into gotchas

**Today:** `UE_GOTCHAS` is a hand-curated static list; the error-memory DB already tracks recurring build errors separately.

**Do:** add a path that promotes a sufficiently-recurring `ErrorContextEntry` into a candidate `Gotcha` (with `appliesTo` inferred from category), so the pack grows from real runs instead of only manual edits. Keep promotion behind a review step to avoid noise.

### 6. Verify declared binary assets against the live project

**Today:** `moduleNeedsBinaryContent` flags that a module *should* have a WBP/BT/ABP, but nothing checks whether it *exists*.

**Do:** tie `MODULE_WIRING_ASSETS` to the PoF↔UE bridge's asset manifest so the matrix can show red when a declared binary asset is missing from the project — directly catching the "compiles but never wired" defect class the initiative kept hitting.
