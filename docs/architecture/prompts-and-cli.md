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
| `src/lib/claude-terminal/run-callbacks.ts` | `settleRunCallbacks()` — the server settles a terminal run's declared `@@CALLBACK`s once each, POSTing only to their `/api/` path on the app's own origin; `sanitizeCallbackDescriptors()` for the query POST |
| `src/lib/model-policy.ts` | Model-policy registry (WS0): `getModelPolicy(taskClass)`, `taskClassForDispatchType()`, `resolveDispatchModelChoice()` — the single source of truth for which model + effort powers each task class |
| `src/lib/prompt-evolution/dispatch-resolve.ts` | `composeTaskDispatch()` / `resolveActivePrompt()` — swaps the served prompt-evolution variant in before the prompt is built; `STATIC_VARIANT_ID` sentinel |
| `src/lib/prompt-evolution/engine.ts` | `resolveDispatchVariant()` (serve) / `recordTrialForServedVariant()` (record) / `concludeTest()` (decide) — the A/B loop |
| `src/lib/prompt-evolution/challenge.ts` | `planChallenge()` — pure preflight for "test version X against the current one": incumbent (active, else seeded root) = arm A, diff summary, per-arm judge evidence (unjudged = `null`), blocks (`already-current`, `identical-prompt`, `test-running`, `no-incumbent`, `unknown-version`) |
| `src/lib/prompt-evolution/verdict.ts` | THE A/B verdict seam — `readFitness()` / `readTestVerdict()` (basis, rates, band, tie, per-arm shortfall, `canConclude`) and `decideWinner()` (the one crowning rule) |
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
  composition at all; its successor, the Feature Map's `useSectionScaffold`,
  dispatches `TaskFactory.quickAction` (prompt text unchanged, full header +
  domain + knowledge gained).
- *Feel vs UE (drift-only apply)* — `ai-feel`'s full-stack apply prompt names 34
  UPROPERTYs blind. `UEDriftPanel` (AI Feel tab) instead reads what the project
  declares through the read-only `POST /api/ue5-source/character-feel` (validation
  as `/api/ue5-source/parse`, module from the .uproject, <= 64 `.h/.cpp` under
  `Source/<Module>` matching Character|Dodge|Camera) and the pure
  `src/lib/character/feel-ue-sync.ts`: `FEEL_UE_BINDINGS` (feel field -> ordered UE
  aliases, e.g. MaxSprintSpeed|SprintSpeed), `parseFeelDefaults` (numeric literals
  only; a runtime assignment is a *runtime writer* - listed, never a value, and it
  makes a field `unparsed` only when no literal exists; disagreeing literals are
  `ambiguous`), `diffAgainstUE` (in-sync / drift / absent / unparsed / ambiguous,
  one row per bound field), `buildDriftApplyPrompt` (drift rows name the identifier
  and file:line to edit; absent rows are reported, never created; null = in sync)
  and `buildAdoptLayer` (reserved `ue-adopted` set layer). The prompt goes out as an
  `ask-claude` task on the panel's explicit click only, and the panel re-reads UE
  after the run.

**Two composition engines, and the migration off the second one.** Knowledge
routing closed the *content* gap, but a standalone builder dispatched by a raw
`sendPrompt` is still outside the `CLITask` rail, and that is a **visibility**
gap: `dispatch-resolve.variantKeyForTask` only sees tasks, so no prompt-evolution
variant can be adopted for such a prompt, no A/B test can be run on it, and
`TaskPromptInspector` cannot preview the string that ships. Phase 1 of the
migration converted the **material configurator**: `TaskFactory.materialConfigurator`
+ the `material-configurator` handler (which returns
`buildMaterialConfiguratorPrompt` VERBATIM — the builder already emits its own
header, so the handler adds no second header, no wiring block, no callback
section) + a `variantKeyForTask` branch keyed by
`materialConfiguratorVariantKey(config)`. That key digests the WHOLE configuration
because the prompt embeds it — same reasoning as the `generate` key ending in the
entity id. `MaterialsView` dispatches it via `useModuleCLI.execute`, never
`sendPrompt`. Pinned by `__golden__/task-material-configurator.md` (byte-identical
to `builder-material-configurator.md`) and
`__tests__/lib/prompt-evolution/material-configurator-rail.test.ts`.

Phase 2 converted **post-process** the same way: `TaskFactory.postProcess(spec)`,
a verbatim `post-process` handler and `postProcessVariantKey(spec)`. The config
is the stack's one spec — `toStackSpec(effects, resolution)` in
`lib/post-process-studio/stack-spec.ts` (live param values, estimator ms at the
chosen resolution, budget, disabled ids) — so `buildPostProcessPrompt(spec)` is
the only post-process builder and prints the GPU budget. Both the Recipe Studio
and the Materials Post-Process tab dispatch it via `useModuleCLI.execute`; the
old server-side builder (`POST /api/post-process-studio`) is retired (400, GET
presets stays). Pinned by `task-post-process.md` (byte-identical to
`builder-post-process.md`) and `prompt-evolution/post-process-rail.test.ts`.

**Remaining gap: 8 standalone builders still dispatch through raw `sendPrompt`**
and stay invisible to prompt evolution — `material-patterns`,
`style-transfer` (`MaterialsView`), `audio-scene`, `audio-events`
(`AudioView/useAudioView`), `inventory`, `menu-flow` (`UIHudView`), `level-design`
(`useLevelDesignView`, three dispatch sites), and `ai-testing`
(`AIBehaviorView`). Converting each is the same three-part move as above.

**The audio builders share one UE runtime contract (`src/lib/audio-runtime-contract.ts`).**
The deterministic codegen (`audio-codegen.ts`) and the `audio-scene` (system, zone,
soundscape) and `audio-events` builders all write into `Source/<Module>/Audio/`, and
they once asked for three pool-owning `UGameInstanceSubsystem`s under different names.
`AUDIO_RUNTIME` now names each class once, with the names and headers codegen already
emits (`UAudioSceneManager`, `UAudioReverbPresets`, `UAudioZoneAttenuation`,
`ASceneAudioVolume`, `ASceneEmitterSpawner`, `UProceduralAmbientManager`), plus the one
CLI-authored class, `UAudioEventRouter`. Codegen does not import the contract;
`__tests__/lib/audio-runtime-contract.test.ts` parses codegen output against it as the
drift guard, and asserts that the five generators together request exactly one
subsystem. Every builder embeds `runtimeContractBlock(scene, module)`. That block says
`UAudioSceneManager` is the only audio subsystem and owns the pool size and voice
limit. It marks the codegen headers as do-not-edit, so PlayEvent, the pool, the
priority queue, concurrency and cooldowns go in `UAudioEventRouter`: a `UObject`
(not a subsystem) whose Outer is the manager and which reads
`GetSoundPoolSize()` / `GetMaxConcurrentSounds()`. The zone prompt configures an
`ASceneAudioVolume` entry, and the soundscape prompt adds a `UProceduralAmbientManager`
layer. `buildAudioEventPrompt(config, ctx, scene?)` takes the settled scene's budget
from `useAudioView`. It prints `eventBudget` (declared voices vs the scene limit), for
example "21 declared voices exceed the scene limit of 16 ... priority decides which
voice is stolen".

The Settings tab states what that limit does in a fight: `src/lib/audio-event-budget.ts`
(`simulateEventBudget`) runs the scene's Event Catalog against the draft
`maxConcurrentSounds` with the same three rules the event prompt asks
`UAudioEventRouter` to implement (per-event cooldown, oldest-steal at the class cap,
lowest-priority steal at the limit, else drop), and `AudioView/BudgetStressPanel`
shows per-class started/cooled/cut/stolen/dropped, with in-row fixes written to the
per-scene catalog store. A class never triggered, or with no known clip length, is
NOT MEASURED. Change the router rules in `prompts/audio-events.ts` and the simulator
together.

**Asset-Code Oracle remedies start on the rail (remedy -> rescan -> key diff).**
`src/lib/asset-oracle/oracleRemedy.ts` plans only the task body for the two
violation types a CLI can fix without a delete (`naming-mismatch`: editor rename
that leaves redirectors; `missing-asset`: the BP subclass). `useAssetCodeOracle`
dispatches it as ONE `ask-claude` CLITask via `useModuleCLI.execute` (session
`asset-oracle-remedy`), so the handler composes the header. Its `onComplete`
re-runs the oracle, and `oracleDiff` compares the stable violation ids
(`<type>:<subject>`, recorded per scan as `violationKeys` in `marketplaceStore`)
to show whether each targeted key resolved.

**Checklist runs are scored by the judge fleet, not by their own report
(phase 1).** A checklist callback POSTs `{ completed }` to
`/api/checklist/complete`, which books the A/B trial with
`success = completed !== false` — the run grading itself. A checklist wrote no
artifact and the judge fleet enumerates catalogs from `step-facts.json`, so no
verdict could ever exist for one. An **experimental** checklist run (one served a
real prompt-evolution variant — never the static path) now emits a SECOND
`@@CALLBACK`, to `/api/pipeline-artifacts`, filing its work product under
`catalogId: 'checklist-runs'`, `entityId: <moduleId>`, `step: <itemId>`, with
`promptVersion` + `promptVariantId` in `staticFields`. `status: 'pending'` and
`tier: 'L0'` also ride in the static fields (which take precedence over the
model's JSON), so a run can never grade its own work; the route records the row
UNGRADED — no checker is registered for this catalog — and the judge fleet
supplies the verdict. A static-variant run emits nothing extra and is
byte-identical to before, so it costs the judge fleet nothing.

`computeVariantFitness` already joins artifacts to verdicts by
`(catalogId, entityId, step)`, so a `checklist-runs` verdict resolves a checklist
variant's fitness with no change. `verdict.readFitness(test, judged)` (re-exported
from `ab-testing`) is the seam: it uses judged pass rates when BOTH arms clear
`MIN_JUDGED_VERDICTS_PER_VARIANT`, otherwise falls back to the self-reported
completions and SAYS which basis it used (`FitnessReading.basis` + `.note`).
`pickVariant` exploits on that reading and `evaluateTestWithBasis` runs the same
proportion z-test over it; `engine.judgeScoresByVariant()` supplies the scores and
returns `undefined` (never throws) when nothing has been judged, which is what
makes the fall back automatic.

**One verdict reading.** `lib/prompt-evolution/verdict.ts` is the only place an
arm's rate, the 0.05 tie margin (`TIE_MARGIN`), the z-test band
(`strong|moderate|weak|none`), the decide-now shortfall and the basis are
computed. `decideWinner(test, reading)` is the single crowning rule (a gap of at
least the margin wins on results; closer is a tie broken by the lower average
duration) and both `evaluateTestWithBasis` (auto) and `forceConclude(test, judged)`
(decide-now) crown through it — so pressing decide-now on judged evidence cannot
overturn what the judges found, and a tie never falls to slot A by position.
`readTestVerdict(test, judged)` → `ABTestVerdict` is computed at READ time, never
stored: `get-tests` / `record-trial` / `conclude-test` return `ABTestView` (the row +
`verdict`), `explainTestVerdict(test, labelA, labelB, verdict)` words it (no mirrored
constant), and `ABTestCard` shows the basis, gates decide-now on
`verdict.canConclude` and names the per-arm shortfall. A refused conclude (409) is
returned by the store as `{ ok: false, reason }` and shown on the card — it never
writes `store.error`, which would hide every panel of the view. **Not yet done:** `step-facts.json` has no
`checklist-runs` rows, so the judge fleet does not yet enumerate the catalog.

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

The `run-ai-tests` task (`TaskFactory.runAITests(..., runId)`) never lets the
agent grade itself. Every sandbox prompt names a scenario's UE test through ONE
identity (`@/lib/ai-testing/test-identity`: `AI.BehaviorTests.<Class>.S<id>_<Slug>`,
matched by the rename-proof, prefix-free `S<id>_` prefix). The run prompt spells a
single headless boot via `buildBatchAutomationArgs` (pure, in
`test-gate-runner/batchAutomationArgs.ts` so client prompt builders can use it)
with `-ReportOutputPath=<project>/Saved/Automation/PoF-AITests/<runId>`. The
callback's staticFields carry `runId` / `reportDir` / `scenarioIds`, and
`record-run-results` checks the dir's shape (400 on `..` or any other path),
reads UE's `index.json` (`readReport`) and derives each scenario through
`deriveRunVerdicts` (`@/lib/ai-testing/run-verdict`): report pass means passed,
fail means failed, and an unmatched test or a missing report means error. The
agent's claim survives only as a note. If the run ends without a confirmed
callback, `AIBehaviorView` POSTs `record-run-results` itself with `results: []`,
so no dispatched scenario stays `running`.

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

**One tag-rule direction.** A `TagRule` is **ability-owned**: `sourceTag` is the
ability the rule lives on, `targetTag` the gating tag, and `type` the GAS
container it lands in (`blocks` → `ActivationBlockedTags`, `requires` →
`ActivationRequiredTags`, `cancels` → `CancelAbilitiesWithTag`) — what GAS
stores on the ability, and what `deriveDefaultSpec`, forge adoption, the
draft-spec callback schema and `buildGenerateAbilityBundlePrompt` (which reads
only `targetTag`) all speak. The GAS Blueprint editor's archetype templates are
written as kit-wide patterns ("`State.Dead` blocks `Ability.*`"), so
`bindRulesToAbility(rules, abilityTag)` in `@/lib/ability/tag-rules` is the one
boundary where they enter a spec: template apply flips a pattern that targets the
bound ability, drops (with a named reason, counted on the template badge) one that
targets another ability or is a state→state effect-level rule, and passes an
ability-owned rule through unchanged (idempotent). The Tag Rules panel reads rows
as "<ability> blocked by <gating tag>", Add Rule creates an ability-owned rule,
Unmatched is judged on the gating tag only, and the wiring graph links effects to
rules via `effectRuleLinks` (an effect that grants a rule's gating tag drives it).
The same module owns the shared `tagsOverlap` matcher (exact, `X.*` wildcard, GAS
parent/child).

**Generate preflight.** The spec bar's "Generate GAS effects" click goes through
`reviewGenerate()` on `useAbilitySpecBinding`, not straight to dispatch.
`preflightGenerate({ scalars, effects, attributes })` in
`@/lib/ability/generate-preflight` predicts what the prompt will do to the design:
`nothing-to-generate` (block: no effects, the run would stop), `damage-override`
(an authored Health hit differs from the catalog damage pin; Fix sets it to
`-damage`), `damage-unpinned` (no effect reduces Health, e.g. every template
damages through `IncomingDamage`; surface-only with `fix: null`, because where the
pin lands is a design call and auto-adding Health would author double damage),
`cooldown-override` (an effect "Cooldown" that disagrees with the resolved ability
cooldown; it is dropped and never becomes a GE Period) and `unknown-attribute`
(becomes `// TODO: unknown attribute`; Fix adds it to the attribute set). The
cooldown prediction calls `resolveGenerateCooldown`, which
`buildGenerateAbilityBundlePrompt` itself uses, so the preview and the prompt share
one rule. Which Health hit is "primary" is the preflight's own guess (the prompt
leaves it to the model). A clean spec dispatches on the first click; otherwise the
inline `GeneratePreflight` panel offers per-finding Fix, "Fix all & generate"
(`confirmGenerate({ applyFixes: true })` patches the editor through `onHydrate`,
then dispatches the patched effects) and "Generate anyway". `generateEffects()`
still dispatches immediately, and the prompt text is unchanged.

Tasks whose `prompt` is empty (e.g. `featureReview`, `moduleScan`) rely entirely on
`buildTaskPrompt` to assemble all content from the extended fields.

**Batch feature review is scoped.** `POST /api/feature-matrix/batch-review` (body typed as
`BatchReviewStartRequest` in `src/types/batch-review.ts`) runs `featureReview` tasks one
module at a time; an optional `moduleIds` subset limits the batch (validated by
`resolveBatchModules` in `src/lib/evaluator/stale-review-plan.ts` — an unknown id is a 400
naming it, nothing starts), omitted = every module with definitions. The one client is
`useBatchReview` (poll / start / abort / clear, `onSettled` once per running -> finished):
the Scanner tab's `BatchReviewPanel` starts all modules, the Quality tab's
`AggregateQualityDashboard` starts only its stale set (`selectStaleModuleIds`) or one
selected module, badges each heatmap cell from `cellReviewState`, and refetches its
roll-up when the batch settles.

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
| `task-prompt-golden.test.ts` | One pin per `CLITaskType` (**all 20**, with a coverage guard against `taskPromptHandlers`) + one per standalone builder, + the loud-fallback suite |
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

**One run settlement (server, `run-settle.ts`).** Every server path that spawns a CLI run
and waits for it — `awaitCallback` (one-shot propose/refine/step), batch review
(`/api/feature-matrix/batch-review`) and the deep-eval job's executor — settles through
`settleExecution(executionId, { expect: 'callback' | 'end', timeoutMs?, signal? })`. It never
rejects: it returns `Result<{ text, callback }, { reason, message }>` with a closed reason
union `no-callback | timeout | cancelled | exit-nonzero | error-result | spawn-error |
not-found`. It reads the execution's event backlog and status at subscribe time (a spawn
that failed synchronously settles `spawn-error` at once), then listens live and on the
process `close` (a clean exit with no result emits no event), so a run that ended cleanly
without a marker settles `no-callback` the moment it ends instead of holding the caller for
the whole window. Only a still-`running` run is aborted — on the caller's timeout or signal
— so no taskkill hits an exited PID and a `completed` run stays `completed`. `awaitCallback`
throws the seam's message (`ended without a callback`, `callback timeout … (execution
aborted)`); batch review writes `mod.error = "<reason>: <message>"` (a callback-less or
rejected-callback run is `error`, never `completed`) on `UI_TIMEOUTS.batchReviewTimeout`,
and its abort is an `AbortController` the seam honours; deep eval passes its job signal, so
a cancel kills every in-flight pass. The runaway guard's error event carries
`timedOut: true` and reads `timeout`. (Server-side; not the client door
`cliPanelStore.settleRun`.)

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

6. **The run declares its callbacks; the SERVER settles them** (settlement lives with
   the run, not the tab). `useTaskQueue` (`submitPrompt` and queued `executeTask`) derives
   `callbacks = callbackIdsIn(prompt).map(getCallback)` from the registry of the tab that
   built the prompt and sends them with the query POST. The route keeps well-formed
   descriptors (`sanitizeCallbackDescriptors`) and passes them, with
   `appOrigin = getOriginFromRequest(request)`, to `startExecution`, which stores them on
   the execution. A run that declares none is unchanged (one-shot, batch review, free-typed
   prompts).

7. **`settleRunCallbacks({ text, callbacks, appOrigin })`** (`run-callbacks.ts`) runs in
   `cli-service` when the run's `result` arrives (or on a clean exit without one), once per
   execution (`callbacksSettling` latch): it parses **every** marker in the run's text
   (`parseAllCallbackMarkers`), keeps only declared ids, POSTs each id **once** (a repeated
   marker never double-POSTs), merges `staticFields` over the payload (`mergeCallbackBody` —
   static fields win), and is bounded per POST by `UI_TIMEOUTS.callbackSettleMax`. **The
   server is never a relay:** a descriptor is POSTed only to its `/api/…` path resolved
   against the app's own origin; one naming another host (or a path outside `/api/`) is
   `failed` and never fetched. The verdict (`confirmed` / `failed` / `missing`, plus the
   failed `{ callbackId, payload, error }[]`) is recorded as `execution.callbackStatus` /
   `callbacksFailed` and emitted as a `callbacks` event. The stream route forwards it as a
   `callbacks` SSE frame and, for a run that declared callbacks, closes after that frame
   instead of after `result`; `GET /api/claude-terminal/query` returns `callbackStatus`,
   `callbacksFailed` and `isError` alongside `status`.

8. **The terminal only reads the verdict.** Attached: the `result` handler waits (bounded by
   `callbackSettleMax`) for the `callbacks` frame and completes with its status. **Hidden**
   (the module was navigated away from, so the EventSource is closed): a visibility-gated
   poll of `GET /query` every `UI_TIMEOUTS.stuckCheckInterval` ends the run from the
   execution status — `onTaskComplete` fires once through `finishRun`, without re-show, and
   a later re-show does not re-attach. The receiving API handler updates its state
   (checklist progress, feature-matrix entry, scan findings, pipeline artifact, etc.).
   `resolveCallback` (client registry) remains only for the host's **Resubmit** of a failed
   payload and for server routes that registered their own callbacks (batch review).

**Callback truth (additive completion status).** The run's completion signal carries a
`callbackStatus` — `confirmed` (every marker's POST succeeded), `failed` (a marker was
emitted but its POST was rejected), or `missing` (no marker at all). It is the server's
verdict (step 7), awaited inside the existing `callbackSettleMax` race, so the `isRunning` release is **bounded, never
indefinite** — the session stays running (`runPhase: 'settling'`) only until the race ends.
It flows `useTaskQueue.onTaskComplete(id, success, { callbackStatus })` → `bindSessionRun`
→ `cliPanelStore.endRun(id, seq, { success, callbackStatus })` (stored as
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
`onTaskComplete`. Every one of those paths then ends through ONE `finishRun(success,
{ callbackStatus })`, which releases `dispatchingRef`, records the registry completion and
fires `onTaskComplete` — no terminal path can skip one of them (the stuck-poller paths used
to leave `dispatchingRef` set and silently drop every later dispatch).

**The server decides when a run ends (`runArbiter.ts`).** The terminator set that ends a
run directly is closed and positive: the `result` frame, the `error` frame (including
`Execution not found`, which ends it as unknown), a start failure and user Abort. Every
other observation only asks the server: stream `onerror` (after
`UI_TIMEOUTS.streamReconnectDelay`), the visible silence watchdog (no frame at all,
heartbeats included, for `UI_TIMEOUTS.streamSilenceMax`, about 3x the stream route's 15 s
heartbeat), the stuck poller (registry verdict or heartbeat staleness) and the hidden poll.
Each one goes through `useTaskQueue.consultServer`, which GETs `/api/claude-terminal/query`
and applies the pure `arbitrateRunEnd(observation, { declared })`. The rule: `running` gives
`reconnect` (a closed stream on a visible tab re-opens at the `after=<lastSeq>` cursor,
keeping `executionIdRef`, so Abort still works); a completed run that declared callbacks
with no verdict yet, or an unreachable server, gives `wait` (the watchdog re-arms, so the
run is asked about again and never parked); `Execution not found` gives an end as unknown;
anything else gives an end with the server's `status`/`isError`/`callbackStatus` through
`finishRun`. A reconnect never re-POSTs a query or a callback. So a dropped stream no longer
records a false failure, and Retry can no longer start a second process beside a live one.

**One run-lifecycle door.** A run's session state is written ONLY through the sequenced
door in `cliPanelStore`: `beginRun(id) → seq` (isRunning=true, clears the previous run's
`lastTaskSuccess`/`lastCallbackStatus`, bumps `runSeq`), `settleRun(id, seq)` (stream
ended → `runPhase: 'settling'`, still isRunning), and `endRun(id, seq, outcome)`
(isRunning=false AND the outcome in one store write; a stale `seq` is a no-op).
`InlineTerminal` wires the terminal through `bindSessionRun(sessionId)`
(`store/sessionRun.ts`): `onTaskStart` (fired synchronously by `useTaskQueue` for queued AND
interactive runs) begins, `onStreamingChange(false)` settles, `onTaskComplete` ends. So every
consumer of the isRunning edge — `useModuleCLI`, `event-bus-bridge` (`cli.task.completed`),
the SidebarL2 badge — reads THIS run's outcome, and module buttons stay disabled through the
settle window instead of re-enabling while the terminal would still drop the dispatch.

**Post-run bar acts on run facts (resubmit path).** `SuggestedActions` renders
`generateSuggestions(session)` from `suggestionIntents.ts` — pure, keyed on the session's
`lastTaskType`, `lastTaskSuccess`, `lastCallbackStatus`, `moduleId`, `lastDispatch` and
`pendingCallbacks` (never the `sessionKey` spelling, never a sentinel prompt). Actions are
typed: `redispatch` (Retry replays the exact last raw prompt + task type; `resume: false` on
the `pof-cli-prompt` event asks for a fresh Claude session), `resume` ("Collect missing
result": a success whose prompt carried `@@CALLBACK:<id>` but reported `missing` asks the
same session for exactly those ids — no "next item" is offered), `resubmit-callback`, and
`navigate` (the owning module's overview). `useTaskQueue` reports `onDispatch({ prompt,
taskType })` from `submitPrompt` and `onCallbacksUnresolved(markers)` from the server's
verdict (the markers whose POST failed, dropped if a newer run began); `InlineTerminal` stores them
via `recordDispatch` / `setPendingCallbacks`. **Resubmit:** `resubmitPendingCallbacks(id)`
re-POSTs each retained payload through `resolveCallback` (the registry keeps an entry until
its POST succeeds) — no new run, no tokens — then `recordCallbackResubmit(id, seq, remaining)`
sets `lastCallbackStatus` to `confirmed` (none remain) or `failed` (the rest kept). A payload
the server rejected on validation fails identically; it recovers transport/transient
failures. `lastDispatch`/`pendingCallbacks` are in-memory only (stripped by `partialize`,
`pendingCallbacks` cleared by `beginRun`). `useChecklistCLI` is not re-signalled by a
resubmit; its own `retryUnconfirmed()` stays.

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

Completion is detected by a `useCLIPanelStore.subscribe` listener on the session's
`endRun` transition (isRunning true → false). The outcome (`lastTaskSuccess`,
`lastCallbackStatus`) is captured from that same state — the run door writes both in one
update — then analytics (`recordSessionOutcome`) and `onComplete(success, callbackStatus)` are
delivered in a microtask, so a re-dispatching `onComplete` never re-enters the store
mid-notification. (There is no timed read: the old 50 ms `raceConditionBuffer` read raced a
callback settle of up to `callbackSettleMax` and returned the previous run's outcome.)

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
   The manual "decide now" path (`concludeTest` → `forceConclude(test, judged)`) returns
   `Result<ABTestView, string>`, crowns on the same reading and tie rule as auto-conclude, and **refuses below `MIN_TRIALS_PER_VARIANT` (3) trials per
   arm**, naming the shortfall; the API surfaces that as a 409 so the UI can say why
   nothing was decided. Previously it crowned slot A at zero trials (`rateA >= rateB`
   with both rates 0) — a coin flip dressed as evidence.

Adopting a winner / restoring a version flips the `active` flag, which changes what leg 1
serves once no test is running.

**One running test per item.** `engine.startABTest` returns `Result<ABTest, string>` and
refuses — naming the running test — while another test is still `running` on the same
(module, item); `start-ab-test` answers **409** with that reason. The reason: leg 1 serves
from the NEWEST running test (`running[running.length - 1]`) while leg 2 books to the
FIRST running test the served variant is an arm of (`getABTestsForItem` is `created_at ASC`),
so two concurrent tests sharing a baseline were served by one and counted on the other,
and the older test's challenger was never served again. Conclude (or let auto-conclude
finish) before starting the next test on the item.

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
them — so leg 1 begins serving both arms on the next dispatches. A 409 (a test is already
running) comes back inline as the save result: the store's `startABTest` returns
`StartOutcome` (`{ ok, test } | { ok: false, reason }`) and never writes `store.error`.

**Challenge the current version from History.** Each non-current node in
`PromptVersionTimeline` offers *Challenge current*, which opens `ChallengePreflight`:
`planChallenge` (see the file map) over the loaded history, `store.abTests` and
`store.variantFitness` (`loadVariantFitness()` → `get-variant-fitness`, the first client
reader of that route) — diff incumbent → challenger (`PromptDiffView`), the mutation class,
each arm's trial stats and judge score or *unjudged*, or the blocker with a link to the
running test. *Start A/B test* calls `store.startChallenge(challengerId)`, which always
puts the current version in arm A. The `start-ab-test` suggestion opens History on its
item (via `store.selectedChecklistItemId`) instead of asking the user to pick a partner.

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

**Canon profiles select the WORLD before categories** (`@/lib/catalog/canon/profiles.ts`, 2026-09-22).
A rule belongs to one profile (`ProjectRule.profile`, absent = `pof`, PoF's own world); a profile may
inherit named `pof` rules explicitly by id (engineering conventions — never category-wide, because
`project` mixes engineering law with design law). The profile is resolved PER ENTITY, never by a global
switch: an ingested entity's `provenance.canonProfile` (stamped from its `ReferenceSource`) travels on
`LabEntity.canonProfile` — set by every constructor through `canonProfileOf` — and
`buildStepProducePrompt` calls `rulesForProfile` before `canonContextFor`. An unknown profile throws.
The one-shot DESIGN prompt (a new entity is PoF's) filters to `pof`. `project_rules.profile` stores it
(additive migration runs before seeding); each profile seeds ONCE under its own marker, and a later edit to
a shipped rule's TEXT is reconciled by **canon drift** (next paragraph). Threshold checkers
(`acceptance/invariants.ts`, `balance/canon-conformance.ts`) still read PoF's `CANON_SEED` and are NOT
profile-aware yet — **superseded (W02):** the 8 law-backed invariants are wrapped by
`canonLawChecker(lawId)` and return `pending` + `UNGRADED:` where the entity's profile (`CheckerContext.canonProfile`)
has no such law; every step's `accept` is wrapped once at `registerCatalogPipeline` by the SOURCED guard (a seeded
artifact never grades `pass`). Markers live in `acceptance/markers.ts`.

**Canon drift: provenance-hashed sync with an operator review** (`@/lib/catalog/canon/canonSync.ts`, 2026-09-29).
Checkers and derivations read the SHIPPED law text; every produce prompt cites the `project_rules` copy. Each row
records `shipped_hash` (additive, nullable): `canonTextHash` of the shipped text it was last written FROM. Only
shipped-text writes stamp it (fresh seed, profile offer, restore-defaults, adopt, keep-mine); an operator upsert
never touches it. The pure `planCanonSync(shipped, rows, offeredIds)` gives each rule one verdict from a closed
vocabulary: `fresh` (equal; stamped if the stamp is stale) · `follow` (row still equals its recorded offer, shipped
moved) · `edited` (operator edit, shipped unmoved; no finding) · `conflict` (operator edit AND shipped moved) ·
`unrecorded` (legacy NULL stamp, differs) · `missing` (shipped, never offered) · `orphaned` (a seed id no longer
shipped). An offered-then-deleted id gets no verdict (a deleted rule never returns). **Only `follow` and the `fresh`
stamp are applied automatically** (`ensureTable`, once per process, so the machine-global DB tracks the shipped canon
of whichever checkout ran last); everything else ASKS: `GET /api/project-rules?view=drift` groups findings by profile
→ verdict with both texts, and `POST ?action=adopt-shipped | keep-mine | undo-adopt {ids}` (behind
`requireOperator`) answers them. **Adopt is reversible:** it archives the replaced row (every column, or its
absence) in `project_rules_adopted` first, and undo-adopt restores it byte-for-byte. keep-mine stamps the current
shipped hash, so the rule asks again (`conflict`) only when the shipped text moves again. Orphans are only surfaced;
removal is the explicit Delete. The lab's Canon view banners the active profile's drift and opens
`CanonDriftPanel` (old vs shipped per rule, per-rule Adopt / Keep mine, bulk "Adopt shipped for all N unrecorded"
with a count preview before the write, and Undo per adopted rule). The stamp is a `contentHash` of the canon
fields; changing that hash makes every stamped row read as edited, which only ever asks (never auto-writes).

**Canon law reach + refusal at authoring time** (`@/lib/catalog/canon/ruleReach.ts`, 2026-09-30).
`ruleReach(rule, pipelines)` → `{ scopeKnown, stepCount, steps, byCatalog }` is exactly the set of Produce prompts a
law enters, derived from the SAME `rulesForProfile` (own profile + profiles inheriting it) × `stepsForProfile` ×
`canonCategoriesForStep` × `selectRules` that `buildStepProducePrompt` uses — a parity test pins reach == the steps
whose built prompt carries the law (a global `game` law reaches 253 prompts; the same law as `art`, 77).
`validateRuleDraft(draft, pipelines)` (`canon/validation.ts`) is the ONE upsert check, run by the editor before POSTing
and by `POST /api/project-rules`: schema, registered profile, and scope ∈ `global` ∪ registered catalog ids — an
unregistered scope is refused `400 Unknown scope "<scope>"` (it used to be stored with 200 and reach nothing). The
route imports `pipelines/registry.generated` itself, so catalog scopes resolve in its own import graph.
`useCanonStore.upsert` is server-first: it POSTs, commits locally only on success and returns the `Result` — lab
previews read the store while dispatch reads the DB, so the old optimistic write cited laws the dispatch never
carried. `CanonRuleEditor` shows the live reach line, picks scope from a list, and stays open with the refusal;
'+ Add rule' is a local draft, so Cancel writes nothing.

**A produce prompt names everything its checker grades** (`acceptance/requiredFields.ts`): `fieldsPopulated` keys,
`minLength` text fields, `minCount` lists and the `wiringContract` STRUCTURE are tagged on the checker, collected
through `allOf`, and rendered FIRST in the step contract (`## Required fields`) so the size cap cannot drop them.
Before this, 102 of 114 key-graded steps hid at least one graded key from the producer. A value equal to
`REFERENCE_GAP` ("not in the reference") is graded as missing. An INGESTED entity also gets a `# REFERENCE VALUES`
section (`referenceValues.ts`) with its source row (REPRODUCE); since W03 (D11) an AUTHORED entity gets the same
section as `# ENTITY VALUES` (`entityValuesBlock` — stay CONSISTENT, state any change), so every entity's own design
data reaches its produce prompts. `labIdentityOf` gives every `LabEntity` constructor its canon profile and reference
in one place. **Linked references (2026-09-27, /diablo B33):** beside the sibling steps, a produce prompt also carries
the reference data of entities LINKED to this one in other catalogs (`src/lib/catalog/reference/linkedReferences.ts`:
incoming root links plus outgoing links to depth 2 — e.g. a character → its dialog tree's behaviour ledger → the quests
its handlers reference), under a "Linked reference … ground truth" heading, capped at 16,000 characters with an
explicit truncation marker. Threaded through `stepPrompt.ts`, `headless.ts`, the one-shot step route and the lab data
path so lab, headless and preview prompts stay identical. Why: a character producer that never saw the NPC's quests
and services DENIED them when told not to invent (27 % contradicted claims, W65). Profile-dependent keys (D14): a canon profile declares its damage-element set
(`canon/elements.ts`: pof fire/ice/lightning/chaos, diablo1 magic/fire/lightning); `resistancesPopulated` grades
`<element>Res` for the entity's profile and `requiredFieldsOf(checker, canonProfile)` names those keys in the prompt.

**Wiring contracts reach prompts** (`src/lib/catalog/contractPrompt.ts`). Pipelines author
137 `wiringContract` blocks + per-step `criteria` inside their produce bodies; for a long
time the ONLY consumer was the acceptance checker, so a CLI was asked to author an artifact
without being told the contract it would be graded against. `stepContractBlock(spec, entity)`
closes the gap: it renders the step's **declared** contract — `StepSpec.contract` (a
`StepContractDecl`: granted/activated/dependencies/verification, world-neutral, `{slug}`/`{name}`
filled for the entity) and `StepSpec.criteria` — as a capped `# ACCEPTANCE CONTRACT FOR THIS
STEP` block. It used to extract the contract by RUNNING the produce stub, which injected one PoF
entity's content (a specific ability, loot table, item, tuned number) into every entity's live
prompt; /diablo W02 produced three Diablo zombies with PoF's Ground Slam and the shape-only checker
passed them. Since W03 (D12) a stub never reaches a prompt: a step with no declaration injects no
contract (its graded structure still reaches the prompt via `## Required fields`). Declarations
are guarded by `src/__tests__/catalog/contract-declarations-neutral.test.ts` (no seeded entity id
or name of any catalog; the declaration sits where the checker grades the contract) and counted by
`npx tsx scripts/diablo/contract-coverage.ts`. Three seams share the block so the prompt is
identical wherever a step is driven:

| Seam | File | What it injects |
|------|------|-----------------|
| generic lab step (~330) | `ArchetypeStep.buildPrompt` | that step's own contract + criteria |
| headless / pof-mcp step | `catalog/headless.ts` `buildStepRecipe` | same block, same canon scope. The recipe's `example` is the body's output stamped by `stampTemplate` like any stub write, so a non-exemplar entity's data-blind example carries `data.template` and grades `pending` with a `TEMPLATE:` `exampleReason` (never handed over as passing data); `settle` and submit's `next: { settle, entityStep }` name the act that settles a verdict (`catalog/stepSettlement.ts` `settlementOf`: resubmit / fill-gap / produce / produce-live / drain / settle route / none for UNGRADED) and the lab coach ladder's next step (`pickLadderIssue` over persisted verdicts) |
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

### Codex CLI as a reviewed executor (`src/lib/codex-exec/`, `scripts/codex/dispatch.ts`)

A second CLI, OpenAI's `codex` (0.155.1), is driven headlessly as an EXECUTOR under Claude's review —
used by the `/diablo` loop for large volumes of well-specified work. It is not an app subsystem: no
route or UI spawns it; the overseer runs the dispatcher from a session.

- **Pure core:** `routing.ts` (tier → model/effort: `bulk` → `gpt-5.6-sol` low/medium, `complex` →
  Sol high/xhigh, `visual` → `gpt-6-astra`), `args.ts` (argv with the probed traps encoded — stdin
  closed / brief via `-- -`, `--` fencing the variadic `-i`, `--approve-for-me` instead of `-s` for
  tasks that run tests because Windows `workspace-write` refuses child processes), `events.ts`
  (`--json` stream → thread id, commands with exit codes, usage, completed-or-cut-off), `brief.ts`
  (repo laws travel IN the brief; schema-enforced report with `deviations` + `openQuestions`),
  `ledger.ts` (first-pass / accepted rates per tier · model · task class).
- **Dispatcher lifecycle:** `run` (own worktree `../pof-codex/wt/<id>` + branch `codex/<id>`, a
  `node_modules` junction, the generated pipeline registry) → `diff` → `resume` (same session,
  schema-enforced) → `land` (patch into the WORKING TREE only — never the shared index; refuses files
  with foreign WIP; warns on out-of-scope files) → `record` → `discard` (junction removed with
  `rmdir`, never recursively). Codex never commits; the overseer commits with a pathspec.
- **Process hygiene** (registry `subprocess-lifecycle`): wall-clock timeout and a stall watchdog
  (no events from THIS run for `POF_CODEX_STALL_MIN`, default 10 min) reap the child's process TREE
  with a polite → forced `taskkill /T` ladder scoped to its own PID, and the run status records which
  rung was needed (`timeout (forced kill)`). `list` flags a run whose host died mid-flight.

## Conventions / gotchas

- **Never hand-build prompts in caller code.** Use `TaskFactory` + `buildTaskPrompt`,
  or `PromptBuilder` for per-module builders. This keeps `@@CALLBACK` marker
  registration and context injection in one code path.

- **`staticFields` override Claude's output.** In `mergeCallbackBody` (server settlement and `resolveCallback`), the merge is
  `{ ...parsed, ...cb.staticFields }` — static fields win. This prevents prompt
  injection from spoofing `moduleId`, `entityId`, etc.

- **`appOrigin` must be set for callback-bearing tasks.** Use `getAppOrigin()` on the
  client (`src/lib/constants.ts`) or `getOriginFromRequest(request)` in server
  handlers to get the absolute URL. The server settles a terminal run's callbacks
  against its own origin and accepts only `/api/` paths there — a callback to another
  host is refused, never relayed.

- **`checklist`, `quick-action`, `feature-fix` get Wiring Requirements.** The set
  `WIRING_TASK_TYPES` gates the wiring block. Other task types (`ask-claude`,
  `feature-review`, `module-scan`, etc.) do not receive wiring context.
  (`cli-task.ts:173`)

- **UE5 vs web-app branching is transparent.** `buildProjectContextHeader` and
  `buildTaskPrompt` both gate UE-specific sections on
  `!dynamicContext?.projectType || projectType === 'ue5'`. Adding `dynamicContext`
  with `projectType: 'nextjs'` switches the entire prompt layer to web-app mode.

- **Callback registry is module-level / in-memory (the dispatching tab's).** It only
  supplies the descriptors a run declares at dispatch and the Resubmit path; the run
  itself is settled by the server, so a hidden or navigated-away tab no longer loses or
  duplicates it. The registry auto-deregisters on a successful `resolveCallback`.

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
