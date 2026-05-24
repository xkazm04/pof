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

## Game side (separate `pof-exp` UE repo) — PARTIAL ✅ (4 of 6 deltas landed)

A read-only ground-truth pass (the §01 "ground-truth first" discipline) found that **folders 02–08
already shipped most of game.md** — exactly as the §01 README predicted. The remaining work is small
*deltas*, captured in the spec/plan:

- Spec: `docs/superpowers/specs/2026-05-24-generation-quality-game-side-design.md`
- Plan: `docs/superpowers/plans/2026-05-24-generation-quality-game-side.md`

Status of each delta (UE repo, 2026-05-24, local commits on `main`, not pushed):

| § | Delta | Status |
|---|---|---|
| §1 | Generalise `DefaultAbilities` → `IARPGDefaultsProvider` | **DONE** ✅ `21484e0` (`Source/PoF/Character/IARPGDefaultsProvider.h` + `ARPGCharacterBase` implements it; `PossessedBy` now applies `GetDefaultAbilities()` + new `GetDefaultEffects()`; `DefaultInputContexts` array surfaced, EnhancedInput consumer wiring deferred). 20 files rebuilt clean. |
| §2 | Migrate `BossHealthBarWidget` off `NativeConstruct` | **Pending** — RHI-needing widget test; medium risk |
| §3 | `EmptyShell` marker + fail-loud `AnimAssetCommandlet` | **Pending** — running the commandlet mutates shared `Content/`; highest collision risk |
| §4 | `LogARPGLifecycle` category + `ARPG_LIFECYCLE_LOG` macro | **DONE** ✅ `29b1bdb` (`Source/PoF/Debug/ARPGLifecycleLog.h` + categories + migrated `UARPGSaveSubsystem::Initialize/Deinitialize`) |
| §5 | Recorded WITH_EDITOR audit of bridge runtime | **DONE** ✅ `837d777` (`Plugins/PillarsOfFortuneBridge/WITH_EDITOR-audit.md`). Source-level: clean (every editor-only site already guarded). Stronger Shipping-compile gate attempted; failed on a **separate game-module issue** (`PoF.Build.cs` `FunctionalTesting` → `AutomationController` → `UnrealEdMessages`) — logged as a folder-07 follow-up. |
| §6 | `ARPG.Verify.Loot` + `ARPG.Verify.All` | **DONE** ✅ `fdd9f31` (Loot) + `cc2918d` (All registry iteration). Both `FAutoConsoleCommandWithWorld`, shipping-safe. Loot folded into `ARPG.Verify.Slice` aggregate. |

Each landed UE delta was built clean (`Build.bat PoFEditor Win64 Development`, 20–22s incremental, `Result: Succeeded`). Tests-game-side #3 (iterate self-checks) is `ARPG.Verify.All` and is also DONE. Game tests #1 (CodeWidget pattern) and #2 (DefaultAbilities smoke) remain pending — they're the test surface for §2 and §1 respectively.

## Tests

App-repo test items — DONE ✅ (2026-05-24):
- e2e wiring-smoke → `e2e/wiring-smoke.spec.ts`. Stub-mode e2e: drives a real checklist dispatch through
  the UI and asserts the captured `pof-cli-prompt` prompt carries `## Wiring Requirements` (+ `arpg-ui`'s
  `WBP_ARPGHUD`). No new `HARNESS_MODE` / no Claude CLI needed (stub capture). Complements the
  deterministic `src/__tests__/registry/wiring-smoke.test.ts`. Verified via `playwright test --list`;
  a full live run needs the dev server + mutates the shared checklist DB (operator's call).
- gemini plumbing → `docs/improvements/01-generation-quality/gemini-recognize-plumbing-spec.md`. Spec
  re-targeted at the live path `POST /api/verify/visual` (`gemini-2.0-flash`) since `gemini-recognize.mjs`
  is absent: deterministic no-key plumbing test (in validate) + opt-in key-gated shape snapshot + the
  CLI-form test for if/when the CLI returns.

Game-side (UE repo) tests:
- #3 iterate self-checks → **DONE** ✅ as `ARPG.Verify.All` (commit `cc2918d`, game-side plan Task 7).
- #1 CodeWidget pattern test → pending; ships with §2 `BossHealthBarWidget` migration.
- #2 `DefaultAbilities` smoke test → pending; ships with §1 `IARPGDefaultsProvider`.
