---
date: 2026-05-23
status: draft
sub_project: CLI #1 — Generation Quality (PoF-app prompt/scaffolding)
parent_initiative: PoF improvements synthesis — docs/improvements/01-generation-quality/
---

# CLI #1 — Generation Quality (PoF prompt/scaffolding)

## Context

This is one of eight isolated forked-CLI work streams synthesised from the
vertical-slice initiative (`docs/improvements/INDEX.md`). CLI #1 owns
**generation quality** — raising the *runnable-out-of-the-box* quality of the
UE C++/Python that Claude produces through PoF's module checklists. The
initiative repeatedly found generated code that *compiled but was never wired*
(no ability granted, no Input Mapping Context, BindWidget needing a WBP,
empty montage shells, an unguarded `FEditorDelegates`, the
`Constant3Vector` `""`-vs-`"RGB"` pin), each caught a whole sub-project too
late.

Per the folder's README, this concern's UE-side output is **better prompts,
not new game code**. Scope decision (brainstorm, 2026-05-23): implement the
**five PoF-app items only**, all under `src/` — no UE-project edits (those
overlap CLIs #2/#3/#4/#7), and not the LRU-suspend item (→ CLI #8).

## Goals

Encode the initiative's hard-won lessons into PoF's prompt/generation
machinery so future runs produce wired, runnable code on first generation:

1. A structured **Wiring Requirements** prompt section.
2. A **binary-content tripwire** in the shared context header.
3. A reusable **UE-gotchas knowledge pack**.
4. A **"Pass 0 — Ground Truth"** evaluator pass.
5. Module-level **`MODULE_WIRING_ASSETS`** + a feature-matrix surface.

## Non-goals

- **No UE-project (`pof-exp`) edits.** Outputs are prompts + PoF `src/` code.
- **No `game.md` conventions** (DefaultAbilities base, code-widget base,
  lifecycle logs, WITH_EDITOR audit, self-check commands) — those belong to
  the system CLIs that own those UE files.
- **No LRU-suspend / dispatch-reliability work** — CLI #8 owns it.
- **No new module / UI module** beyond the small matrix surface for (5).

## Decision record (brainstorm)

1. Scope = the 5 PoF-app prompt/scaffolding items, `src/`-only (chosen over
   "core 3 first" and over "include game.md").
2. **A1 — a shared `src/lib/knowledge/` data module + targeted injection**
   (chosen over A2, one bundled guardrails blob): fits the existing
   section-based `PromptBuilder` and the web/UE split in
   `buildProjectContextHeader`, and keeps each lesson independently
   snapshot-testable.

## Design

### 1 · `src/lib/knowledge/` (new directory)

- **`types.ts`** — `export type PromptKind = 'ue-cpp' | 'ue-python' | 'packaging' | 'web'`.
- **`ue-gotchas.ts`** — `export interface Gotcha { id: string; summary: string; detail: string; appliesTo: PromptKind[]; source: string }` and `export const UE_GOTCHAS: Gotcha[]`, seeded from the initiative:
  - `material-const3vector-pin` — `MaterialExpressionConstant3Vector` output pin is `""`, not `"RGB"`; `connect_material_property(node, "RGB", ...)` silently returns false → black material. (`ue-python`)
  - `umg-rebuildwidget-timing` — a code-only `UUserWidget` builds its Slate tree in `RebuildWidget()`, not `NativeConstruct()`. (`ue-cpp`)
  - `cmd-quote-wrap` — `cmd.exe /c <embedded-quoted command>` needs `windowsVerbatimArguments: true` **and** an outer-quote wrap. (`packaging`)
  - `interchange-fbx-commandlet-crash` — UE 5.7 FBX import via Interchange crashes under `-run=pythonscript`; use `UnrealEditor.exe -ExecutePythonScript=`. (`ue-python`)
  - `runtime-module-editor-api` — a `Runtime` module touching `FEditorDelegates`/`GEditor`/`FAssetTools` must `#if WITH_EDITOR`-guard or it breaks the Shipping build. (`ue-cpp`)
  - `plugin-content-rescan` — newly-enabled engine-plugin content (e.g. `MoverTests`) needs an asset-registry rescan under `-run=pythonscript`. (`ue-python`)
  - `fbx-import-scale` — Blender export `apply_unit_scale=True` + UE import `import_uniform_scale = 1.0` (not 100) for metre-authored meshes. (`ue-python`)
  - Plus `export function formatGotchas(kind: PromptKind): string` — renders the gotchas whose `appliesTo` includes `kind` as a `## Known UE Pitfalls` block (each: `- **summary** — detail (src)`), or `''` for `web`.
- **`binary-content.ts`** — `export const BINARY_CONTENT_TRIPWIRE: string` — the fixed warning: the asset types that cannot be authored from Python/text (Widget Blueprint, Animation Blueprint, `.umap`, Behaviour Tree graph, Material Function graph, skeletal mesh/skeleton) + "if your solution depends on one, declare it in Wiring Requirements and prefer a pure-C++ pattern where one exists." A `formatBinaryContentTripwire(kind)` returns it for UE kinds, `''` for `web`.

### 2 · `prompt-context.ts` — inject into the header

- Extend `ContextHeaderOptions` with `promptKind?: PromptKind` (default `'ue-cpp'` in the UE branch).
- In the UE branch of `buildProjectContextHeader()`, after the existing body, append `formatGotchas(promptKind)` and `formatBinaryContentTripwire(promptKind)` (each only when non-empty). The web branch (`buildWebAppContextHeader`) is unchanged (kind `'web'` → both empty).
- New behaviour is additive and default-on for UE prompts; existing callers that omit `promptKind` get `'ue-cpp'` (the common case).

### 3 · `prompt-builder.ts` — the Wiring Requirements section

- Add `export interface WiringRequirement { artifact: string; grantedBy?: string; activatedBy?: string; dependencies?: string[]; verification?: string }`.
- Add the section to `PromptSections` and a `withWiringRequirements(reqs: WiringRequirement[] = [])` method. When called (even with `[]`), it emits a `## Wiring Requirements` section that **instructs** the model: "For every artifact you generate, state how it is granted/registered, what activates it, which companion assets it needs (flag any binary-content dependency), and one observable check that proves the wiring." If `reqs` is non-empty, it renders the known hints as a table.
- Insert the section between Task Instructions and UE5 Best Practices in `build()`.
- The output-schema guidance gains a required `wiring` field per generated artifact (a sentence appended in `withOutputSchema`/the default schema).
- `audit()` includes `wiringRequirements`.

### 4 · `module-eval-prompts.ts` — Pass 0 Ground Truth

- Add `'ground-truth'` to `EvalPass`, prepend it to `EVAL_PASSES`, add to `PASS_LABELS` (`'Ground Truth'`).
- The ground-truth pass is **module-agnostic** (same instruction for all): "For each class you reference, name its parent class, its file path, the UPROPERTY/UFUNCTION you depend on, and one observable runtime behaviour you can verify. If you cannot, do not propose changes — request a read-only inventory of the missing class first." Wire it into wherever the per-pass prompt is assembled so Pass 0 runs before structure/quality/performance.

### 5 · `feature-definitions.ts` + matrix surface

- Add `export interface WiringAsset { name: string; kind: 'WidgetBlueprint' | 'AnimBlueprint' | 'BehaviorTree' | 'DataTable' | 'InputMappingContext' | 'GameMode' | 'Material' | 'Other'; note: string }` and `export const MODULE_WIRING_ASSETS: Partial<Record<SubModuleId, WiringAsset[]>>` seeded from the initiative (e.g. `arpg-ui` → the `UARPGHUDWidget`-family WBPs; `arpg-enemy-ai` → a Behaviour Tree; `arpg-character` → a player Blueprint / IMC; `arpg-combat` → the damage `DataTable` + montage). A `getWiringAssets(moduleId): WiringAsset[]` helper (returns `[]` when unset — but **every** module must have an explicit entry, possibly `[]`, enforced by a test).
- Surface in `FeatureMatrix` (`src/components/modules/shared/`): a small derived indicator per module — "needs binary content" — rendered when `MODULE_WIRING_ASSETS[mod]` contains any non-Python-authorable kind (WidgetBlueprint / AnimBlueprint / BehaviorTree). Minimal, additive; does not restructure the matrix.

## Testing (central to this concern)

Vitest under `src/__tests__/`:

- **`knowledge/ue-gotchas.test.ts`** — every `Gotcha` has non-empty fields + a valid `appliesTo`; `formatGotchas('ue-cpp')` includes the cpp gotchas and excludes web; `formatGotchas('web')` is `''`. A snapshot guards the rendered block (catches accidental deletion of a lesson).
- **`knowledge/binary-content.test.ts`** — the tripwire lists all six binary types; `formatBinaryContentTripwire('web')` is `''`.
- **`prompts/wiring-section.test.ts`** — a built UE gameplay prompt contains the `## Wiring Requirements` heading + the four sub-prompts (granting/activation/dependencies/verification) and the `wiring` output-schema field; `audit()` reports the section.
- **`prompts/context-injection.test.ts`** — `buildProjectContextHeader(ctx, { promptKind: 'ue-cpp' })` contains the gotchas block + tripwire; `promptKind: 'web'` (or a web project) contains neither.
- **`evaluator/ground-truth-pass.test.ts`** — `EVAL_PASSES[0] === 'ground-truth'`; the assembled prompt for any module includes the ground-truth instruction before the structure checks.
- **`feature-definitions-wiring.test.ts`** — for **every** `SubModuleId`, `MODULE_WIRING_ASSETS` has an explicit entry (fails with the missing module's name); each `WiringAsset` has non-empty `name`/`note` and a valid `kind`.

Run: `npm run validate` (typecheck + lint + test) must pass.

## Cross-cutting

- **Branch:** `master` (PoF app repo). Commit locally; user pushes manually.
- **Files touched (all PoF `src/` + tests):** `src/lib/knowledge/{types,ue-gotchas,binary-content}.ts` (new); `src/lib/prompt-context.ts`; `src/lib/prompts/prompt-builder.ts`; `src/lib/evaluator/module-eval-prompts.ts`; `src/lib/feature-definitions.ts`; `src/components/modules/shared/` (the matrix surface); `src/__tests__/**` (new tests).
- No UE-project files. No other forked-CLI's files.
- Conventions: `@/` imports, `logger` not console, `Result<T,E>` where fallible, `UI_TIMEOUTS` for timing — none of which this work introduces, but the matrix surface must follow the no-hardcoded-hex rule (`@/lib/chart-colors`).

## Definition of done

1. `src/lib/knowledge/` exists with the gotchas + tripwire + types, all seeded from the initiative.
2. The context header injects gotchas + tripwire for UE prompt kinds.
3. The `PromptBuilder` emits a Wiring Requirements section + `wiring` output field.
4. The evaluator runs Pass 0 — Ground Truth first.
5. `MODULE_WIRING_ASSETS` covers every module; the matrix shows the "needs binary content" indicator.
6. All new vitest tests pass; `npm run validate` is green.
7. Committed to `master`; chat summary.

**Success criterion:** PoF's generation prompts now *demand* wiring + flag binary-content dependencies + carry the initiative's known UE pitfalls, and the evaluator grounds itself before proposing changes — verifiably, via the new test suite — so a future module dispatch produces wired-out-of-the-box code without a multi-sub-project fix-loop on the wiring.

## Risks & mitigations

- **Prompt bloat** — appending gotchas + tripwire + a wiring section lengthens every UE prompt. Mitigation: gotchas are filtered by `promptKind` (only relevant ones); the tripwire is ~5 lines; keep each entry terse.
- **`promptKind` plumbing** — callers that build UE prompts must pass the right kind. Mitigation: default `'ue-cpp'` covers the common case; only Python/packaging builders pass otherwise; a test asserts the default.
- **Matrix surface scope creep** — keep it a single derived indicator; do not restructure `FeatureMatrix`. If the matrix component is large/tangled, add the indicator via a small focused helper rather than editing the core render.
- **Evaluator pass wiring** — adding a 4th pass value must not break callers that iterate `EVAL_PASSES` assuming 3. Mitigation: a test that exercises the pass loop; check `EVAL_PASSES` consumers.

## Next steps

1. Spec self-review (inline).
2. User reviews this spec.
3. `writing-plans` → implementation plan.
4. Execute (TDD: tests + implementation per item), `npm run validate`, commit.
