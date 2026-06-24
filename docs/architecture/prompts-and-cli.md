# Prompt System and CLI / Task System

Composable prompt construction for every Claude Code invocation, plus the unified
`CLITask` abstraction that ensures callers never hand-build prompts or embed HTTP
calls in strings.

---

## Key files

| File | Purpose |
|---|---|
| `src/lib/prompt-context.ts` | `buildProjectContextHeader()` — single source of truth for project metadata, engine paths, build commands, dynamic scan, and error memory |
| `src/lib/prompts/prompt-builder.ts` | `PromptBuilder` — fluent builder enforcing a fixed 6-section order |
| `src/lib/prompts/animation-checklist.ts` | Per-module builder (animation); illustrates `.withProjectContext()` + `.withRawTask()` + `.withRawBestPractices()` |
| `src/lib/prompts/material-configurator.ts` | Per-module builder (materials); illustrates `.withBestPractices()` |
| `src/lib/cli-task.ts` | `CLITask` type hierarchy, `TaskFactory`, `buildTaskPrompt()`, callback registry (`registerCallback` / `extractCallbackPayload` / `resolveCallback`) |
| `src/lib/claude-terminal/cli-service.ts` | `startExecution()` — spawns Claude Code CLI, stream-json parsing, `CLIExecution` lifecycle |
| `src/lib/claude-terminal/session-manager.ts` | In-memory session store (`createSession`, `updateSession`, `deleteSession`) |
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
  
  After the rules block, three knowledge injections fire unconditionally (when non-empty):
  - `formatGotchas(promptKind)` — UE C++ pitfall list from `src/lib/knowledge/ue-gotchas.ts`
  - `formatBinaryContentTripwire(promptKind)` — binary-file guard
  - `formatKnownAssets(domains)` — domain-scoped asset inventory

- **`nextjs` / `generic`**: Routes to `buildWebAppContextHeader()` which emits
  framework, database, and API route / MCP tool instructions instead.

The function also exports helpers consumed by `buildTaskPrompt`:
- `getModuleDomainContext(moduleId)` — looks up a 19-entry `DOMAIN_CONTEXT` map
  keyed by `SubModuleId` (content, game-systems, and core-engine aRPG sub-modules).
  (`prompt-context.ts:153`)

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
plus a one-line `summarizeAudit()` summary. The Ability Forge's **Prompt
Inspector** panel uses both to render audit chips (green = present, amber = missing
required, neutral zinc = missing optional) over the composed prompt's CodeBlock.

The Asset Specification section (3.5) serialises a catalog entity's identity and
typed `data` payload as a JSON block. The Wiring Requirements section (3.6) always
emits granting / activation / dependency / verification sub-prompts and a `wiring`
output-field instruction; known hints render as a table when `reqs` is non-empty.

#### Per-module builders (`src/lib/prompts/`)

Each builder is a single function that wires a domain-specific config into `PromptBuilder`:

- `buildAnimationChecklistPrompt(step, ctx)` — injects animation-specific `extraRules`,
  builds the task from `ChecklistStep.{number, title, description, details, prompt}`,
  then appends a raw best-practices block covering `NativeUpdateAnimation`, montage
  delegates, Mixamo import, and UE 5.8 commandlet automation gotchas.
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
| `TaskFactory.generateGasEffects()` | `generate-gas-effects` | `ref`, `effects[]`, `tagRules[]`, `scalars`, `appOrigin` |

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

   The final `result` line is normalized through the pure `result-metrics.ts`
   (`extractResultMetrics`) so the run's token usage + dollar cost surface as clean
   camelCase regardless of CLI result shape. `useTaskQueue` forwards each result to its
   `onResult` callback; `CompactTerminal` persists it to `/api/cli-spend` (attributed to the
   session's module + `lastTaskType`) for the Evaluator → **Spend** dashboard and budget
   guard. See *state-and-persistence → `cli_spend`*.

6. **Terminal component** subscribes to `CLIExecutionEvent`s. When a `text` event
   arrives, it scans the accumulated output for the regex match. On a hit it calls
   `extractCallbackPayload(text)` → `{ callbackId, payload }`. (`cli-task.ts:108`)

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
stores the resolved `SkillId[]` on the session. The terminal prepends
`buildSkillsPrompt(session.skills)` before dispatching.

---

### 6. Catalog pipeline — `ArchetypeStep` and Project Canon (`ArchetypeStep.tsx:72`)

For catalog pipeline steps that use the generic archetype renderer, `CliProduce.buildPrompt`
is:

```ts
(dir) => {
  const canon = canonContextFor(canonRules, catalogId, ARCHETYPE_CANON[spec.archetype]);
  return [canon, `Produce ${spec.label} for ${entity.name}. ${dir}`].filter(Boolean).join('\n\n');
}
```

`canonContextFor` injects Project Canon rules (filtered to the archetype's relevant
`RuleCategory[]` — e.g. `brief → ['game']`, `schema → ['project', 'game']`) as a
structured prefix before the user's free-text direction. This is the catalog
pipeline's equivalent of the module system's `buildProjectContextHeader`.

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
