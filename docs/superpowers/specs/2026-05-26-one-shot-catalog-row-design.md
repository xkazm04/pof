# One-Shot Catalog Row — Design

**Date:** 2026-05-26
**Status:** Design approved; ready for writing-plans.
**Scope:** A new authoring mode that, on demand, runs a gap-analysis over a catalog, proposes a new entity with rationale, lets the user refine it conversationally, then autonomously drives the new entity through its pipeline — skipping steps that need a human (art/3D selection) and honestly deferring runtime/visual gates to the existing test-gate runner. Lives in the `/layout` shell, alongside the step-by-step pipeline it complements.

## Goal

Turn the per-step pipeline experience into a one-click authoring loop for **all 30 catalogs**: state → proposal → refinement → autonomous run → completion notification — without giving up the chassis's correctness guarantees (canon-driven content, schema-down validation, honest acceptance ladder).

## Locked decisions

| | Decision | Why |
|--|----------|-----|
| Failure policy | **Continue + summarize at the end** | Partial config-complete is still progress; matches the user's "X of N succeeded" framing. |
| CLI cadence | **Smart hybrid** — real CLI for the *gap-analysis/design-proposal* turn and for prose/balance-bearing per-step archetypes (`brief`, `graph`, prose-style `rules`); deterministic `spec.produce(entity)` for structural/derived archetypes (`schema`, `balance`, `checklist`, `manifest`, table-style `rules`). | Meaningful generation where it matters, fast everywhere else. |
| Concurrency | **Single in-flight** | Simpler state machine; predictable resource use; user is interactive during the design phase anyway. |
| Architecture | **Approach A — client-state orchestrator + server step-dispatch** | Reuses every browser primitive (event bus, Sonner, labPipelineStore). Migration to server-owned + SSE is a clean follow-up. |
| Entity lifecycle | **Zustand + localStorage draft entities**, surfaced in `CatalogTree` alongside seeded ones with a distinct lifecycle dot | No DB churn, ~2h wiring. |
| Scope | **All 30 catalogs at v1** | The chassis is uniform; one generic engine covers everything via per-catalog plugins (gap analysis + prompt context). |

## Architecture

```
┌────────────────────────── Browser ──────────────────────────────────┐
│                                                                       │
│  /layout                                                              │
│   ├─ Header                                                           │
│   │   └─ <LabJobsChip>  ◄── subscribes to oneshot.* events            │
│   ├─ Baseline (left tree | pipeline | canvas)                         │
│   │   └─ CatalogTree shows draft entities alongside seeded            │
│   └─ <OneShotPanel>  ── opened from a header "+ One-shot" button       │
│        ├─ ① Gap analysis (live counts + distribution per catalog)     │
│        ├─ ② Design proposal (markdown + rationale, conversational)    │
│        └─ ③ "Run pipeline" → starts the orchestrator                  │
│                                                                       │
│  Stores (Zustand)                                                     │
│   • catalogStore.draftEntitiesByCatalog     (extended — drafts)        │
│   • oneShotJobStore                          (NEW — job state machine) │
│   • oneShotLabStore                          (NEW — toast→shell seam)  │
│   • labPipelineStore                         (existing — artifacts)    │
│   • canonStore                               (existing — project laws) │
│                                                                       │
│  Lib                                                                  │
│   • catalog/gap-analysis/  per-catalog distribution extractors         │
│   • one-shot/orchestrator.ts  state machine; emits oneshot.* events    │
│   • one-shot/skip-policy.ts   archetype × accept-tier → run/skip/defer │
│   • one-shot/design-prompts.ts gap+proposal+refine prompts             │
│   • one-shot/validate-proposal.ts schema + link-resolution + bands     │
│                                                                       │
└────────────────────── HTTP ────────────────────────────────────────────┘
                          │
┌────────────────────── Next.js server ─────────────────────────────────┐
│  Routes                                                               │
│   • POST /api/one-shot/analyze   ← runs gap-analysis (deterministic)   │
│   • POST /api/one-shot/propose   ← runs design-proposal CLI            │
│   • POST /api/one-shot/refine    ← refinement turn (user input)        │
│   • POST /api/one-shot/step      ← runs ONE step (deterministic or CLI)│
│   • GET  /api/one-shot/status/:executionId  ← CLI step progress        │
│                                                                       │
│  Existing primitives reused unchanged                                 │
│   • cli-service.startExecution() — server spawn of claude.cmd          │
│   • buildTaskPrompt() + @@CALLBACK — pure, callable from a route       │
│   • upsertArtifact() — same write-back the existing drain uses         │
│   • runStaticChecks(), acceptance/* — derived verdicts                 │
└────────────────────────────────────────────────────────────────────────┘
                          │
┌────────── SQLite (~/.pof/pof.db) ────────────────────────────────────┐
│   pipeline_artifacts (existing) — drafts use entityId = "draft-…"     │
│   project_rules, headless_builds, visual_verifications (existing)     │
└────────────────────────────────────────────────────────────────────────┘
```

### Component contracts

```ts
// src/lib/catalog/gap-analysis/index.ts
export interface Histogram { [value: string]: number }
export interface CatalogDistribution {
  catalogId: string;
  total: number;
  byAttribute: Record<string, Histogram>;
  underrepresented: Array<{ attribute: string; value: string; count: number; expected: number }>;
  sample: StoredCatalogEntity[];                       // stratified sample of ~5 for the proposal prompt
}
export function analyzeCatalog(catalogId: string, entities: StoredCatalogEntity[]): CatalogDistribution;
// Generic core: aggregateByAttr(entities, path). Per-catalog plugin picks the dimensions
// from the cheat-sheet (items→rarity+type+subtype; bestiary→tier+role+category; spellbook→tier+element+category; …).

// src/lib/one-shot/orchestrator.ts
export type OneShotPhase =
  | 'idle' | 'analyzing' | 'proposing' | 'refining' | 'awaitingRun'
  | 'running' | 'completed' | 'failed';
export interface OneShotOrchestrator {
  start(catalogId: string, userHint?: string): Promise<void>;
  refine(userInput: string, forceMore?: boolean): Promise<void>;
  approveAndRun(): Promise<void>;
  cancel(): void;
}
// Pure logic. Talks to the server via fetch; emits via eventBus.

// src/stores/oneShotJobStore.ts (Zustand, persisted)
interface OneShotJobState {
  phase: OneShotPhase;
  catalogId: string | null;
  draftEntityId: string | null;
  proposal: { name: string; data: unknown; rationale: string } | null;
  refinementTurns: number;
  currentStepIndex: number;
  stepResults: Array<{ step: string; outcome: 'pass'|'fail'|'skipped'|'deferred'; reason?: string }>;
  lastSummary: { ran: number; passed: number; failed: number; skipped: number; deferred: number } | null;
}
// Single-in-flight guard: start/approveAndRun/refine throw if phase ∉ {idle, completed, failed}.

// src/stores/oneShotLabStore.ts
interface OneShotLabState {
  pendingNavigation: { catalogId: string; entityId: string } | null;
  panelOpen: boolean;
  setPendingNavigation(v: { catalogId: string; entityId: string } | null): void;
  setPanelOpen(v: boolean): void;
}

// src/components/layout-lab/one-shot/OneShotPanel.tsx
// Three-section panel: ① distribution view, ② proposal markdown + refine textarea,
// ③ live step log. Subscribes to oneShotJobStore + the oneshot.* event channels.

// src/components/layout-lab/LabJobsChip.tsx
// Header chip; subscribes to oneshot.*; renders progress per phase (see UI table).
// Click opens OneShotPanel via oneShotLabStore.setPanelOpen(true).
```

## Data flow (happy path)

```
User clicks "+ One-shot" in header
       │
       ▼  orchestrator.start(catalogId, userHint?)  ─── phase: 'analyzing'
POST /api/one-shot/analyze {catalogId, userHint?}
   ↳ server: read entitiesByCatalog + draftEntitiesByCatalog (+ recent pipeline_artifacts);
     call gap-analysis.analyzeCatalog(); return CatalogDistribution.
       │
       ▼  phase: 'proposing'
POST /api/one-shot/propose {catalogId, distribution, userHint?}
   ↳ server: spawn CLI w/ design-proposal prompt (per-catalog template + canon + ARPG-LAWS
     + distribution snapshot). @@CALLBACK returns {name, data: <typed per catalog>, rationale: markdown}.
   ↳ validateProposal() runs: schema, real-seeded-link-ids, in-band numerics.
   ↳ on validation issues → emit them; phase stays 'proposing' (user refines).
       │
       ▼  phase: 'refining' (loop, bounded turns ≤3, override-able)
   user input → POST /api/one-shot/refine {priorProposal, userInput}  →  updated proposal → validate
       │
       ▼  user clicks "Run pipeline"  ─── phase: 'awaitingRun' → 'running'
catalogStore.addDraft(catalogId, {
  id: `draft-<catalogId>-<ts>`,
  catalogId, name, categoryPath, tags: ['one-shot'],
  lifecycle: 'planned',
  data: proposal.data,
})
   ↳ Appears in CatalogTree immediately (lifecycle dot uses an "in-progress" tint).
emit('oneshot.started', { jobId, totalSteps, catalogId, entityId })
   │
   ▼  for each step in getCatalogPipeline(catalogId).steps:
      const decision = skipPolicy.decide(step.archetype, step.accept, step.view);
      switch (decision.mode) {
        case 'run-deterministic':
          POST /api/one-shot/step?mode=deterministic
          ↳ server: spec.produce(entity) → upsertArtifact with accept-derived status/tier.
        case 'run-cli':
          POST /api/one-shot/step?mode=cli
          ↳ server: buildTaskPrompt(<chassis per-step prompt>) + cli-service.startExecution()
            + @@CALLBACK persists; returns executionId.
          ↳ orchestrator polls /api/one-shot/status/:executionId until terminal or timeout (5 min).
        case 'skip-needs-art':       // L1 gallery
          upsertArtifact({ status:'pending', tier:'L1', reason:'needs human selection (one-shot)' });
        case 'defer-runtime':        // L3/L4
          upsertArtifact({ status:'deferred', tier:'L3'|'L4', reason: <from runtimeDeferred/visualDeferred> });
      }
      emit('oneshot.step-completed', { jobId, stepIndex, totalSteps, outcome });
       │
       ▼  phase: 'completed'  (regardless of fails — continue-and-summarize)
emit('oneshot.completed', { jobId, ran, passed, failed, skipped, deferred, catalogId, entityId })
   ↳ Sonner: toast.success("8 passed · 2 skipped · 3 deferred · 0 failed",
                            { onClick: () => oneShotLabStore.setPendingNavigation({catalogId, entityId}) })
LayoutLab's effect on pendingNav → setCatalogId(catalogId) + lifted setEntityId(entityId)
   ↳ User lands on the new draft entity; pipeline is pre-filled; remaining gates are honest defers.
```

## Per-archetype × per-tier skip policy

### Archetype lane (the "how to run")

| Archetype | Default mode | Why | Notes |
|-----------|--------------|-----|-------|
| `brief` | **run-cli** | Prose generation; deterministic stubs are shallow. | Reuses the chassis's per-step `buildPrompt`. |
| `graph` | **run-cli** | Node/edge composition w/ reachability + ≥1 terminal needs creative judgment. | The CLI is told "obey `graphValid` constraints"; output is structured node/edge JSON. |
| `rules` | **run-cli** if `view.kind === 'prose'`; else **run-deterministic** | Narrative rules → CLI; table-style rules → derivable. | StepSpec already declares view kind. |
| `schema` | **run-deterministic** | Structured fields inferable from the approved design. | `spec.produce(entity)` reads from `entity.data`. |
| `balance` | **run-deterministic** | Numerics computed from design + envelopes. | Already deterministic in items reference. |
| `checklist` | **run-deterministic** | Structured checks; canon + design fill them. | Localization / Accessibility / Telemetry. |
| `manifest` | **run-deterministic** | UE asset names derive from `proj-naming` + design + linked rows. | UE Packaging on every row. |
| `gallery` | **skip-needs-art** | L1 — human picks an asset. | Always skipped in one-shot; counts toward `skipped`. |
| `custom` | per-StepSpec extension (`autoMode?: 'cli'\|'deterministic'\|'skip'`) | Row author's call. | Default if unset: `'deterministic'`. |

### Tier lane (the "what does the verdict look like")

| Tier | Behaviour |
|------|-----------|
| **L0** (`minLength`/`fieldsPopulated`/`withinPercent`/`minCount`/`graphValid`) | Orchestrator validates `accept(data)` after produce. Pass/fail recorded; failure → continue + summarize. |
| **L1** (`selected` — gallery) | Always **skip-with-marker**. Counts as `skipped`, not `failed`. |
| **L2** (`cppSymbolExists`/`seedRowPresent`) | Run the static check; missing symbol/seed → `deferred` (existing chassis behavior). Counts as `deferred`. |
| **L3** (`runtimeDeferred`) | **Defer** — the existing test-gate runner picks it up. Counted as `deferred`. |
| **L4** (`visualDeferred`) | **Defer** — same. Counted as `deferred`. |

### Composed decision (`skipPolicy.decide`)

```ts
function decide(archetype: Archetype, accept: AcceptanceTier, view: ViewDescriptor): Decision {
  if (archetype === 'gallery')             return { mode: 'skip-needs-art' };
  if (accept === 'L3')                     return { mode: 'defer-runtime', tier: 'L3' };
  if (accept === 'L4')                     return { mode: 'defer-runtime', tier: 'L4' };
  if (archetype === 'brief')               return { mode: 'run-cli' };
  if (archetype === 'graph')               return { mode: 'run-cli' };
  if (archetype === 'rules' && view.kind === 'prose')  return { mode: 'run-cli' };
  if (archetype === 'custom' && spec.autoMode) return mapCustom(spec.autoMode);
  return { mode: 'run-deterministic' };
}
```

A typical Items one-shot (13 steps): Concept Brief (CLI), Attributes (det), Economy (det), Affixes (CLI/rules-prose), Icon 2D Art (**skip-L1**), Anim/Audio (det checklist), Wiring (det), Test Gate (**defer-L3**), UE Packaging (det manifest), Localization (det checklist), Cross-links (det). Expected outcome: ~8 pass · 1 skipped · 1 deferred · failure on any step is recorded but doesn't halt.

## Prompts

### (A) Design-proposal prompt — ONE template, parameterized per catalog

Lives in `src/lib/one-shot/design-prompts.ts`. Pure function `buildProposalPrompt(catalogId, distribution, userHint?)`. Parameter sources:

- **Canon** → `canonContextFor(rules, catalogId, ['game','project','art'])` (existing utility).
- **ARPG-LAWS sections** → `arpgLawsRelevantTo(catalogId)`: a small mapping `Record<catalogId, ArpgLawSection[]>` (items→§1+§2; bestiary→§4+§6; abilities→§3; loot-tables→§7; …).
- **Distribution** → `analyzeCatalog(catalogId, entities)` output, rendered as a histogram block + under-rep table.
- **Sample** → 5 stratified existing entities with their `data` summarized via `summarize(e.data)` (catalog-specific summarizer in the gap-analysis plugin).
- **Schema** → `dataSchemaFor(catalogId)`: the typed-payload shape from the cheat-sheet, rendered as a JSON schema fragment (`items`: `{ type, subtype, rarity, level, stats[], affixes[] }`; etc.).

Skeleton:

```
# DESIGN PROPOSAL — <Catalog Label>

## Project Canon
<canon block>

## Relevant ARPG laws
<sections>

## Catalog state (auto-computed)
- Total entities: {{total}}
- Distribution: {{histograms}}
- Under-represented niches: {{gaps}}

## Existing entities (sample of 5)
{{sample}}

## User direction (optional)
{{userHint || "designer's call — pick the highest-value gap"}}

## Per-catalog output schema
{{dataSchemaFor(catalogId)}}

## Task
Identify the most valuable gap and propose ONE new entity that fills it.
HARD RULES:
1. Obey Project Canon + ARPG laws strictly. Numerics within the seeded min/max bands.
2. Cross-catalog references must use REAL seeded ids (sample shows real ids).
3. Non-derivative — not a near-clone of any sample entity.
4. The entity is a draft; do not invent UE assets, only their planned names per `proj-naming`.

## Output (BOTH required)
1. Rationale (markdown, ≤220 words).
2. Structured proposal via:
   @@CALLBACK:<id>
   { "name": "...", "data": { /* matches the per-catalog schema */ } }
   @@END_CALLBACK
```

### (B) Refinement prompt

Same skeleton, plus prior proposal + user input. Bounded to 3 turns (`oneShotJobStore.refinementTurns`), override via `forceMore: true` (UI button visible after turn 3).

### (C) Per-step prompts — zero new design

When `skipPolicy.decide` returns `run-cli`, the orchestrator instructs the server route to spawn the CLI using the **existing StepSpec's `buildPrompt(direction, entity)`** (the same one `ArchetypeStep` injects canon into). Passed `direction`: `"derive from approved design; minimal commentary."` This is the chassis's gift — the autonomous path reuses every per-step prompt the manual path uses; canon, schema, @@CALLBACK persistence — all identical.

## UI: header chip, completion toast, navigation seam

### Header layout

```
LayoutLab header (existing)
┌───────────────────────────────────────────────────────────────────────────────┐
│ /layout · Blueprint baseline   [Catalogs] [Canon]   [Light] [Studio Dark]     │
│                                  [Legacy shell]  [+ One-shot]  [Jobs · 8/13 ▸] │
│                                                   ▲              ▲ ▲          │
│                                                   │              │ └─ LabJobsChip
│                                                   │              └─── LabBridgeStrip (existing)
│                                                   └────────────────── opens OneShotPanel
└───────────────────────────────────────────────────────────────────────────────┘
```

### Chip states

| Phase | Chip content | Click |
|-------|-------------|-------|
| `idle` | hidden (the `+ One-shot` button is the entry) | — |
| `analyzing` | `Jobs · <catalog> · scanning…` | open panel |
| `proposing` | `Jobs · <catalog> · drafting…` | open panel |
| `refining` | `Jobs · <catalog> · refine ${turn}/3` | open panel |
| `running` | `Jobs · <catalog> · step ${i+1}/${n} · ${stepName}` | open panel |
| `completed` | `Jobs · <catalog> · ✓ ${pass}/${total}` for ~3 s, then auto-hides | open the new entity |

### Completion toast

```ts
eventBus.on('oneshot.completed', ({ payload }) => {
  const { passed, failed, skipped, deferred, catalogId, entityId, jobName } = payload;
  toast.success(
    `${jobName}: ${passed} passed · ${failed} failed · ${skipped} skipped · ${deferred} deferred`,
    {
      duration: 8000,
      onClick: () => oneShotLabStore.getState().setPendingNavigation({ catalogId, entityId }),
    },
  );
});
```

### Event-bus namespace (new)

```ts
// src/types/event-bus.ts
export interface OneShotJobEvents {
  'oneshot.started':         { jobId, jobName, totalSteps, catalogId, entityId };
  'oneshot.step-completed':  { jobId, stepIndex, totalSteps, stepName, outcome: 'pass'|'fail'|'skipped'|'deferred', reason?: string };
  'oneshot.completed':       { jobId, jobName, totalSteps, ran, passed, failed, skipped, deferred, catalogId, entityId };
  'oneshot.failed':          { jobId, jobName, stepIndex, totalSteps, error };
}
export interface EventMap extends /* … existing namespaces … */ OneShotJobEvents {}
```

### Navigation seam — the only structural refactor required

`entityId` is currently local state in `Baseline.tsx:37`. To let a toast handler drive it:

1. Add `src/stores/oneShotLabStore.ts` (Zustand, ~30 LOC) holding `pendingNavigation` and `panelOpen`.
2. `LayoutLab.tsx`: keep `catalogId` local; **lift `entityId` here** (still local to LayoutLab); pass `onSelectEntity={setEntityId}` down to `Baseline`. Add a `useEffect` on `pendingNavigation` → apply + clear.
3. `Baseline.tsx`: drop the local `useState` for `entityId`; receive via props.

That is the **entire** structural delta: one new chip, one new tiny store, one prop-lift in `LayoutLab`/`Baseline`, plus the new event-bus namespace.

### Cancellation

The chip shows a hover `×` during `analyzing/proposing/refining/running` → calls `orchestrator.cancel()` → state machine transitions to `failed` with `reason: 'cancelled'`; in-flight CLI execution gets a best-effort `kill` via `cli-service.activeExecutions`. The single-in-flight lock releases.

## Error handling

| Failure | Detection | Handling |
|---------|-----------|----------|
| **Malformed CLI output** (no @@CALLBACK / unparsable JSON) | `resolveCallback` JSON.parse throws, or no marker before timeout | Step recorded `failed` w/ raw output snippet in `reason`; orchestrator continues (per failure policy). |
| **Schema-down validation fail on proposal** (link to non-existent seeded id, numeric outside the entities' min/max band, missing required field) | `validateProposal(catalogId, proposal)` against the per-catalog schema + `linkTargetsExist` against the current seed | Stay in `phase: 'proposing'`; surface issues inline in the refinement view ("3 issues — fix in your next message, or **override**"). Override flag recorded on the draft entity. |
| **Mid-step CLI hang** | Per-step max-wait timeout (default 5 min, configurable) on the orchestrator's poll loop against `/api/one-shot/status/:executionId` | Mark step `failed` reason `timeout`; emit a best-effort `cli-service.kill(executionId)`; continue. |
| **Mid-step server error** | `POST /api/one-shot/step` returns non-ok envelope or 5xx | Step marked `failed`; one auto-retry; continue. |
| **User cancellation** | `oneShotJobStore.cancel()` → `orchestrator.cancel()` | Phase → `failed`, reason `cancelled`; best-effort `cli-service.kill` for any in-flight execution; partial draft preserved. |
| **Page reload / browser refresh mid-run** | On rehydrate, `oneShotJobStore.phase === 'running'` is detected | Transition to `failed`, reason `reload-interrupted`; draft entity stays in the tree with whatever steps had already persisted; show a one-time toast "your previous one-shot was interrupted." (v1 has no resume — a follow-up.) |
| **Server restart during a CLI step** | In-flight `executionId` never resolves | The 5-min timeout above triggers; same handling. |

**Honest deferral, not silent failure.** L3/L4 step defers are NOT errors — the completion summary counts them separately (`deferred`), and the toast says `8 passed · 0 failed · 2 skipped · 3 deferred` so deferrals don't masquerade as success.

**Draft cleanup.** Drafts are first-class entries with `lifecycle: 'planned'` and a `oneShotJobId` tag; a small "× discard" button on the entity row calls `catalogStore.removeDraft(catalogId, entityId)`.

## Testing

**Unit (mocked DB/network):**

| Test file | Covers |
|-----------|--------|
| `gap-analysis/__tests__/analyze.test.ts` | `analyzeCatalog` over seeded fixtures for each of the 30 catalogs. ~30 tests. |
| `one-shot/__tests__/skip-policy.test.ts` | The 9-archetype × 4-tier decision matrix exhaustively. ~36 tests. |
| `one-shot/__tests__/orchestrator.test.ts` | Phase transitions; single-in-flight guard; refinement-turn bound + override; failure-policy math. ~15 tests. |
| `one-shot/__tests__/design-prompts.test.ts` | Prompt assembly for each catalog asserts canon, ARPG-LAWS sections, schema, distribution snapshot, hard-rules block, @@CALLBACK marker. ~30 tests. |
| `one-shot/__tests__/validate-proposal.test.ts` | Schema, link resolution, numeric bands, override acceptance. ~12 tests. |
| `stores/__tests__/oneShotJobStore.test.ts` | Persistence round-trip; rehydration of `phase: 'running'` → `failed/reload-interrupted`; cancel transitions; lock release. ~8 tests. |
| `stores/__tests__/oneShotLabStore.test.ts` | `pendingNavigation` set/clear; `panelOpen`. ~4 tests. |
| `stores/__tests__/catalogStore.draft.test.ts` | `addDraft` / `removeDraft` / `draftEntitiesByCatalog` merge in `useLabDetail`; lifecycle dot distinct. ~6 tests. |

**API routes (mocked CLI):**

| Route | Asserts |
|-------|---------|
| `POST /api/one-shot/analyze` | Right `CatalogDistribution` shape from in-memory entity fixtures. |
| `POST /api/one-shot/propose` | Mocks `cli-service.startExecution` to return markdown + JSON @@CALLBACK; route parses + returns the proposal. |
| `POST /api/one-shot/refine` | Same w/ prior-proposal injection. |
| `POST /api/one-shot/step` | `mode=deterministic` calls `spec.produce` + `upsertArtifact`; `mode=cli` spawns + returns executionId. |
| `GET /api/one-shot/status/:executionId` | Status passthrough from `cli-service.activeExecutions`. |

**Component (testing-library):**

| Test | Covers |
|------|--------|
| `LabJobsChip.test.tsx` | Subscribes to `oneshot.*`; right text per phase; cancel button calls `orchestrator.cancel`. |
| `OneShotPanel.test.tsx` | Three sections render correctly; refine textarea blocked > 3 turns unless `forceMore`. |
| `Baseline.draft-entity.test.tsx` | Draft entities surface in `CatalogTree` with the distinct lifecycle dot. |

**E2E (no live editor needed)** — `e2e/one-shot.test.ts`: with `cli-service` spawn mocked to scripted JSON, drive a full Items one-shot end-to-end and assert the draft entity exists in `catalogStore`, all artifacts are persisted in `pipeline_artifacts` with correct status/tier per step, the chip events fire in order, the toast fires with the right summary, the click-to-navigate seam works.

**Live verification (existing — no new surface)** — the L3/L4 test-gate runner drains the new draft entity's deferred Test Gate exactly as for seeded entities.

Total: ~12 new test files, ~150 tests.

## File manifest

### New files

```
src/lib/catalog/gap-analysis/
  index.ts                      analyzeCatalog + aggregateByAttr core
  plugins/items.ts              per-catalog dimension extractors + sampler + summarizer
  plugins/bestiary.ts
  plugins/<…all 30 catalogs>.ts
src/lib/one-shot/
  orchestrator.ts               state machine
  skip-policy.ts                archetype × tier × view → decision
  design-prompts.ts             buildProposalPrompt + buildRefinePrompt + helpers
  validate-proposal.ts          schema + link resolution + bands
  status-poller.ts              utility for the CLI-step poll loop
src/stores/
  oneShotJobStore.ts            Zustand, persisted
  oneShotLabStore.ts            Zustand, lightweight
src/app/api/one-shot/
  analyze/route.ts
  propose/route.ts
  refine/route.ts
  step/route.ts
  status/[executionId]/route.ts
src/components/layout-lab/
  LabJobsChip.tsx
  one-shot/OneShotPanel.tsx
  one-shot/DistributionView.tsx
  one-shot/ProposalView.tsx
  one-shot/RunLogView.tsx
src/__tests__/lib/catalog/gap-analysis/
src/__tests__/lib/one-shot/
src/__tests__/stores/oneShotJobStore.test.ts
src/__tests__/stores/oneShotLabStore.test.ts
src/__tests__/stores/catalogStore.draft.test.ts
src/__tests__/components/layout-lab/LabJobsChip.test.tsx
src/__tests__/components/layout-lab/OneShotPanel.test.tsx
src/__tests__/components/layout-lab/Baseline.draft-entity.test.tsx
src/__tests__/api/one-shot/<route>.test.ts        ×5
src/__tests__/e2e/one-shot.test.ts
```

### Touched files

```
src/stores/catalogStore.ts                  + draftEntitiesByCatalog + addDraft + removeDraft + merge
src/components/layout-lab/useLabCatalogData.ts  merge drafts in useLabDetail
src/components/layout-lab/CatalogTree.tsx   distinct lifecycle dot for drafts; × discard button
src/components/layout-lab/LayoutLab.tsx     + LabJobsChip + "+ One-shot" button; lift entityId; pendingNav effect
src/components/layout-lab/Baseline.tsx      receive entityId via prop (drop local useState)
src/types/event-bus.ts                      + OneShotJobEvents
docs/README.md + docs/architecture/ui-shell.md   mention the one-shot mode + the chip
```

## Out of scope / follow-ups

- **Resume after reload.** v1 marks an interrupted run as `failed/reload-interrupted`. A resume path would re-poll `executionId`s and continue from `currentStepIndex`; the persistence is already there, only the rehydrate-recovery code is missing.
- **Multi-job concurrency.** v1 enforces single-in-flight. Lifting to N-parallel requires a `oneShotJobStore.jobs: Map<jobId, JobState>` + per-job state machines; the event-bus shape already supports `jobId`.
- **Server-owned jobs + SSE.** When we need overnight runs or cross-tab survival, migrate the orchestrator from client to a Next route + an `one_shot_jobs` SQLite table + SSE to the chip. The state machine is well-bounded, so the lift is mechanical.
- **Auto-launch the L3/L4 runner on completion.** Currently the runner is operator-triggered. Optional follow-up: the one-shot's completion toast could also kick the drain endpoint for the new draft entity, so by the time the user clicks the toast, even L3 is resolved.
- **Per-catalog prompt tuning.** v1 ships one generic template + per-catalog plugins. As we observe real proposals we may add per-catalog refinements (e.g. items wants more affix guidance; bestiary wants more ability-set guidance). The template structure makes this additive.

## How it composes with what we already shipped

- The chassis (StepSpec + acceptance + canon) provides the substrate.
- The quality gate stays in force — proposals still respect canon + ARPG-LAWS; the validator catches the schema-down defect class (real seeded link ids, in-band numerics) at design time.
- The test-gate runner drains the L3/L4 gates on the new draft entity exactly as it does for seeded entities — no new live-verification surface.
- The header is the only spot in the shell that gains a new affordance; the rest of `/layout` is unchanged.
