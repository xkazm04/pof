# Prompt System and CLI / Task System

Composable prompt construction for every Claude Code invocation, plus the unified
`CLITask` abstraction that ensures callers never hand-build prompts or embed HTTP
calls in strings.

---

## Key files

| File | Purpose |
|---|---|
| `src/lib/prompt-context.ts` | `buildProjectContextHeader()` — single source of truth for project metadata, engine paths, build commands, dynamic scan, and error memory |
| `src/lib/engine-facts.ts` | `getEngineFacts(ueVersion)` — version-keyed engine truths (MSVC toolchain, Substrate, MegaLights, PCG, State Tree, Iris, Nanite displacement). The ONE place a prompt's UE claims live |
| `src/lib/prompts/prompt-builder.ts` | `PromptBuilder` — fluent builder enforcing a fixed 6-section order |
| `src/lib/prompts/module-knowledge.ts` | `moduleKnowledge(moduleId)` — the ONE seam that routes `promptKind` + `module` + `knownAssetDomains` into a **standalone** builder's context header |
| `src/lib/prompts/animation-checklist.ts` | Per-module builder (animation); illustrates `.withProjectContext()` + `.withRawTask()` + `.withRawBestPractices()` |
| `src/lib/prompts/material-configurator.ts` | Per-module builder (materials); illustrates `.withBestPractices()` |
| `src/lib/cli-task.ts` | `CLITask` type hierarchy, `TaskFactory`, `buildTaskPrompt()`, callback registry (`registerCallback` / `extractCallbackPayload` / `resolveCallback`) |
| `src/lib/claude-terminal/cli-service.ts` | `startExecution()` — spawns Claude Code CLI, stream-json parsing, `CLIExecution` lifecycle, `buildCliArgs()` (model/effort pinning) |
| `src/lib/model-policy.ts` | Model-policy registry (WS0): `getModelPolicy(taskClass)`, `taskClassForDispatchType()`, `resolveDispatchModelChoice()` — the single source of truth for which model + effort powers each task class |
| `src/lib/prompt-evolution/dispatch-resolve.ts` | `composeTaskDispatch()` / `resolveActivePrompt()` — swaps the served prompt-evolution variant in before the prompt is built; `STATIC_VARIANT_ID` sentinel |
| `src/lib/prompt-evolution/engine.ts` | `resolveDispatchVariant()` (serve) / `recordTrialForServedVariant()` (record) / `concludeTest()` (decide) — the A/B loop |
| `src/lib/prompt-evolution/judge-fitness.ts` | `stampPromptVersion()` / `computeVersionFitness()` — joins judge verdicts to the quality-pack version that produced the artifact |
| `src/lib/prompts/quality/index.ts` | Quality pack + `PROMPT_VERSION` (hand-bumped) + `packFingerprint()` drift detector |
| `src/components/cli/skills.ts` | 12 `SkillPack` records; `buildSkillsPrompt()` / `resolveSkillsFromPatterns()` |
| `src/hooks/useModuleCLI.ts` | `useModuleCLI` hook — primary entry point from module components |
| `src/components/layout-lab/steps/ArchetypeStep.tsx` | Catalog pipeline: `CliProduce.buildPrompt` prepends Project Canon before dispatching |

---

## How it works

### 1. Composable prompt system

#### `buildProjectContextHeader()` (`prompt-context.ts:318`)

The function branches on `ctx.dynamicContext?.projectType`:

- **`ue5` (default)**: Emits `## Project Context` with project name, UE version,
  module name, API export macro, engine path, required MSVC version, source root.
  Appends up to four optional sections in order:
  1. `## Existing Project State` — class/plugin/Build.cs scan from `DynamicProjectContext`
     (grouped by UE prefix A/U/F/E) (`prompt-context.ts:95`)
  2. `## Past Build Errors` — per-category error warnings from `ErrorContextEntry[]`
     (`prompt-context.ts:216`)
  3. `## Build Command` — full `UnrealBuildTool.exe` invocation derived from engine path
     (`prompt-context.ts:85`)
  4. `## Rules` — standard UE rules + optional `extraRules` from the caller
  
  After the rules block, four knowledge injections fire unconditionally (when non-empty):
  - `formatGotchas(promptKind, module)` — UE pitfall list from `src/lib/knowledge/ue-gotchas.ts`, scoped to the module's domains
  - `formatBinaryContentTripwire(promptKind)` — binary-file guard
  - `formatKnownAssets(domains)` — domain-scoped asset inventory
  - `formatKnowledgeTips(module, promptKind)` — the module's authored `KnowledgeTip`s (best-practice + feasibility) from `src/lib/knowledge/knowledge-tips.ts`, injected when a `module` is in context

- **`nextjs` / `generic`**: Routes to `buildWebAppContextHeader()` which emits
  framework, database, and API route / MCP tool instructions instead.

The function also exports helpers consumed by `buildTaskPrompt`:
- `getModuleDomainContext(moduleId, ueVersion?)` — resolves a `DOMAIN_CONTEXT` map
  keyed by `SubModuleId` (content, game-systems, and core-engine aRPG sub-modules).
  The map is **built from the engine facts for `ueVersion`** (memoized per engine
  version); the task handlers pass `ctx.ueVersion`, other callers get
  `DEFAULT_UE_VERSION`.
- `getRequiredMSVCVersion(ueVersion)` — a thin projection over `getEngineFacts().msvc`.

#### Engine facts (`engine-facts.ts`)

Every claim a prompt makes about Unreal Engine lives in ONE version-keyed record,
selected by the project's actual `ProjectContext.ueVersion`. Before this, 5.7-era
framing was hard-coded in three files while the live project ran UE 5.8, so daily
prompts taught the model stale truths (most loudly "MegaLights (beta)", which 5.8
promoted to production-ready).

| Fact | Consumed by |
|---|---|
| `msvc` | `getRequiredMSVCVersion` → the header's `Required MSVC toolchain` line |
| `substrate`, `substrateSlabHint` | `DOMAIN_CONTEXT.materials`, `material-configurator.ts` (per-surface shading model + best practices) |
| `megaLights`, `pcg` | `DOMAIN_CONTEXT['level-design']` |
| `stateTree` | `DOMAIN_CONTEXT['ai-behavior']` |
| `iris` | `DOMAIN_CONTEXT.multiplayer` |
| `naniteDisplacement` | `material-configurator.ts` tessellation feature text |

Rules for changing it:

- **It is not a capability database.** Add a field only when a prompt already
  asserts that fact. Everything else stays out.
- **Conservative when unknown.** Where this repo records nothing about a feature's
  status on a newer engine, the older claim is carried forward and the text SAYS
  it is unverified (see `iris`) — never an invented promotion.
- **Sourcing.** Feature maturity comes from
  `docs/ue5-capability-integration-candidates.md`; the MSVC ranges come from the
  installed engine's `Engine/Config/Windows/Windows_SDK.json`
  (`MinimumVisualCppVersion` / `BannedVisualCppVersions` /
  `PreferredVisualCppVersions`). 5.8 has an **explicit** branch: minimum is
  14.38.33130, but 14.39–14.43 are banned outright, so `14.44` is the lowest
  family that is both allowed and preferred.
- Substrate and the Mixamo download contract each exist as exactly ONE literal
  (`engine-facts.ts` / `prompts/_shared.ts` `MIXAMO_DOWNLOAD_CONTRACT`);
  `src/__tests__/lib/prompts/mixamo-contract-single-source.test.ts` fails if any
  other file re-states them.

#### `PromptBuilder` (`prompt-builder.ts:46`)

Fluent builder that assembles up to 7 sections in a fixed order:

| # | Section | Method | Required |
|---|---|---|---|
| 1 | Project Context | `.withProjectContext(ctx, opts)` or `.withRawProjectContext()` | Yes |
| 2 | Domain Context | `.withDomainContext(text)` | No |
| 3 | Task Instructions | `.withTask(title, body)` or `.withRawTask()` | Yes |
| 3.5 | Asset Specification | `.withAssetSpec(entity)` | No |
| 3.6 | Wiring Requirements | `.withWiringRequirements(reqs)` | No |
| 4 | UE5 Best Practices | `.withBestPractices(list)` or `.withRawBestPractices()` | No |
| 5 | Output Schema | `.withOutputSchema(text)` or `.withRawOutputSchema()` | No |
| 6 | Success Criteria | `.withSuccessCriteria(list)` | No |

`build()` throws if `projectContext` or `taskInstructions` are absent. Sections are
joined with `\n\n` — no caller manages separator whitespace. (`prompt-builder.ts:192`)

`audit()` returns a `{section, present}[]` row per builder section so the UI can
surface which sections were actually populated. For prompts that don't go through
`PromptBuilder` (hand-rolled strings like `buildAbilityForgePrompt`), the same
shape is recoverable via `auditPromptString(prompt)` — it detects canonical
section markers by header keywords and returns `{section, label, present, required}[]`
plus a one-line `summarizeAudit()` summary. The **Prompt Inspector**
(`components/modules/shared/PromptInspector.tsx` — the forge path re-exports it)
uses both to render audit chips (green = present, amber = missing required,
neutral zinc = missing optional) over the composed prompt's CodeBlock. On the
daily checklist run path, `shared/TaskPromptInspector.tsx` mounts it as a
collapsed "Preview prompt" disclosure on every unchecked `RoadmapChecklist`
card: on open it composes the prompt through the exact dispatch pipeline
`useModuleCLI.execute` uses (same project scan/ctx, same `composeTaskDispatch`
variant resolution), and tags a summary of the injected knowledge
(`lib/prompts/prompt-knowledge-summary.ts`: pitfalls count, known assets,
wiring, binary tripwire, quality pack, variant vs static) derived purely from
the composed string.

The Asset Specification section (3.5) serialises a catalog entity's identity and
typed `data` payload as a JSON block. The Wiring Requirements section (3.6) always
emits granting / activation / dependency / verification sub-prompts and a `wiring`
output-field instruction; known hints render as a table when `reqs` is non-empty.

#### Per-module builders (`src/lib/prompts/`)

Each builder is a single function that wires a domain-specific config into `PromptBuilder`:

**Knowledge routing (`module-knowledge.ts`).** The standalone builders are the
module-UI codegen surface — the highest-volume prompt path in the app — and they
call `buildProjectContextHeader` directly rather than going through
`buildTaskPrompt`. Every one of them spreads `moduleKnowledge(moduleId)` into its
header options:

```ts
buildProjectContextHeader(ctx, { ...moduleKnowledge('materials'), extraRules: [...] })
```

`moduleKnowledge` derives the same three routing fields the `CLITask` handlers
pass — `promptKind` (`'ue-cpp'`; every standalone builder emits C++), `module`
(scopes `formatGotchas` to the module's domains **and** recovers its authored
`KnowledgeTip`s), and `knownAssetDomains` (`knownAssetDomainsForModule`, which
also maps the content modules `animations` / `ui-hud` / `level-design`). Because
the routing is kind- and module-scoped, joining it typically makes a builder's
prompt *shorter*: a materials prompt no longer hauls the GAS / Niagara /
motion-matching pitfalls it can never hit. Builder→module mapping: `level-design`
→ `level-design`; `inventory`, `menu-flow` → `ui-hud`; `material-configurator`,
`material-patterns`, `post-process`, `style-transfer` → `materials`;
`animation-checklist` → `animations`; `audio-scene`, `audio-events` → `audio`;
`ai-testing` → `ai-behavior`. The rail
`src/__tests__/lib/prompts/standalone-builder-knowledge.test.ts` iterates one
shared fixture table (`builder-fixtures.ts`) and fails if a builder file is added
without joining the routing.

**Off-rail surfaces (`__tests__/lib/prompts/off-rail-join.test.ts`).** Outside
`src/lib/prompts/` the same audit found two classes of gap, and that rail now pins
both (with a golden per surface):

- *Unrouted header callers* — they called `buildProjectContextHeader` with only
  `extraRules`, so they took the conservative pitfall superset and no tips /
  known assets. Now routed through `moduleKnowledge`:
  `evaluator/fix-plan-generator.ts` (single + batch, scoped to the FINDING's own
  module), `evaluator/deep-eval-engine.ts` (the pass prompt, extracted as the pure
  `buildDeepEvalPassPrompt` so it is testable and pinnable), and
  `harness/executor.ts`'s `buildAreaPrompt` (scoped to `area.moduleId` —
  prompt-assembly only; the harness loop is untouched).
- *Fully off-rail builders* — most are joined at their DISPATCH site: `ai-feel`'s
  apply prompt and the inventory balance prompt go out as `ask-claude` tasks, so
  `buildTaskPrompt` composes the routed header for them (pinned, so a refactor that
  sends the raw string is caught). The genuinely raw one was **feature-init**:
  `FeatureInitButton` sent `initPrompt.prompt` through `sendPrompt` with no
  composition at all, and now dispatches `TaskFactory.quickAction` (prompt text
  unchanged, full header + domain + knowledge gained).

Deliberate **exemptions** are recorded in that same rail: `project-setup/prompts.ts`
(the create prompt builds the very project a header would describe; the
build-verify prompt is a terse diagnostic carrying its own engine/project paths and
rules) and `ability/logic-prompts.ts` (the spec-draft prompt is app-side-only and a
UE build header would contradict its own "do not modify any UE C++" constraint; the
logic-change builder has no dispatch site yet — composition belongs to the task that
eventually dispatches it).


- `buildAnimationChecklistPrompt(step, ctx)` — injects animation-specific `extraRules`,
  builds the task from `ChecklistStep.{number, title, description, details, prompt}`,
  then appends a raw best-practices block covering `NativeUpdateAnimation`, montage
  delegates, the single-sourced Mixamo download contract, and commandlet automation
  gotchas (stamped with the project's engine version from `engine-facts.ts`).
  (`animation-checklist.ts:5`)

- `buildMaterialConfiguratorPrompt(config, ctx)` — maps surface type to shading model
  and render-feature instructions, generates a three-file task description (master
  material or MID variant), then calls `.withBestPractices()` with UMD / TSoftObjectPtr /
  Substrate 5.7+ tips. (`material-configurator.ts:36`)

---

### 2. Unified CLI task abstraction

#### `CLITask` and `TaskFactory` (`cli-task.ts`)

Every CLI invocation is typed as a `CLITask` (`cli-task.ts:175`). The base interface
carries `type`, `prompt` (raw, before context injection), `moduleId`, and `label`.
Extended subtypes carry type-specific fields:

| Factory method | Task type | Extended fields |
|---|---|---|
| `TaskFactory.checklist()` | `checklist` | `itemId`, `appOrigin` |
| `TaskFactory.quickAction()` | `quick-action` | — |
| `TaskFactory.askClaude()` | `ask-claude` | — |
| `TaskFactory.featureFix()` | `feature-fix` | `featureName`, `status`, `nextSteps`, `filePaths`, `qualityScore`, `appOrigin` |
| `TaskFactory.featureReview()` | `feature-review` | `moduleLabel`, `features[]`, `appOrigin` |
| `TaskFactory.moduleScan()` | `module-scan` | `passes[]`, `previousFindings`, `appOrigin` |
| `TaskFactory.wbpStarter()` | `wbp-starter` | `targetClass`, `appOrigin` |
| `TaskFactory.procgenDungeon()` | `procgen-dungeon` | `roomCount`, `seed`, `appOrigin` |
| `TaskFactory.scatterBiome()` | `biome-scatter` | `density`, `seed`, `appOrigin` |
| `TaskFactory.mixamoImport()` | `mixamo-import` | `importDir`, `targetSkeleton`, `appOrigin` |
| `TaskFactory.characterSetup()` | `character-setup` | `source`, `playerMesh`, `enemyMesh`, `animBlueprint`, `enemyMaterial`, `appOrigin` |
| `TaskFactory.importAudioSet()` | `audio-import` | `setName`, `eventKey`, `surface`, `assets[]`, `appOrigin` |
| `TaskFactory.generate()` | `generate` | `entity`, `step`, `appOrigin` |
| `TaskFactory.evaluateTrack()` | `evaluate-track` | `entity`, `trackId`, `appOrigin` |
| `TaskFactory.draftAbilitySpec()` | `draft-ability-spec` | `catalogId`, `entityId`, `ref`, `instruction`, `appOrigin` |
| `TaskFactory.generateGasEffects()` | `generate-gas-effects` | `ref`, `effects[]`, `tagRules[]`, `scalars`, `catalogId`, `entityId`, `appOrigin` |

The `generate-gas-effects` task closes its loop with a callback to
`POST /api/ability-spec/codegen` (staticFields `catalogId`/`entityId`): the agent
reports `filesWritten` / `buildOk` / `seedRan` / `dataTableRows` / `missingTags`,
the route validates the raw JSON through `parseCodegenReport`
(`@/lib/ability/codegen-report`) and DERIVES the terminal status — a run that
skipped the seeder or saved 0 rows is `failed` with a reason, whatever it claims.
The report persists as the spec's `codegen` provenance (`ability_specs.codegen`)
and drives the `dispatched → confirmed/failed` line in the Forge adopt bar and
the GAS Blueprint editor's spec bar.

An `ability_specs` row carries **all five** GAS Blueprint editor slices —
`effects` / `tag_rules` (required) plus the additive, nullable `attributes` /
`relationships` / `loadout` columns that feed `AttributeSet.h` and
`GameplayTags.h` codegen — so an entity switch or reload restores the whole
editor, not two of its five panels. Legacy rows read those three back as
`undefined` and the editor keeps its own seed. `upsertSpec` writes every slice
plus `provenance` but deliberately **never** the `codegen` column: that audit
trail is owned solely by the codegen callback, so a Save/Adopt cannot clobber it.

**One tag dialect.** UE5 spells every gameplay tag twice — a C++ identifier
(`Ability_Fire_Fireball`) and a tag string (`Ability.Fire.Fireball`). The app
speaks **dotted** everywhere: specs, spellbook data and the tag audit. The forge
emits C++ identifiers (its `OUTPUT_SCHEMA` asks for them, because they go into
generated C++), so `forgedAbilityToSpec` normalizes every tag crossing the adopt
boundary through `@/lib/ability/tag-dialect` (`toDottedTag` / `toCppTagName` /
`toDottedTags`) — the single mapper, re-exported from `ue5-source-parser.ts` for
server code. Without it an adopted row could never match a declared tag.
The tag audit (`@/lib/ability/tag-audit`) accordingly takes **three** sources:
declared C++ tags, tags referenced by parsed UE5 ability rules, and — via
`GET /api/ability-spec/tags` → `specTagReferences(listSpecs())` — the tags
app-authored specs reference, reported separately as `appReferenced`. When live
source is parsed the spellbook's audit categories are derived from that real
breakdown (`buildLiveTagAuditCategories`), never the static
`TAG_AUDIT_CATEGORIES` sample array.

Tasks whose `prompt` is empty (e.g. `featureReview`, `moduleScan`) rely entirely on
`buildTaskPrompt` to assemble all content from the extended fields.

#### `buildTaskPrompt(task, ctx)` (`cli-task.ts:384`)

The single code path for all prompt assembly — a switch on `task.type`:

1. Calls `buildProjectContextHeader(ctx, …)` (with `knownAssetDomains` derived
   from the module).
2. Appends `## Domain Context` from `getModuleDomainContext(task.moduleId)` when
   non-null.
3. For task types in `WIRING_TASK_TYPES` (`checklist`, `quick-action`, `feature-fix`)
   and UE5 projects, appends `formatWiringRequirements()` with module-specific wiring
   assets from `getWiringAssets()`.
4. For callback-bearing types, calls `registerCallback()` to get a `cb-<ts>-<n>` ID,
   then calls `buildCallbackSection(cb)` to produce the `## Submission` block.
5. Returns the assembled string. No caller builds prompts manually.

**Loud fallbacks.** Two degraded paths used to be indistinguishable from a normal
dispatch:

- A task type with **no registered handler** fell back silently to the raw
  `task.prompt` (no context, no knowledge, no callback). It now `logger.warn`s and
  stamps the prompt with `UNKNOWN_TASK_TYPE_MARKER` (`@@UNKNOWN_TASK_TYPE:<type>`)
  plus `UNKNOWN_TASK_TYPE_NOTE`, so the degradation is visible in the transcript.
- A `generate` task for a **catalog with no registered recipe** returns the bare
  `entity.name` — a one-word "prompt". The return value is unchanged (callers are
  unaffected) but it now warns and names the missing catalog.

Both are covered by the golden rail's `loud fallbacks` suite.

---

### 2b. The golden rail (`src/__tests__/lib/prompts/`)

Byte-level regression armour for every composed prompt, because concurrent fleet
sessions edit prompt text constantly and drift is otherwise invisible.

| File | Role |
|---|---|
| `golden.ts` | `expectGolden(name, actual)` — file-backed pin; on mismatch names the drifted markdown **section** before showing the line diff (via `lib/text-diff.ts`) |
| `__golden__/*.md` | The recorded prompts — reviewable in a normal diff, not an opaque `.snap` |
| `task-prompt-golden.test.ts` | One pin per `CLITaskType` (**all 18**, with a coverage guard against `taskPromptHandlers`) + one per standalone builder, + the loud-fallback suite |
| `builder-fixtures.ts` | The shared standalone-builder fixture table (also drives the knowledge rail) |

Re-record an intentional change with:

```
POF_UPDATE_GOLDEN=1 npx vitest run src/__tests__/lib/prompts
```

Every golden must be re-recorded **deliberately** and the diff explained in the
commit — an unexplained golden update is a silent prompt regression.

---

### 3. `@@CALLBACK` flow (numbered sequence)

The callback system replaces embedded `curl` calls. One shared parser owns the
marker format — `parseCallbackMarker(text)` in `cli-task.ts` (regex + `JSON.parse`).
Both the client terminal (`extractCallbackPayload` → `{ callbackId, payload }`) and
the server-side `awaitCallback` (`cli-service.ts`, which wants the parsed object)
go through it, so the wire format can never drift between the two paths. The regex:

```
/@@CALLBACK:(\S+)\s*\n([\s\S]*?)\s*@@END_CALLBACK/
```

The id is any non-whitespace run — `cb-…` from `registerCallback` **or** `step-…`
from the one-shot routes — so the prefix is intentionally unconstrained.

**Full sequence:**

1. **Caller** calls `TaskFactory.<method>()` to create a `CLITask` with `appOrigin`
   set to the running app's base URL. (`cli-task.ts:900+`)

2. **`buildTaskPrompt`** calls `registerCallback({ url, method, staticFields, schemaHint })`
   which generates `id = "cb-<Date.now()>-<counter>"`, stores the entry in the
   module-level `_callbackRegistry` Map, and returns the ID. (`cli-task.ts:57`)

3. **`buildCallbackSection(cb)`** emits a `## Submission` markdown block instructing
   Claude to output a JSON object **wrapped** in `@@CALLBACK:<id>` / `@@END_CALLBACK`
   markers on their own lines. The `staticFields` are listed as fields Claude must
   NOT include (they will be merged server-side). (`cli-task.ts:78`)

4. **`useModuleCLI.execute(task)`** assembles the prompt, passes it to `sendPrompt`,
   which calls `dispatchPromptWhenReady(tabId, enrichedPrompt)`. (`useModuleCLI.ts:137`)

5. **`startExecution()`** in `cli-service.ts` spawns `claude.cmd -p - --output-format
   stream-json --verbose --dangerously-skip-permissions`, writes the prompt to stdin,
   and emits `CLIExecutionEvent` objects for every parsed stream-json line.
   (`cli-service.ts:139`)

   The `POST /api/claude-terminal/query` route resolves the **model policy** for the run
   before spawning: `resolveDispatchModelChoice({ taskType, taskClass?, model?, effort? })`
   maps the dispatch task type (threaded from `useModuleCLI` → `dispatchPromptWhenReady`
   → the `pof-cli-prompt` event → `useTaskQueue.submitPrompt`) to a policy class via
   `taskClassForDispatchType`, reads `getModelPolicy(class)`, and passes the resulting
   `{model, effort}` to `startExecution` so `buildCliArgs` appends `--model`/`--effort`.
   Only content-aligned task types map (`feature-fix → fix-content`, `module-scan` /
   `feature-review` / `evaluate-track → judge-content`, `generate` / `draft-ability-spec`
   / `detect-stimuli → produce-text`, `generate-gas-effects` / `run-ai-tests →
   author-ue-test`); every other type (`checklist`, `quick-action`, `ask-claude`,
   free-typed `interactive`, …) is unmapped → no args appended → identical to the
   pre-wiring default. The route echoes the resolved pin back so `TerminalHeader` can
   show a small honest `policy: <model>·<effort>` label. Scripts / autonomous spawns can
   pass an explicit `model`/`effort` (validated; unknown values dropped) which wins.

   The final `result` line is normalized through the pure `result-metrics.ts`
   (`extractResultMetrics`) so the run's token usage + dollar cost surface as clean
   camelCase regardless of CLI result shape. **Spend is recorded SERVER-SIDE** in
   `cli-service` (`recordExecutionSpend`, fired from the `emitEvent` choke point on the
   run's terminal `result`/`error` event, guarded to record exactly once per execution),
   so the `cli_spend` ledger counts EVERY spawn — interactive, queued, autonomous
   (one-shot propose/refine/step, batch-review), and failed/aborted/synthetic runs — not
   just clean client results. Each row carries a `status` (`completed`|`failed`|`aborted`)
   and best-known attribution: the query route threads `{ moduleId, taskType, taskLabel,
   sessionKey }` from the dispatching session (`CompactTerminal.resolveAttribution`), and
   the autonomous routes pass their own `taskType`. The old client-side `recordCliSpend`
   path is removed (no double-counting). Pre-flight estimates read only `status='completed'
   AND cost_usd>0` rows so failed/aborted zero-cost rows never drag the average down. Feeds
   the Evaluator → **Spend** dashboard + budget guard. See *state-and-persistence →
   `cli_spend`*.

6. **Terminal component** subscribes to `CLIExecutionEvent`s. When the run's `result`
   event arrives, it scans the accumulated output for **every** marker via
   `extractAllCallbackPayloads(text)` → `{ callbackId, payload }[]` (a run may emit more
   than one; the single-match `extractCallbackPayload` / `parseCallbackMarker` are still
   used server-side by `awaitCallback`, which wants only the first). All markers share the
   one regex source, so the global and single variants can never drift.

7. **`resolveCallback(callbackId, rawPayload)`** (`cli-task.ts:118`):
   - Looks up the callback in `_callbackRegistry` by ID.
   - `JSON.parse(rawPayload)` — returns error on malformed JSON.
   - Merges `cb.staticFields` over the parsed object (static fields take precedence,
     preventing prompt injection from overriding `moduleId` etc.).
   - `fetch(cb.url, { method, body: JSON.stringify(merged) })` — POSTs to the app API.
   - On `json.success === true`: removes the callback from the registry and returns
     `{ success: true, data }`.
   - On failure: returns `{ success: false, error }` without deregistering (allows retry).

8. The terminal displays a confirmation message. The store or API handler on the
   receiving end updates its state (checklist progress, feature-matrix entry, scan
   findings, pipeline artifact, etc.).

**Callback truth (additive completion status).** The run's completion signal carries a
`callbackStatus` — `confirmed` (every marker's POST succeeded), `failed` (a marker was
emitted but its POST was rejected), or `missing` (no marker at all). It is resolved inside
the existing `callbackSettleMax` race, so it **never blocks or delays** the `isRunning`
release — it is purely additive truth. It flows `useTaskQueue.onTaskComplete(id, success,
{ callbackStatus })` → `cliPanelStore.setSessionRunning(…, callbackStatus)` (stored as
`lastCallbackStatus`) → `useModuleCLI.onComplete(success, callbackStatus)`. `useChecklistCLI`
flips a checklist item to done **only on `confirmed`**; a completed-but-unconfirmed run
(missing/failed callback → the `/api/checklist/complete` POST never landed) leaves the item
un-done and surfaces `unconfirmedItemId` + `retryUnconfirmed()` — closing the old silent
UI/DB divergence where the item was marked done regardless of the callback.

**Single completion latch.** All terminal paths — the `result`/`error` SSE handlers, the
stream `onerror`, abort, and the stuck-task poller — share one `completedRef` latch, so a
run completes exactly once. The `result` path latches synchronously on arrival (before its
bounded callback-settle race), and the poller re-checks the latch after its async
`getTaskStatus`, closing the narrow window in which it could otherwise double-fire
`onTaskComplete`.

---

### 4. `useModuleCLI` hook (`useModuleCLI.ts:38`)

Standard entry point from module components:

```
const { execute, sendPrompt, isRunning } = useModuleCLI({
  moduleId, sessionKey, label, accentColor, onComplete,
});
```

`execute(task)`:
1. Calls `projectStore.scanProject()` to refresh `dynamicContext` (cached if fresh).
2. Calls `resolveAndApplySkills(sessionKey)` — POSTs to `/api/telemetry` with
   `{ action: 'resolve-skills' }`, receives `SkillId[]`, and stores them on the
   session via `setSessionSkills`. Non-blocking; silently skips on failure.
3. Reads `{ projectName, projectPath, ueVersion, dynamicContext }` from the project
   store and calls `buildTaskPrompt(task, ctx)`.
4. Calls `sendPrompt(enriched)`.

`sendPrompt(prompt)`:
1. Looks up or creates a CLI panel session via `findSessionByKey` / `createSession`.
2. Calls `setActiveTab(tabId)` to bring the panel into view.
3. Calls `dispatchPromptWhenReady(tabId, prompt)` — waits for the terminal's
   readiness handshake rather than a fixed delay.

Running-state transitions are detected via `prevRunningRef` + `isRunning` diff.
On `running → stopped`, a `setTimeout` with `UI_TIMEOUTS.raceConditionBuffer` reads
`lastTaskSuccess` from the settled store, records analytics via `recordSessionOutcome`,
and fires `onComplete(success)`. (`useModuleCLI.ts:70`)

---

### 4.5 Prompt-evolution A/B loop (serve → record → conclude)

A checklist dispatch does not blindly send the registry prompt. `composeTaskDispatch`
(`prompt-evolution/dispatch-resolve.ts`) resolves the variant first, and the resolved id
is stamped onto the task as `promptVariantId` — which `cli-task-handlers`'s checklist
handler puts into the callback's `staticFields`. The loop has three legs:

1. **Serve** — `resolveActivePrompt` POSTs `{ action: 'resolve-dispatch-variant' }`.
   Server-side `resolveDispatchVariant(moduleId, checklistItemId)`:
   - **A running A/B test on the item** → picks an arm with the epsilon-greedy
     `pickVariant` (`ab-testing.ts`: A and B each get 2 forced explore trials, then
     ε=0.2 exploration / exploit-by-success-rate with a faster-average tie-break).
     Returns `{ variant, testId, slot }` — the SERVED variant's id is what gets stamped.
   - **No running test** → the adopted/active variant (unchanged pre-existing path), or
     `null` so dispatch falls back to the task's static prompt and stamps `'static'`.
2. **Record** — the run's `@@CALLBACK` POST lands on `/api/checklist/complete`, which
   carries `promptVariantId` through the static fields. Any id other than `'static'` is
   handed to `recordTrialForServedVariant`, which finds the running test the variant is an
   arm of and books a success/fail trial against that slot (`recordTrialAndEvaluate` — an
   atomic SQL increment + `evaluateTest` inside one transaction). Booking is best-effort:
   a failure is logged and never blocks marking the item complete. The response reports
   `trialRecorded` so the loop is observable.
3. **Conclude** — `evaluateTest` may auto-conclude once the z-test/volume gate opens.
   The manual "decide now" path (`concludeTest` → `forceConclude`) returns
   `Result<ABTest, string>` and **refuses below `MIN_TRIALS_PER_VARIANT` (3) trials per
   arm**, naming the shortfall; the API surfaces that as a 409 so the UI can say why
   nothing was decided. Previously it crowned slot A at zero trials (`rateA >= rateB`
   with both rates 0) — a coin flip dressed as evidence.

Adopting a winner / restoring a version flips the `active` flag, which changes what leg 1
serves once no test is running.

**Leg 0 — fuel (baseline auto-seeding).** On a fresh DB there are no variants at all, so
leg 1 returned `null` forever and the rail never fired. The REAL dispatch path
(`useModuleCLI.execute` → `composeTaskDispatch(task, ctx, { seed: true })`) therefore
captures the prompt it just served as the item's **v1**: `resolveActivePrompt` fires
`{ action: 'seed-baseline-variant' }` **fire-and-forget** (never awaited — dispatch latency
must not pay for the write, and a failed seed never blocks a run). Server-side
`seedBaselineVariant` is **idempotent**: an item that already has ANY version is a no-op
read (`{ variant, seeded: false }`), so repeated dispatches cannot fork a second baseline
or disturb an adopted version. The seeded variant's text is byte-identical to the static
prompt (`origin: 'seeded'`), so the static golden rail is unchanged — only the stamped
`promptVariantId` moves from `'static'` to the baseline id on later runs. Previews
(`TaskPromptInspector`) pass no options and therefore never seed.

**Which task types are under test.** Variant serving covers `checklist` **and the
recipe-driven types** (`generate`, `evaluate-track`) — the latter matter because the
generate path is the only one whose OUTPUT the judge fleet scores, so its A/B can be
settled by an independent verdict instead of a self-reported success flag. Two mechanics
make that work:
- **Key** (`variantKeyForTask`): `\<catalogId\>::\<step\>::\<entityId\>` (tracks:
  `\<catalogId\>::track:\<trackId\>::\<entityId\>`). The entity id is part of the key on
  purpose — a recipe prompt embeds that entity's own spec, so a variant seeded for one
  entity must never be served to another.
- **Body** (`taskVariantBody` in `cli-task-handlers.ts`): these tasks carry `prompt: ''`
  and compose their text inside the handler, so there was nothing for a variant to
  replace. `composeTaskDispatch` now materializes the recipe body first (seeding captures
  THAT, not an empty string) and the handlers prefer a non-empty `task.prompt`. With no
  variant resolved the body equals what the handler would have recomputed, so the static
  prompt is byte-identical (asserted, and the `task-generate` golden is unmoved).

**Leg 2 on the recipe path.** The generate callback posts to `/api/catalog` with a
lifecycle payload that carries no prompt key, so the served id travels alone in the static
fields (added ONLY for a real variant — `'static'` adds no field) and the route books the
trial via `recordTrialForVariantId`, which finds the running test the id is an arm of.
A `verify` step counts as a success only when its `testResult` passed.

**Judge verdicts per variant.** `/api/pipeline-artifacts` POST accepts an additive
`promptVariantId` (read off the raw body — it is a provenance stamp, not graded input) and
`stampPromptVersion` writes it to `data._provenance.promptVariantId` beside
`promptVersion`, preserving one a producer already wrote. `computeVariantFitness`
(`get-variant-fitness`) then aggregates judge scores on that key with the same honesty
rule as version fitness: unjudged is `null`, never `0`, and static-prompt artifacts are
excluded because they belong to no experiment.

**Challenger in one click.** The Optimizer tab's rewrite used to be display-only.
`OptimizerPanel` now offers "save as challenger variant": pick the checklist item, and
`usePromptEvolution.handleSaveChallenger` seeds the baseline from the registry prompt
(idempotent), saves the optimized text via `createVariant`, and starts the A/B test between
them — so leg 1 begins serving both arms on the next dispatches.

---

### 4.6 Judge verdicts → prompt fitness (the WS1 improvement loop)

The quality pack (`lib/prompts/quality/index.ts`) is prepended to every generative Produce
prompt, and the judge fleet scores what it produces — but the two were never read back
together, so a pack revision could not be shown to have helped. `lib/prompt-evolution/judge-fitness.ts`
is that join:

```
judge_verdicts (catalogId, entityId, step)
  ⋈ pipeline_artifacts (same primary key)
    → data._provenance.promptVersion     ← the fitness axis
```

- **Making the axis real.** `/api/pipeline-artifacts` POST — the produce `@@CALLBACK` target —
  now stamps `data._provenance.promptVersion` via `stampPromptVersion(data, promptVersion?)`.
  An explicit `promptVersion` in the payload (a replay/drain reporting the pack its artifact
  really ran under) wins; otherwise the pack version in effect at write time is recorded. An
  existing `_provenance` stamp is merged, never clobbered. **Grading is unaffected**: the
  server grades the *submitted* `data` and the stamp is added only to what is persisted, so
  acceptance can never move because of it (the additive-key pattern).
- **`PROMPT_VERSION` is a real, hand-bumped pack version.** Change any pack content and you
  must bump it to the next `q<n>`; `src/__tests__/lib/prompts/quality-pack-version.test.ts`
  pins the pair `{PROMPT_VERSION, packFingerprint()}` and fails loudly if content moved
  without a bump. (`packFingerprint()` is a pure FNV-1a over the whole pack — a *drift
  detector*, not the version. A hash-as-version was rejected: it would mint a new bucket on
  every typo fix and shatter the score history into single-artifact fragments, and `q1`/`q2`
  is what a human reads in the UI.)
- **Aggregation.** `computeVersionFitness(artifacts, verdicts)` (pure) returns
  `PromptVersionFitness[]`: produced/judged artifact counts, verdict count, mean score, pass
  rate, and `isCurrent`. Artifacts with no stamp are **excluded** rather than guessed into a
  bucket. `getPromptVersionFitness()` is the DB-backed entry point behind the
  `get-prompt-fitness` action.
- **Honest unknown.** A version whose artifacts nobody has judged reports `avgScore: null`,
  and `JudgeFitnessStrip` renders an explicit "unjudged — N artifacts produced, none reviewed
  yet" with **no meter at all**. A genuine score of 0 still draws a bar — 0 is a measurement,
  `null` is not. Adoption stays manual: the strip informs, it never picks a winner.

Until artifacts are produced under a second pack version this shows a single bucket. That is
the expected steady state — the loop exists so the comparison is available the moment
`PROMPT_VERSION` bumps.

---

### 5. Skills packs (`skills.ts`)

12 domain-specific `SkillPack` records each have a `context` string (a compact
`## Skill: …` markdown block with concrete implementation patterns). Skills activate
in two ways:

- **Accepted sub-genres** (always active): `souls-like → souls-combat`,
  `diablo-like → loot-itemization`, etc. (`skills.ts:179`)
- **High-confidence pattern detections** (≥ 60% by default): `multiplayer-sync →
  networking-replication`, `procedural-generation → pcg-procedural`, etc. (`skills.ts:191`)

`buildSkillsPrompt(skillIds)` concatenates the `context` strings of all active packs
with `\n\n` and appends a trailing `\n\n` for inclusion as a prompt prefix.
(`skills.ts:203`)

`resolveAndApplySkills` in `useModuleCLI` hits `/api/telemetry` at execution time and
stores the resolved `SkillId[]` on the session (`cliPanelStore.setSessionSkills`);
`InlineTerminal` feeds them to `CompactTerminal` as `enabledSkills`.

`injectSkillsIntoPrompt({ basePrompt, enabledSkills, resumeSession, runLabel })`
(`skills.ts`) is the **single injection path** shared by both CLI dispatch entry points
in `useTaskQueue` — the queued `executeTask` **and** the interactive `submitPrompt`
(the normal module-button flow). It prepends the enabled packs on first run only
(`resumeSession === false`), never on a `--resume` continuation, and logs which packs
were injected. Before this, only the queued path prepended skills, so module-button
prompts silently dropped every resolved pack. Injection now cannot drift between the
two paths, and a resume can never double-inject.

---

### 6. Catalog pipeline — `ArchetypeStep` and Project Canon (`ArchetypeStep.tsx:72`)

For catalog pipeline steps that use the generic archetype renderer, `CliProduce.buildPrompt`
is:

```ts
(dir) => {
  const canon = canonContextFor(canonRules, catalogId, canonCategoriesForStep(spec));
  const pack = qualityPack(cls, catalogId);
  const contract = stepContractBlock(spec, entity);   // the step's OWN wiring contract + criteria
  return [pack, canon, contract, `Produce ${spec.label} for ${entity.name}. ${dir}`]
    .filter(Boolean).join('\n\n');
}
```

`canonContextFor` injects Project Canon rules as a structured prefix before the user's
free-text direction — the catalog pipeline's equivalent of the module system's
`buildProjectContextHeader`. **Category scope** comes from `canonCategoriesForStep`
(`@/lib/catalog/contractPrompt`): a step whose checker is a **content invariant**
(`isContentInvariant` — a wrong NUMBER fails it) gets the FULL in-scope canon so the
threshold it will be graded by is visible; a shape-only step keeps its narrower
`ARCHETYPE_CANON` slice (`brief → ['game']`, `schema → ['project','game']`).

**Wiring contracts reach prompts** (`src/lib/catalog/contractPrompt.ts`). Pipelines author
137 `wiringContract` blocks + per-step `criteria` inside their produce bodies; for a long
time the ONLY consumer was the acceptance checker, so a CLI was asked to author an artifact
without being told the contract it would be graded against. `stepContractBlock(spec, entity)`
is the pure extraction that closes the gap — it runs the step's own produce stub, pulls out
every `wiringContract` / `criteria` (depth-bounded walk), and renders a capped
`# ACCEPTANCE CONTRACT FOR THIS STEP` block. Three seams share it so the prompt is identical
wherever a step is driven:

| Seam | File | What it injects |
|------|------|-----------------|
| generic lab step (~330) | `ArchetypeStep.buildPrompt` | that step's own contract + criteria |
| headless / pof-mcp step | `catalog/headless.ts` `buildStepRecipe` | same block, same canon scope |
| four-phase generation recipe | `catalog/recipe.ts` `recipeBuilder` | the **whole catalog's** contract-bearing steps as a `## Wiring Requirements` table + `## Success Criteria` (a `GenerationRecipe` phase has no defined mapping onto a named pipeline step, so all are injected) |

It is **injection only** — nothing re-derives, re-validates or grades a contract, so no
acceptance verdict can move. Everything is size-capped (`MAX_STEP_CONTRACT_CHARS`,
`MAX_CATALOG_CONTRACT_ROWS`, `MAX_CRITERIA_LINES`, `MAX_CLAIM_CHARS`) and the caps are
asserted against the LIVE registry by `src/__tests__/lib/catalog/contractPrompt.test.ts`.
Golden pins live in `src/__tests__/lib/prompts/__golden__/contract-*.md` /
`recipe-*.md`. `PromptBuilder.addSuccessCriteria` (appending) exists so a shared builder can
seed criteria a later phase adds to — `withSuccessCriteria` replaces the section.

See [../catalog/index.md](../catalog/index.md) for the full pipeline program.

---

## Conventions / gotchas

- **Never hand-build prompts in caller code.** Use `TaskFactory` + `buildTaskPrompt`,
  or `PromptBuilder` for per-module builders. This keeps `@@CALLBACK` marker
  registration and context injection in one code path.

- **`staticFields` override Claude's output.** In `resolveCallback`, the merge is
  `{ ...parsed, ...cb.staticFields }` — static fields win. This prevents prompt
  injection from spoofing `moduleId`, `entityId`, etc.

- **`appOrigin` must be set for callback-bearing tasks.** Use `getAppOrigin()` on the
  client (`src/lib/constants.ts`) or `getOriginFromRequest(request)` in server
  handlers to get the absolute URL. Relative URLs silently fail since the callback
  is resolved from within the browser, not from the CLI subprocess.

- **`checklist`, `quick-action`, `feature-fix` get Wiring Requirements.** The set
  `WIRING_TASK_TYPES` gates the wiring block. Other task types (`ask-claude`,
  `feature-review`, `module-scan`, etc.) do not receive wiring context.
  (`cli-task.ts:173`)

- **UE5 vs web-app branching is transparent.** `buildProjectContextHeader` and
  `buildTaskPrompt` both gate UE-specific sections on
  `!dynamicContext?.projectType || projectType === 'ue5'`. Adding `dynamicContext`
  with `projectType: 'nextjs'` switches the entire prompt layer to web-app mode.

- **Callback registry is module-level / in-memory.** It does not survive Next.js
  hot-reload (dev) or server restart. The registry auto-deregisters on successful
  `resolveCallback`; failed resolutions leave the entry in place for retry.

- **100-minute hard timeout.** `startExecution` sets a 6 000 000 ms `setTimeout`
  that kills the child process if Claude does not finish. (`cli-service.ts:294`)

- **Headless editor tasks judge success by log, not exit code.** Task types like
  `procgen-dungeon`, `biome-scatter`, `mixamo-import`, and `character-setup` embed
  this rule in their prompt text because `UnrealEditor-Cmd` exits non-zero on the
  known PillarsOfFortuneBridge shutdown null-deref.

---

## See also

- [overview.md](overview.md)
- [module-system.md](module-system.md)
- [../catalog/index.md](../catalog/index.md)
