# 01 · Generation Quality — Closure Outcome (2026-05-24)

Status of the pending §01 points after the closure session.

## App side (this repo) — CLOSED ✅

The closure plan `docs/superpowers/plans/2026-05-23-generation-quality-closure.md` was executed.
Commits (local; user pushes manually):

| § | What landed | Commit |
|---|---|---|
| #1 | `formatWiringRequirements()` extracted to `src/lib/knowledge/wiring-requirements.ts`; `PromptBuilder.withWiringRequirements()` delegates | `feat(knowledge): extract formatWiringRequirements` |
| #1 | `buildTaskPrompt` (`cli-task.ts`) **injects** the Wiring Requirements block + the module's `MODULE_WIRING_ASSETS` for UE `checklist`/`quick-action`/`feature-fix` dispatches (the block previously never reached a dispatched prompt) | `feat(cli-task): inject Wiring Requirements into UE generation dispatches` |
| tests | Registry-wide `wiring-smoke.test.ts` over every `SUB_MODULE_IDS` (deterministic stand-in for the harness wiring-smoke mode) | `test(registry): registry-wide wiring-smoke` |
| #6 | `cliPanelStore.createSession` cap guard — at `MAX_SESSIONS` reuses the stalest **idle** tab, never clobbers a running dispatch | `fix(cli): don't clobber a running session at the tab cap` |
| #5 | `WiringAssetsPanel` + `FeatureMatrix` "needs binary content" badge is now a toggle revealing per-module wiring assets (binary-only kinds flagged) | `feat(matrix): WiringAssetsPanel` + `feat(matrix): expand binary-content badge` |

§5 note: wiring assets remain a **module-level** map (`MODULE_WIRING_ASSETS` in `feature-definitions.ts`),
not a per-feature field — this is the intentional design (one wiring-decision per module, enforced by
`feature-definitions-wiring.test.ts`), and the matrix now surfaces it. Pre-existing items (binary-content
tripwire, `ue-gotchas` pack, evaluator Pass 0, wiring-asset metadata + their unit tests) were already done.

**Verification:** all 1067 vitest tests pass (incl. the 5 new test files); the touched files typecheck
and lint clean. The project-wide `npm run validate` was red **only** because of concurrent sessions'
in-flight edits to unrelated files (`leonardo.ts`, `ue-known-assets`, `visual-check`) — none of the
failures are in §01 files.

## Game side (separate `pof-exp` UE repo) — SPEC + PLAN written, not executed here

A read-only ground-truth pass (the §01 "ground-truth first" discipline) found that **folders 02–08
already shipped most of game.md** — exactly as the §01 README predicted. The remaining work is small
*deltas*, captured for a UE-capable session in:

- Spec: `docs/superpowers/specs/2026-05-24-generation-quality-game-side-design.md`
- Plan: `docs/superpowers/plans/2026-05-24-generation-quality-game-side.md`

Verified state (UE repo, 2026-05-24):

| § | Already exists | Remaining delta |
|---|---|---|
| §1 | `ARPGCharacterBase::DefaultAbilities` granted in `PossessedBy` | Generalise via `IARPGDefaultsProvider` (effects + IMC arrays) |
| §2 | `UARPGCodeWidgetBase` (RebuildWidget+BuildTree+helper toolbox); `VSHUDWidget` uses it | Migrate `BossHealthBarWidget` off `NativeConstruct` |
| §3 | `AnimAssetCommandlet` produces real data | `EmptyShell` marker + fail-loud on degenerate output |
| §4 | `ARPGLogCategories.h` (10 categories) | `LogARPGLifecycle` + `ARPG_LIFECYCLE_LOG` macro |
| §5 | `PofTestRunner` `FEditorDelegates` already `#if WITH_EDITOR` | Recorded runtime-module audit (Shipping-clean) |
| §6 | `ARPG.Verify.Characters/HUD/Combat/Slice/SliceCI` | Add `ARPG.Verify.Loot` + `ARPG.Verify.All` |

## Tests pending

- Game-side #1/#2/#3 → Tasks 2/1/7 of the game-side plan (UE functional tests + Verify commands).
- e2e `HARNESS_MODE=wiring-smoke` (live) → game-side plan Task 8 (app repo; deterministic vitest
  stand-in already merged here).
- `gemini-recognize` plumbing → game-side plan Task 9 — **spec only**: the `gemini-recognize.mjs` CLI is
  absent from the repo, so there is nothing to plumb against until it is (re)added.
