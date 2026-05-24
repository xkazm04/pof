# Outcome — Character PoF-app modules (Character CLI deliverable #2)

**Date:** 2026-05-24 · **Status:** DONE, app-side. `npm run typecheck` clean +
full vitest suite green (1161 tests). All changes are PoF-app-side (committed
locally; user pushes manually). No UE-project changes.

Closes the **App pending** items from [`README.md`](README.md) and the
[`pof-app.md`](pof-app.md) goals §1–§6, plus the app-side
[`tests.md`](tests.md) items. Extends the spec/plan in
`docs/superpowers/{specs,plans}/2026-05-23-character-known-assets-ai-generator*`.

## What shipped (app repo)

- **§2 `ue-known-assets` registry** (`src/lib/knowledge/ue-known-assets.ts`) —
  real `/MoverTests/` mannequin paths + `M_EnemyRed` + ThirdPerson fallback,
  with `formatKnownAssets(domains)` + `knownAssetDomainsForModule(id)`.
  Injected **opt-in, domain-scoped** at the gotchas seam in `prompt-context.ts`;
  `cli-task.ts` opts character/animation/enemy prompts in by `moduleId`, so
  generation uses exact paths instead of inventing them.
- **§4 AI BT-wall module surface** (`module-registry.ts` `ai-behavior`) —
  knowledge tip "BT graphs cannot be authored from Python" + an `ai-7`
  **pure-C++ `AARPGSimpleAIController`** checklist item (reflects the shipped
  controller from deliverable #1).
- **§5 enemy-contrast defaults** — `ENEMY_CONTRAST_MATERIALS` (red default +
  blue/green, never a subtle mannequin MI) + `arpg-enemy-ai` `qae-2` now
  defaults to a strongly-contrasting material.
- **§3 Mixamo import** — `mixamo-import` CLI task (full-editor
  `-ExecutePythonScript=mixamo_pipeline.py`, watched-folder + target-skeleton,
  callback → `mixamo-db` / `/api/animations/mixamo-result`) + `MixamoImport.tsx`
  surfacing the manual-download contract, added as an Animations tab.
- **§1 character-source wizard** (`CharacterSourceWizard.tsx`) — 3 discrete
  dispatches: pick+prepare source (UE Mannequin / Mixamo / Custom Blender) →
  wire mesh+skeleton+AnimBP via the `character-setup` task
  (`setup_characters_ue.py`) → verify locomotes. Stacked in `arpg-character`'s
  unique tab above `CharacterBlueprint`.
- **§6 locomotes Gemini gate** — `mode:'character'` added to
  `buildVisualCheckSection` + the server-owned `/api/verify/visual` route
  (humanoid / natural-pose / not-T-posed / enemy-distinct question) + a
  `ChecklistItem.characterCheck` flag, used by `arpg-character` `ac-6`
  "Verify character locomotes".

## Tests added (app-side, from tests.md)

- `ue-known-assets.test.ts` (data/format/snapshot) — tests.md app #1.
- `ai-behavior-surface.test.ts` (BT-wall tip + pure-C++ item) — tests.md app #3.
- `cli-task-mixamo.test.ts` (dispatch args = the watched-folder integration
  test's app-side realization) — tests.md app #2; + `mixamo-db.test.ts`.
- Plus: `enemy-contrast`, `known-assets-injection`, `cli-task-known-assets`,
  `cli-task-character-setup`, `character-locomotes`, and the `character` cases in
  `visual-check.test.ts`.

## Still pending (NOT app-side — needs the UE editor + a UE session)

These require the separate `pof-exp` UE repo, a running UE editor, and (for §1
attack anim) **manual Mixamo FBX downloads** (Mixamo has no API) — out of reach
from an app-repo session:

- **Game:** real attack animation (game.md §1), ranged archetype (§4), custom
  `UARPGAnimInstance` AnimBP (§6).
- **UE tests:** `AVSCharacterShapeTest`, `AVSAnimBPLocomotionTest`,
  `AVSCharacterDeathPosesTest`; the `character-swap` e2e + the committed
  `e2e/fixtures/gemini-prompts/character-check.txt` (the app-side route prompt
  now exists; the e2e fixture/spec still need authoring in a UE-capable session).

## Cross-cutting notes

- Shared app tree: `cli-task.ts`, `prompt-context.ts`, `module-registry.ts`,
  `types/modules.ts`, `visual-check.ts`, `verify/visual/route.ts` are
  concurrently-edited central files — all edits here were **additive**
  (new task types, a new opt field, new tips/items/modes). The §6 commit also
  carries a concurrent session's in-flight `lighting`-mode change in the shared
  `visual-check.ts`/`types/modules.ts`/`visual-check.test.ts` (committed only so
  HEAD type-checks — not part of this deliverable).
- Pre-existing/foreign lint errors (`require()` in `scatter-db.test.ts` /
  `procgen-db.test.ts` + `.claude/worktrees/` copies) remain; the new files are
  lint-clean (the mixamo-db test uses an async mock factory to avoid `require`).
