# Catalog Pipeline Chassis + Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared "chassis" (server-persisted per-step artifacts, a tiered acceptance engine, data-driven archetype rendering, self-registration, and a tier roll-up) so that 30 catalog pipelines can later be mass-produced as *spec files* rather than hand-built, then prove it end-to-end on one logic pilot row.

**Architecture:** SQLite (`~/.pof/pof.db`) is the authoring/pipeline system-of-record; the UE project is the realized engine truth (schema-down / content-up). Each pipeline step is `View / Produce / Acceptance` driven by a `StepSpec`. Acceptance is **derived** on a 4-tier ladder (L0 data → L1 human-selection → L2 static codebase analysis → L3 runtime → L4 visual) with a `deferred` status; the parallel-dev "done" bar is **config-complete (L0–L2)**. Hybrid rendering: common archetypes use a generic `ArchetypeStep` renderer driven by the spec's `view` descriptor; complex ones may register a bespoke component. The live-UE lease + L3/L4 runner is a **separate later plan** — this chassis only records L3/L4 as `deferred`.

**Tech Stack:** Next.js 16 App Router, React 19, Zustand v5, better-sqlite3, Vitest, TypeScript (strict). Path alias `@/` → `src/`. Theme tokens via `LabTheme` (lab) / chart-colors (app). Logger from `@/lib/logger`. API envelope via `apiSuccess`/`apiError` + `apiFetch`/`tryApiFetch`.

**Reference docs (read before starting):**
- `docs/catalog/WIRING-AND-ACCEPTANCE.md` — the locked data contract + acceptance tiers + parallel model.
- `docs/catalog/PIPELINE_REVIEW.md` — the ~22 archetype library + per-row remap.
- `.claude/CLAUDE.md` → *Catalog Pipeline Step Authoring* — the 4 coding rules + shared-component manifest.
- Existing mirrors: `src/lib/catalog-db.ts`, `src/app/api/catalog/route.ts`, `src/__tests__/lib/pipeline-db.test.ts`.

**Conventions every task follows:** ≤200 LOC/file; `@/` imports; no raw `console`; tests in `src/__tests__/` mirroring source path; DB unit tests cover the **pure mapper + validation** only (never touch the real `~/.pof/pof.db`); commit after each task with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. App repo: commit locally only (no push). Exclude the 3 pre-existing `AssetInspector.tsx` tsc errors from gates (`| grep -v AssetInspector`).

---

## File Structure

**Acceptance engine** (pure + UE-static; the long pole, built first):
- `src/lib/catalog/acceptance/types.ts` — `AcceptanceTier`, `AcceptanceStatus`, `AcceptanceResult`, `Checker`.
- `src/lib/catalog/acceptance/dataCheckers.ts` — L0 pure checkers (minLength, fieldsPopulated, withinPercent, selected, minCount).
- `src/lib/catalog/acceptance/ueStaticCheckers.ts` — L2 codebase-analysis checkers (cppSymbolExists, seedRowPresent, assetPathDeclared) + `resolveUeRoot()`.
- `src/lib/catalog/acceptance/deferred.ts` — L3/L4 `runtimeDeferred` / `visualDeferred`.

**Artifact persistence:**
- `src/lib/pipeline-artifacts-db.ts` — `pipeline_artifacts` table + `rowToArtifact` + list/get/upsert.
- `src/lib/catalog/artifact-validation.ts` — Zod schema for the upsert payload.
- `src/app/api/pipeline-artifacts/route.ts` — GET (list by catalog/entity) + POST (upsert).
- `src/lib/catalog/artifact-client.ts` — client read/write via `apiFetch`/`tryApiFetch`.

**Spec contract + rendering (Hybrid):**
- `src/lib/catalog/stepSpec.ts` — `StepSpec`, `ViewDescriptor`, `ArchetypeId`, `CatalogPipeline`.
- `src/components/layout-lab/steps/ArchetypeStep.tsx` — generic renderer (prose/table/gallery/checklist/manifest views) + Produce via `CliProduce` + Acceptance via `StepFrame`.
- `src/components/layout-lab/steps/StepFrame.tsx` — MODIFY: extend `Acceptance` with `tier?` + add `'deferred'` status.

**Self-registration + tooling:**
- `src/lib/catalog/pipeline-registry.ts` — `registerCatalogPipeline` / `getCatalogPipeline`.
- `src/lib/catalog/pipelines/<catalogId>.ts` — one self-registering spec file per catalog (rows drop these; no central edit).
- `src/lib/catalog/pipelines/registry.generated.ts` — codegen barrel (import side-effects).
- `scripts/gen-pipeline-registry.mjs` — globs `pipelines/*.ts` → writes the barrel.
- `scripts/scoped-check.mjs` — per-CLI typecheck/lint/test scoped to changed files + contracts.

**Roll-up + schema snapshot:**
- `src/components/layout-lab/PipelineRollup.tsx` — per-row/step tier+status grid (stub-vs-real visibility).
- `scripts/snapshot-ue-schema.mjs` — parse UE `F*Row` structs → `src/lib/catalog/ue-schema.generated.json`.

**Tests:** mirror each under `src/__tests__/...`.

---

## Task 1: Acceptance types + L0 data checkers

**Files:**
- Create: `src/lib/catalog/acceptance/types.ts`
- Create: `src/lib/catalog/acceptance/dataCheckers.ts`
- Test: `src/__tests__/lib/catalog/acceptance/dataCheckers.test.ts`

- [ ] **Step 1: Write the types**

`src/lib/catalog/acceptance/types.ts`:
```typescript
/** The acceptance ladder. Higher tiers prove more (data → render). */
export type AcceptanceTier = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
export type AcceptanceStatus = 'pass' | 'pending' | 'fail' | 'deferred';

export interface AcceptanceResult {
  label: string;
  status: AcceptanceStatus;
  tier: AcceptanceTier;
  detail: string;
  /** Why it failed or was deferred (Rule 4 — never fail/skip silently). */
  reason?: string;
}

/** A checker reads a step's produced data (+ optional context) and derives a result. */
export type Checker = (data: Record<string, unknown>) => AcceptanceResult;
```

- [ ] **Step 2: Write the failing test**

`src/__tests__/lib/catalog/acceptance/dataCheckers.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '@/lib/catalog/acceptance/dataCheckers';

describe('L0 data checkers', () => {
  it('minLength passes at/above threshold, pending below', () => {
    const c = minLength('brief', 'Brief ≥ 300 chars', 300);
    expect(c({ brief: 'x'.repeat(300) }).status).toBe('pass');
    expect(c({ brief: 'short' }).status).toBe('pending');
    expect(c({ brief: 'x'.repeat(300) }).tier).toBe('L0');
  });
  it('fieldsPopulated requires every key present', () => {
    const c = fieldsPopulated('stats', 'All stats', ['Damage', 'Weight']);
    expect(c({ stats: { Damage: 1, Weight: 2 } }).status).toBe('pass');
    expect(c({ stats: { Damage: 1 } }).status).toBe('pending');
  });
  it('withinPercent fails outside the band', () => {
    const c = withinPercent('power', 'Power ±10%', 100, 10);
    expect(c({ power: 105 }).status).toBe('pass');
    expect(c({ power: 130 }).status).toBe('fail');
    expect(c({}).status).toBe('pending');
  });
  it('selected passes when an index ≥ 0 is chosen', () => {
    const c = selected('selected', 'Icon selected');
    expect(c({ selected: 0 }).status).toBe('pass');
    expect(c({ selected: -1 }).status).toBe('pending');
    expect(c({}).status).toBe('pending');
  });
  it('minCount counts array length', () => {
    const c = minCount('cues', 'Cues', 3);
    expect(c({ cues: [1, 2, 3] }).status).toBe('pass');
    expect(c({ cues: [1] }).status).toBe('pending');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/acceptance/dataCheckers.test.ts`
Expected: FAIL — "Failed to resolve import .../dataCheckers".

- [ ] **Step 4: Implement the checkers**

`src/lib/catalog/acceptance/dataCheckers.ts`:
```typescript
import type { Checker } from './types';

export function minLength(field: string, label: string, n: number): Checker {
  return (data) => {
    const len = String(data[field] ?? '').length;
    return { label, tier: 'L0', status: len >= n ? 'pass' : 'pending', detail: `${len} / ${n} chars` };
  };
}

export function fieldsPopulated(field: string, label: string, keys: string[]): Checker {
  return (data) => {
    const obj = (data[field] ?? {}) as Record<string, unknown>;
    const have = keys.filter((k) => obj[k] != null).length;
    return { label, tier: 'L0', status: have === keys.length ? 'pass' : 'pending', detail: `${have} / ${keys.length} populated` };
  };
}

export function withinPercent(field: string, label: string, target: number, pct: number): Checker {
  return (data) => {
    const v = data[field];
    if (v == null) return { label, tier: 'L0', status: 'pending', detail: 'not set' };
    const n = Number(v);
    const ok = n >= target * (1 - pct / 100) && n <= target * (1 + pct / 100);
    return { label, tier: 'L0', status: ok ? 'pass' : 'fail', detail: `${n} vs ${target} ±${pct}%`, ...(ok ? {} : { reason: `${n} is outside ±${pct}% of ${target}` }) };
  };
}

export function selected(field: string, label: string): Checker {
  return (data) => {
    const v = data[field];
    const ok = typeof v === 'number' && v >= 0;
    return { label, tier: 'L0', status: ok ? 'pass' : 'pending', detail: ok ? `candidate ${v}` : 'none selected' };
  };
}

export function minCount(field: string, label: string, n: number): Checker {
  return (data) => {
    const arr = Array.isArray(data[field]) ? (data[field] as unknown[]) : [];
    return { label, tier: 'L0', status: arr.length >= n ? 'pass' : 'pending', detail: `${arr.length} / ${n}` };
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/acceptance/dataCheckers.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalog/acceptance/types.ts src/lib/catalog/acceptance/dataCheckers.ts src/__tests__/lib/catalog/acceptance/dataCheckers.test.ts
git commit -m "feat(catalog): acceptance types + L0 data checkers"
```

---

## Task 2: L2 static (UE codebase-analysis) checkers

**Files:**
- Create: `src/lib/catalog/acceptance/ueStaticCheckers.ts`
- Test: `src/__tests__/lib/catalog/acceptance/ueStaticCheckers.test.ts`
- Test fixture: `src/__tests__/fixtures/ue/Source/PoF/Sample.h`, `src/__tests__/fixtures/ue/Content/Python/seed_sample.py`

**Context:** L2 proves a claimed C++ symbol / seed-row / asset path **exists in the UE source tree** without running the editor — read-only and parallel-safe. The UE root is configurable; default from env `POF_UE_ROOT`, fall back to the known path. Tests point at a fixture tree.

- [ ] **Step 1: Create the fixtures**

`src/__tests__/fixtures/ue/Source/PoF/Sample.h`:
```cpp
UCLASS()
class POF_API UGE_Gen_Sample : public UGameplayEffect { GENERATED_BODY() };
```

`src/__tests__/fixtures/ue/Content/Python/seed_sample.py`:
```python
CATALOG = [
    ("sample_row", "Sample Row", "magical"),
]
```

- [ ] **Step 2: Write the failing test**

`src/__tests__/lib/catalog/acceptance/ueStaticCheckers.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { cppSymbolExists, seedRowPresent } from '@/lib/catalog/acceptance/ueStaticCheckers';

const UE_ROOT = join(process.cwd(), 'src/__tests__/fixtures/ue');

describe('L2 UE static checkers', () => {
  it('cppSymbolExists passes when the class is declared in Source', () => {
    const r = cppSymbolExists('UGE_Gen_Sample', 'Sample GE compiled')(UE_ROOT);
    expect(r.status).toBe('pass');
    expect(r.tier).toBe('L2');
  });
  it('cppSymbolExists defers (not fail) when missing — could be generated later', () => {
    const r = cppSymbolExists('UGE_Gen_Missing', 'Missing GE')(UE_ROOT);
    expect(r.status).toBe('deferred');
    expect(r.reason).toContain('not found');
  });
  it('seedRowPresent finds a row name in a seed script', () => {
    expect(seedRowPresent('seed_sample.py', 'sample_row', 'Row seeded')(UE_ROOT).status).toBe('pass');
    expect(seedRowPresent('seed_sample.py', 'ghost_row', 'Row seeded')(UE_ROOT).status).toBe('deferred');
  });
  it('returns deferred when the UE root does not exist', () => {
    const r = cppSymbolExists('UAnything', 'x')('/no/such/root');
    expect(r.status).toBe('deferred');
    expect(r.reason).toContain('UE root');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/acceptance/ueStaticCheckers.test.ts`
Expected: FAIL — import unresolved.

- [ ] **Step 4: Implement**

`src/lib/catalog/acceptance/ueStaticCheckers.ts`:
```typescript
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { AcceptanceResult } from './types';

/** A UE-static checker is parameterised, then takes the UE project root. */
export type UeChecker = (ueRoot: string | null) => AcceptanceResult;

export function resolveUeRoot(): string | null {
  const env = process.env.POF_UE_ROOT;
  if (env && existsSync(env)) return env;
  const fallback = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
  return existsSync(fallback) ? fallback : null;
}

function walk(dir: string, ext: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}

function filesContain(root: string, subdir: string, ext: string, needle: RegExp): boolean {
  return walk(join(root, subdir), ext).some((f) => needle.test(readFileSync(f, 'utf8')));
}

/** L2: the C++ class/struct symbol is declared somewhere in Source/. */
export function cppSymbolExists(symbol: string, label: string): UeChecker {
  return (ueRoot) => {
    if (!ueRoot) return { label, tier: 'L2', status: 'deferred', detail: 'UE root unavailable', reason: 'UE root not found — static check skipped' };
    const found = filesContain(ueRoot, 'Source', '.h', new RegExp(`\\b${symbol}\\b`));
    return found
      ? { label, tier: 'L2', status: 'pass', detail: `${symbol} declared in Source/` }
      : { label, tier: 'L2', status: 'deferred', detail: `${symbol} not in Source/`, reason: `${symbol} not found in UE Source — generate/commit C++ then re-check` };
  };
}

/** L2: a row name appears in a seed script under Content/Python. */
export function seedRowPresent(seedFile: string, rowName: string, label: string): UeChecker {
  return (ueRoot) => {
    if (!ueRoot) return { label, tier: 'L2', status: 'deferred', detail: 'UE root unavailable', reason: 'UE root not found — static check skipped' };
    const path = join(ueRoot, 'Content', 'Python', seedFile);
    const found = existsSync(path) && new RegExp(`["']${rowName}["']`).test(readFileSync(path, 'utf8'));
    return found
      ? { label, tier: 'L2', status: 'pass', detail: `${rowName} seeded in ${seedFile}` }
      : { label, tier: 'L2', status: 'deferred', detail: `${rowName} not in ${seedFile}`, reason: `${rowName} not found in ${seedFile}` };
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/acceptance/ueStaticCheckers.test.ts`
Expected: PASS (4 tests). Note: `cppSymbolExists` returns `deferred` (not `fail`) when missing — a missing-but-generatable symbol is an accepted gap, not a failure.

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalog/acceptance/ueStaticCheckers.ts src/__tests__/lib/catalog/acceptance/ueStaticCheckers.test.ts src/__tests__/fixtures/ue
git commit -m "feat(catalog): L2 UE static codebase-analysis checkers"
```

---

## Task 3: L3/L4 deferred checkers (interface stubs)

**Files:**
- Create: `src/lib/catalog/acceptance/deferred.ts`
- Test: `src/__tests__/lib/catalog/acceptance/deferred.test.ts`

**Context:** The live-UE runner is a later plan. Until then, runtime/visual checks resolve to `deferred` with a clear reason, so a step legitimately reaches config-complete (L0–L2) without blocking.

- [ ] **Step 1: Write the failing test**

`src/__tests__/lib/catalog/acceptance/deferred.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { runtimeDeferred, visualDeferred } from '@/lib/catalog/acceptance/deferred';

describe('deferred checkers', () => {
  it('runtimeDeferred is L3 deferred with a reason', () => {
    const r = runtimeDeferred('VSGenSampleEffectTest', 'Functional test passes')();
    expect(r).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(r.reason).toContain('VSGenSampleEffectTest');
  });
  it('visualDeferred is L4 deferred', () => {
    expect(visualDeferred('Renders correctly')().tier).toBe('L4');
    expect(visualDeferred('Renders correctly')().status).toBe('deferred');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/acceptance/deferred.test.ts`
Expected: FAIL — import unresolved.

- [ ] **Step 3: Implement**

`src/lib/catalog/acceptance/deferred.ts`:
```typescript
import type { AcceptanceResult } from './types';

/** L3 runtime check, pending the live-UE runner. `testName` is the functional test to run later. */
export function runtimeDeferred(testName: string, label: string): () => AcceptanceResult {
  return () => ({ label, tier: 'L3', status: 'deferred', detail: 'runtime pending', reason: `live-UE runner not yet run: ${testName}` });
}

/** L4 visual check, pending RHI + Gemini. */
export function visualDeferred(label: string): () => AcceptanceResult {
  return () => ({ label, tier: 'L4', status: 'deferred', detail: 'visual pending', reason: 'RHI+Gemini visual check not yet run' });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/acceptance/deferred.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/acceptance/deferred.ts src/__tests__/lib/catalog/acceptance/deferred.test.ts
git commit -m "feat(catalog): L3/L4 deferred acceptance stubs"
```

---

## Task 4: `pipeline_artifacts` DB module

**Files:**
- Create: `src/lib/pipeline-artifacts-db.ts`
- Test: `src/__tests__/lib/pipeline-artifacts-db.test.ts`

**Context:** Mirror `src/lib/catalog-db.ts` exactly. Per the established pattern (see `pipeline-db.test.ts`), the test covers the **pure `rowToArtifact` mapper only** — never the live DB.

- [ ] **Step 1: Write the failing test**

`src/__tests__/lib/pipeline-artifacts-db.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { rowToArtifact } from '@/lib/pipeline-artifacts-db';

describe('rowToArtifact', () => {
  it('maps a full row + parses JSON columns', () => {
    expect(rowToArtifact({
      catalog_id: 'items', entity_id: 'item-1', step: 'Attributes',
      data: '{"stats":{"Damage":34}}', ue_assets: '["/Game/Items/X"]',
      status: 'pass', tier: 'L0', reason: null, updated_at: '2026-05-26T00:00:00.000Z',
    })).toEqual({
      catalogId: 'items', entityId: 'item-1', step: 'Attributes',
      data: { stats: { Damage: 34 } }, ueAssets: ['/Game/Items/X'],
      status: 'pass', tier: 'L0', updatedAt: '2026-05-26T00:00:00.000Z',
    });
  });
  it('defaults empty JSON + omits null optionals', () => {
    const r = rowToArtifact({ catalog_id: 'items', entity_id: 'i', step: 'Economy', data: null, ue_assets: null, status: 'pending', tier: null, reason: null, updated_at: null });
    expect(r.data).toEqual({});
    expect(r.ueAssets).toEqual([]);
    expect(r.tier).toBeUndefined();
    expect(r.reason).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/pipeline-artifacts-db.test.ts`
Expected: FAIL — import unresolved.

- [ ] **Step 3: Implement**

`src/lib/pipeline-artifacts-db.ts`:
```typescript
import { getDb } from '@/lib/db';
import type { AcceptanceStatus, AcceptanceTier } from '@/lib/catalog/acceptance/types';

export interface PipelineArtifact {
  catalogId: string;
  entityId: string;
  step: string;
  data: Record<string, unknown>;
  ueAssets: string[];
  status: AcceptanceStatus;
  tier?: AcceptanceTier;
  reason?: string;
  updatedAt?: string;
}

function ensureTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS pipeline_artifacts (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      step TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      ue_assets TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      tier TEXT,
      reason TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id, step)
    )
  `);
}

/** Column row → PipelineArtifact. Pure (exported for unit test). */
export function rowToArtifact(row: Record<string, unknown>): PipelineArtifact {
  return {
    catalogId: row.catalog_id as string,
    entityId: row.entity_id as string,
    step: row.step as string,
    data: JSON.parse((row.data as string) || '{}'),
    ueAssets: JSON.parse((row.ue_assets as string) || '[]'),
    status: row.status as AcceptanceStatus,
    ...(row.tier ? { tier: row.tier as AcceptanceTier } : {}),
    ...(row.reason ? { reason: row.reason as string } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at as string } : {}),
  };
}

export function listArtifacts(catalogId: string, entityId?: string): PipelineArtifact[] {
  ensureTable();
  const sql = entityId
    ? 'SELECT * FROM pipeline_artifacts WHERE catalog_id = ? AND entity_id = ?'
    : 'SELECT * FROM pipeline_artifacts WHERE catalog_id = ?';
  const args = entityId ? [catalogId, entityId] : [catalogId];
  return (getDb().prepare(sql).all(...args) as Record<string, unknown>[]).map(rowToArtifact);
}

export function upsertArtifact(a: PipelineArtifact): PipelineArtifact {
  ensureTable();
  getDb().prepare(`
    INSERT INTO pipeline_artifacts (catalog_id, entity_id, step, data, ue_assets, status, tier, reason, updated_at)
    VALUES (@catalog_id, @entity_id, @step, @data, @ue_assets, @status, @tier, @reason, datetime('now'))
    ON CONFLICT(catalog_id, entity_id, step) DO UPDATE SET
      data=@data, ue_assets=@ue_assets, status=@status, tier=@tier, reason=@reason, updated_at=datetime('now')
  `).run({
    catalog_id: a.catalogId, entity_id: a.entityId, step: a.step,
    data: JSON.stringify(a.data), ue_assets: JSON.stringify(a.ueAssets),
    status: a.status, tier: a.tier ?? null, reason: a.reason ?? null,
  });
  return a;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/pipeline-artifacts-db.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline-artifacts-db.ts src/__tests__/lib/pipeline-artifacts-db.test.ts
git commit -m "feat(catalog): pipeline_artifacts DB module"
```

---

## Task 5: Artifact upsert validation + API route

**Files:**
- Create: `src/lib/catalog/artifact-validation.ts`
- Create: `src/app/api/pipeline-artifacts/route.ts`
- Test: `src/__tests__/lib/catalog/artifact-validation.test.ts`

**Context:** Mirror `src/app/api/catalog/route.ts`. The POST is the `@@CALLBACK` target a CLI uses to persist a produced step. Validate with Zod (already a dep — see `src/lib/catalog/validation.ts`).

- [ ] **Step 1: Write the failing test**

`src/__tests__/lib/catalog/artifact-validation.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { artifactUpsertSchema } from '@/lib/catalog/artifact-validation';

describe('artifactUpsertSchema', () => {
  it('accepts a valid upsert', () => {
    const r = artifactUpsertSchema.safeParse({
      catalogId: 'items', entityId: 'item-1', step: 'Attributes',
      data: { stats: { Damage: 34 } }, ueAssets: ['/Game/X'], status: 'pass', tier: 'L0',
    });
    expect(r.success).toBe(true);
  });
  it('rejects an unknown status', () => {
    const r = artifactUpsertSchema.safeParse({ catalogId: 'items', entityId: 'i', step: 'X', status: 'green' });
    expect(r.success).toBe(false);
  });
  it('defaults data/ueAssets when omitted', () => {
    const r = artifactUpsertSchema.safeParse({ catalogId: 'items', entityId: 'i', step: 'X', status: 'deferred' });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.data).toEqual({}); expect(r.data.ueAssets).toEqual([]); }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/artifact-validation.test.ts`
Expected: FAIL — import unresolved.

- [ ] **Step 3: Implement the schema**

`src/lib/catalog/artifact-validation.ts`:
```typescript
import { z } from 'zod';

export const artifactUpsertSchema = z.object({
  catalogId: z.string().min(1),
  entityId: z.string().min(1),
  step: z.string().min(1),
  data: z.record(z.string(), z.unknown()).default({}),
  ueAssets: z.array(z.string()).default([]),
  status: z.enum(['pass', 'pending', 'fail', 'deferred']),
  tier: z.enum(['L0', 'L1', 'L2', 'L3', 'L4']).optional(),
  reason: z.string().optional(),
});

export type ArtifactUpsert = z.infer<typeof artifactUpsertSchema>;
```

- [ ] **Step 4: Implement the route**

`src/app/api/pipeline-artifacts/route.ts`:
```typescript
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listArtifacts, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { artifactUpsertSchema } from '@/lib/catalog/artifact-validation';

/** GET /api/pipeline-artifacts?catalogId=items[&entityId=item-1] → PipelineArtifact[] */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    const entityId = req.nextUrl.searchParams.get('entityId') ?? undefined;
    if (!catalogId) return apiError('catalogId is required', 400);
    return apiSuccess(listArtifacts(catalogId, entityId));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Artifacts GET failed', 500);
  }
}

/** POST /api/pipeline-artifacts — the produce @@CALLBACK target. Upserts one step's artifact. */
export async function POST(req: NextRequest) {
  try {
    const parsed = artifactUpsertSchema.safeParse(await req.json());
    if (!parsed.success) return apiError('Invalid artifact payload', 400, parsed.error.issues);
    return apiSuccess(upsertArtifact(parsed.data));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Artifacts POST failed', 500);
  }
}
```

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run src/__tests__/lib/catalog/artifact-validation.test.ts`
Expected: PASS (3 tests).
Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | wc -l`
Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalog/artifact-validation.ts src/app/api/pipeline-artifacts/route.ts src/__tests__/lib/catalog/artifact-validation.test.ts
git commit -m "feat(catalog): pipeline-artifacts upsert validation + API route"
```

---

## Task 6: `StepSpec` contract + extend `Acceptance`

**Files:**
- Create: `src/lib/catalog/stepSpec.ts`
- Modify: `src/components/layout-lab/steps/StepFrame.tsx` (add `tier?` + `'deferred'` status)
- Test: `src/__tests__/lib/catalog/stepSpec.test.ts`

**Context:** Generalize `ITEM_STEP_SPECS` (`src/components/layout-lab/steps/itemsSteps.ts`) into a catalog-agnostic contract. A `StepSpec` declares its archetype, a `ViewDescriptor` (for the generic renderer), its `produce`, and its `accept`. `accept` returns the `AcceptanceResult` from a `Checker`.

- [ ] **Step 1: Modify `StepFrame` to carry tier + deferred**

In `src/components/layout-lab/steps/StepFrame.tsx`, replace the `AcceptanceStatus`/`Acceptance` declarations:
```typescript
export type AcceptanceStatus = 'pass' | 'pending' | 'fail' | 'deferred';
export interface Acceptance { label: string; status: AcceptanceStatus; detail: string; tier?: string; reason?: string }
```
And in the banner color line, map `deferred` to the muted/warn token:
```typescript
const sc = acceptance.status === 'pass' ? t.ok : acceptance.status === 'fail' ? t.bad : acceptance.status === 'deferred' ? t.muted : t.warn;
```
And append the tier to the status badge text:
```typescript
>{acceptance.status.toUpperCase()}{acceptance.tier ? ` · ${acceptance.tier}` : ''}</span>
```

- [ ] **Step 2: Write the failing test**

`src/__tests__/lib/catalog/stepSpec.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import { minLength } from '@/lib/catalog/acceptance/dataCheckers';

describe('StepSpec contract', () => {
  it('a spec produces output and derives acceptance from it', () => {
    const spec: StepSpec = {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e) => ({ data: { brief: `${e.name} is a thing `.repeat(40) } }),
      accept: minLength('brief', 'Brief ≥ 300 chars', 300),
    };
    const out = spec.produce({ id: 'x', name: 'Sword', lifecycle: 'planned', data: {} });
    expect(spec.accept(out.data ?? {}).status).toBe('pass');
    expect(spec.view.kind).toBe('prose');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/stepSpec.test.ts`
Expected: FAIL — import unresolved.

- [ ] **Step 4: Implement the contract**

`src/lib/catalog/stepSpec.ts`:
```typescript
import type { Checker } from './acceptance/types';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { StepOutput } from '@/components/layout-lab/labPipelineStore';

/** The common archetypes (Hybrid: these use the generic renderer; complex rows may register a bespoke component instead). */
export type ArchetypeId =
  | 'brief' | 'schema' | 'balance' | 'gallery' | 'rules' | 'checklist' | 'manifest' | 'custom';

/** Declarative View for the generic ArchetypeStep renderer. */
export type ViewDescriptor =
  | { kind: 'prose'; field: string; emptyText: string }
  | { kind: 'table'; field: string; columns: { key: string; unit?: string }[] }
  | { kind: 'gallery'; field: string; candidates: number }
  | { kind: 'checklist'; field: string }
  | { kind: 'manifest'; field: string };

export interface StepSpec {
  archetype: ArchetypeId;
  label: string;
  view: ViewDescriptor;
  /** What the Produce writes. */
  produce: (entity: LabEntity) => StepOutput;
  /** Derives the acceptance result from the persisted artifact data. */
  accept: Checker;
  /** Optional CLI direction default + note for the Produce panel. */
  produceNote?: string;
  defaultDirection?: string;
}

export interface CatalogPipeline {
  catalogId: string;
  steps: StepSpec[];
}
```

- [ ] **Step 5: Run test + typecheck + the existing lab tests**

Run: `npx vitest run src/__tests__/lib/catalog/stepSpec.test.ts src/__tests__/components/layout-lab`
Expected: PASS (stepSpec 1 test + the 8 lab tests still green — the `Acceptance` change is backward-compatible).
Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | wc -l`
Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalog/stepSpec.ts src/components/layout-lab/steps/StepFrame.tsx src/__tests__/lib/catalog/stepSpec.test.ts
git commit -m "feat(catalog): StepSpec contract + tier/deferred on Acceptance"
```

---

## Task 7: Generic `ArchetypeStep` renderer (Hybrid)

**Files:**
- Create: `src/components/layout-lab/steps/ArchetypeStep.tsx`
- Test: `src/__tests__/components/layout-lab/ArchetypeStep.test.tsx`

**Context:** One component renders any `StepSpec` whose `view.kind` is a common archetype: reads the persisted artifact (`useLabStep`), renders the View from `view`, the Produce via `CliProduce` (writing `spec.produce(entity)`), and the Acceptance via `StepFrame` (`spec.accept(artifact.data)`). Complex rows still register bespoke components via the existing `getStepComponent`; this is the shared shell for the rest.

- [ ] **Step 1: Write the failing test**

`src/__tests__/components/layout-lab/ArchetypeStep.test.tsx`:
```typescript
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { minLength } from '@/lib/catalog/acceptance/dataCheckers';
import type { StepSpec } from '@/lib/catalog/stepSpec';

const t = LAB_THEMES[0];
const entity = { id: 'e1', name: 'Sword', lifecycle: 'planned' as const, data: {} };
const spec: StepSpec = {
  archetype: 'brief', label: 'Concept Brief',
  view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
  produce: (e) => ({ data: { brief: `${e.name} `.repeat(120) } }),
  accept: minLength('brief', 'Brief ≥ 300 chars', 300),
};

describe('ArchetypeStep', () => {
  afterEach(cleanup);
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });

  it('renders empty state + pending, then persists + passes on Produce', () => {
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={spec} />);
    expect(screen.getByText('No brief yet')).toBeTruthy();
    fireEvent.click(screen.getByText(/Generate/));
    expect(screen.queryByText('No brief yet')).toBeNull();
    expect(screen.getAllByText(/PASS/).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/components/layout-lab/ArchetypeStep.test.tsx`
Expected: FAIL — import unresolved.

- [ ] **Step 3: Implement**

`src/components/layout-lab/steps/ArchetypeStep.tsx`:
```typescript
'use client';

import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { useLabStep, useLabPipelineStore } from '../labPipelineStore';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';
import type { StepSpec, ViewDescriptor } from '@/lib/catalog/stepSpec';

function ViewPanel({ t, view, data }: { t: LabTheme; view: ViewDescriptor; data: Record<string, unknown> }) {
  if (view.kind === 'prose') {
    const txt = String(data[view.field] ?? '');
    return txt
      ? <div style={{ fontSize: 15, lineHeight: 1.7, color: t.text, whiteSpace: 'pre-wrap' }}>{txt}</div>
      : <span style={{ fontSize: 15, color: t.muted }}>{view.emptyText}</span>;
  }
  if (view.kind === 'table') {
    const obj = (data[view.field] ?? {}) as Record<string, unknown>;
    return (
      <div style={{ border: `1px solid ${t.line}` }}>
        {view.columns.map((c) => (
          <div key={c.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 12px', borderTop: `1px solid ${t.line}`, fontSize: 15 }}>
            <span style={{ color: t.text }}>{c.key}</span>
            <span className={t.fontMono} style={{ color: obj[c.key] != null ? t.inkDeep : t.warn }}>{obj[c.key] != null ? `${obj[c.key]}${c.unit ? ' ' + c.unit : ''}` : '— missing'}</span>
          </div>
        ))}
      </div>
    );
  }
  if (view.kind === 'checklist' || view.kind === 'manifest') {
    const arr = Array.isArray(data[view.field]) ? (data[view.field] as unknown[]) : [];
    return arr.length
      ? <div>{arr.map((x, i) => <div key={i} className={t.fontMono} style={{ fontSize: 14, padding: '6px 0', borderTop: `1px solid ${t.line}`, color: t.text }}>✓ {String(Array.isArray(x) ? x.join(' · ') : x)}</div>)}</div>
      : <span style={{ fontSize: 15, color: t.muted }}>Nothing yet — run Produce.</span>;
  }
  // gallery: simple candidate count; bespoke selection UI lives in a registered component when richer interaction is needed.
  return <span style={{ fontSize: 14, color: t.muted }}>{view.candidates} candidates · select via Produce.</span>;
}

/** Hybrid generic renderer: drives any common-archetype StepSpec from persisted artifacts. */
export function ArchetypeStep({ t, entity, step, spec }: { t: LabTheme; entity: LabEntity; step: string; spec: StepSpec }) {
  const art = useLabStep(entity.id, step);
  const produce = useLabPipelineStore((s) => s.produce);
  const data = art?.data ?? {};
  return (
    <StepFrame t={t} acceptance={spec.accept(data)}
      panels={[
        { label: 'View', node: <ViewPanel t={t} view={spec.view} data={data} /> },
        { label: 'Produce', node: (
          <CliProduce t={t} label={`Generate ${spec.label} (CLI)`} rows={3}
            defaultDirection={spec.defaultDirection} note={spec.produceNote}
            buildPrompt={(dir) => `Produce ${spec.label} for ${entity.name}. ${dir}`}
            onComplete={() => produce(entity.id, step, spec.produce(entity))} />
        ) },
      ]}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/components/layout-lab/ArchetypeStep.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout-lab/steps/ArchetypeStep.tsx src/__tests__/components/layout-lab/ArchetypeStep.test.tsx
git commit -m "feat(layout-lab): generic ArchetypeStep renderer (Hybrid)"
```

---

## Task 8: Self-registration registry + codegen barrel + scoped check

**Files:**
- Create: `src/lib/catalog/pipeline-registry.ts`
- Create: `src/lib/catalog/pipelines/registry.generated.ts` (initially empty barrel)
- Create: `scripts/gen-pipeline-registry.mjs`
- Create: `scripts/scoped-check.mjs`
- Modify: `package.json` (add `gen:pipelines` + `check:scoped` scripts)
- Test: `src/__tests__/lib/catalog/pipeline-registry.test.ts`

**Context:** A row drops `src/lib/catalog/pipelines/<catalogId>.ts` that calls `registerCatalogPipeline(...)` at import. The codegen script globs that folder and writes an import-only barrel — so CLIs **never edit a shared registry file** (the #1 conflict source). `scoped-check.mjs` runs tsc/eslint/vitest against only changed files + the contract files.

- [ ] **Step 1: Write the failing test**

`src/__tests__/lib/catalog/pipeline-registry.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { registerCatalogPipeline, getCatalogPipeline, _resetRegistry } from '@/lib/catalog/pipeline-registry';
import { minCount } from '@/lib/catalog/acceptance/dataCheckers';

describe('pipeline-registry', () => {
  beforeEach(() => _resetRegistry());
  it('registers and retrieves a catalog pipeline', () => {
    registerCatalogPipeline({
      catalogId: 'demo',
      steps: [{ archetype: 'checklist', label: 'Gate', view: { kind: 'checklist', field: 'checks' }, produce: () => ({ data: { checks: ['a'] } }), accept: minCount('checks', 'Checks', 1) }],
    });
    expect(getCatalogPipeline('demo')?.steps[0].label).toBe('Gate');
    expect(getCatalogPipeline('missing')).toBeNull();
  });
  it('last registration wins (idempotent re-register)', () => {
    const mk = (label: string) => ({ catalogId: 'demo', steps: [{ archetype: 'checklist' as const, label, view: { kind: 'checklist' as const, field: 'c' }, produce: () => ({ data: {} }), accept: minCount('c', label, 0) }] });
    registerCatalogPipeline(mk('first'));
    registerCatalogPipeline(mk('second'));
    expect(getCatalogPipeline('demo')?.steps[0].label).toBe('second');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/pipeline-registry.test.ts`
Expected: FAIL — import unresolved.

- [ ] **Step 3: Implement the registry**

`src/lib/catalog/pipeline-registry.ts`:
```typescript
import type { CatalogPipeline } from './stepSpec';

const _registry = new Map<string, CatalogPipeline>();

/** Called at module load by each src/lib/catalog/pipelines/<id>.ts file. */
export function registerCatalogPipeline(pipeline: CatalogPipeline): void {
  _registry.set(pipeline.catalogId, pipeline);
}

export function getCatalogPipeline(catalogId: string): CatalogPipeline | null {
  return _registry.get(catalogId) ?? null;
}

export function allCatalogPipelines(): CatalogPipeline[] {
  return [..._registry.values()];
}

/** Test-only reset. */
export function _resetRegistry(): void {
  _registry.clear();
}
```

`src/lib/catalog/pipelines/registry.generated.ts`:
```typescript
// AUTO-GENERATED by scripts/gen-pipeline-registry.mjs — do not edit by hand.
// Importing this barrel triggers each pipeline file's self-registration side-effect.
export {};
```

- [ ] **Step 4: Implement the codegen + scoped-check scripts**

`scripts/gen-pipeline-registry.mjs`:
```javascript
import { readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'catalog', 'pipelines');
const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'registry.generated.ts');
const lines = files.map((f) => `import './${f.replace(/\.ts$/, '')}';`);
const body = `// AUTO-GENERATED by scripts/gen-pipeline-registry.mjs — do not edit by hand.\n// Importing this barrel triggers each pipeline file's self-registration side-effect.\n${lines.join('\n')}\nexport {};\n`;
writeFileSync(join(dir, 'registry.generated.ts'), body);
console.log(`gen-pipeline-registry: wired ${files.length} catalog pipeline(s).`);
```

`scripts/scoped-check.mjs`:
```javascript
import { execSync } from 'node:child_process';

// Per-CLI scoped gate: typecheck (whole project — fast, isolates contract breaks),
// then lint + test ONLY the files this CLI changed vs origin/HEAD, so foreign
// in-progress work on the shared tree does not fail this CLI's gate.
const changed = execSync('git diff --name-only HEAD', { encoding: 'utf8' })
  .split('\n').map((s) => s.trim()).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
const src = changed.filter((f) => f.startsWith('src/') && !f.includes('__tests__'));
const tests = changed.filter((f) => f.includes('__tests__'));

const tsc = execSync('npx tsc --noEmit', { encoding: 'utf8', stdio: 'pipe' }).toString();
// (tsc output is filtered for AssetInspector by the caller)
if (src.length) execSync(`npx eslint ${src.join(' ')}`, { stdio: 'inherit' });
if (tests.length) execSync(`npx vitest run ${tests.join(' ')}`, { stdio: 'inherit' });
console.log('scoped-check: OK');
```

In `package.json` `"scripts"`, add:
```json
"gen:pipelines": "node scripts/gen-pipeline-registry.mjs",
"check:scoped": "node scripts/scoped-check.mjs"
```

- [ ] **Step 5: Run test + the codegen**

Run: `npx vitest run src/__tests__/lib/catalog/pipeline-registry.test.ts`
Expected: PASS (2 tests).
Run: `npm run gen:pipelines`
Expected: prints `gen-pipeline-registry: wired 0 catalog pipeline(s).` (no pipeline files yet).

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalog/pipeline-registry.ts src/lib/catalog/pipelines/registry.generated.ts scripts/gen-pipeline-registry.mjs scripts/scoped-check.mjs package.json src/__tests__/lib/catalog/pipeline-registry.test.ts
git commit -m "feat(catalog): self-registration registry + codegen barrel + scoped check"
```

---

## Task 9: Tier roll-up dashboard (stub-vs-real visibility)

**Files:**
- Create: `src/lib/catalog/rollup.ts` (pure aggregation)
- Create: `src/components/layout-lab/PipelineRollup.tsx`
- Test: `src/__tests__/lib/catalog/rollup.test.ts`

**Context:** Across 30 rows, "L2-green / L3-deferred" is the norm. The roll-up makes the highest-tier-reached + what's deferred explicit, so "done" never silently means "never ran". Pure aggregation is unit-tested; the component renders it.

- [ ] **Step 1: Write the failing test**

`src/__tests__/lib/catalog/rollup.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { summarizeEntity } from '@/lib/catalog/rollup';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

const a = (step: string, status: PipelineArtifact['status'], tier?: PipelineArtifact['tier']): PipelineArtifact =>
  ({ catalogId: 'items', entityId: 'i', step, data: {}, ueAssets: [], status, tier });

describe('summarizeEntity', () => {
  it('counts pass/deferred/pending and the highest tier reached', () => {
    const r = summarizeEntity([a('A', 'pass', 'L0'), a('B', 'pass', 'L2'), a('C', 'deferred', 'L3')], 4);
    expect(r).toMatchObject({ total: 4, done: 2, deferred: 1, pending: 1, highestTier: 'L2' });
  });
  it('configComplete is true when every authored step is pass-at-L2-or-below or deferred-above', () => {
    expect(summarizeEntity([a('A', 'pass', 'L0'), a('B', 'deferred', 'L3')], 2).configComplete).toBe(true);
    expect(summarizeEntity([a('A', 'pending', 'L0')], 1).configComplete).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/rollup.test.ts`
Expected: FAIL — import unresolved.

- [ ] **Step 3: Implement the aggregation**

`src/lib/catalog/rollup.ts`:
```typescript
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { AcceptanceTier } from './acceptance/types';

const TIER_ORDER: AcceptanceTier[] = ['L0', 'L1', 'L2', 'L3', 'L4'];

export interface EntityRollup {
  total: number;
  done: number;       // status === 'pass'
  deferred: number;
  pending: number;
  failed: number;
  highestTier: AcceptanceTier | null;
  /** Every step is either pass (any tier) or deferred at L3/L4 — i.e. nothing pending/failed at ≤ L2. */
  configComplete: boolean;
}

export function summarizeEntity(artifacts: PipelineArtifact[], totalSteps: number): EntityRollup {
  let done = 0, deferred = 0, pending = 0, failed = 0, hi = -1;
  for (const a of artifacts) {
    if (a.status === 'pass') done++;
    else if (a.status === 'deferred') deferred++;
    else if (a.status === 'fail') failed++;
    else pending++;
    if (a.status === 'pass' && a.tier) hi = Math.max(hi, TIER_ORDER.indexOf(a.tier));
  }
  const pendingMissing = totalSteps - done - deferred - failed; // steps with no artifact yet
  return {
    total: totalSteps, done, deferred, failed,
    pending: pending + Math.max(0, pendingMissing),
    highestTier: hi >= 0 ? TIER_ORDER[hi] : null,
    configComplete: failed === 0 && pending + Math.max(0, pendingMissing) === 0,
  };
}
```

- [ ] **Step 4: Implement the component**

`src/components/layout-lab/PipelineRollup.tsx`:
```typescript
'use client';

import { summarizeEntity, type EntityRollup } from '@/lib/catalog/rollup';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { LabTheme } from './theme';

const COLOR = (t: LabTheme, s: PipelineArtifact['status']) =>
  s === 'pass' ? t.ok : s === 'fail' ? t.bad : s === 'deferred' ? t.muted : t.warn;

/** Per-step status strip + a config-complete summary, so deferred (stub) steps are visible. */
export function PipelineRollup({ t, steps, artifacts }: { t: LabTheme; steps: string[]; artifacts: PipelineArtifact[] }) {
  const byStep = new Map(artifacts.map((a) => [a.step, a]));
  const sum: EntityRollup = summarizeEntity(artifacts, steps.length);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>
        {sum.done}/{sum.total} pass · {sum.deferred} deferred · {sum.pending} pending · highest {sum.highestTier ?? '—'}
        {sum.configComplete && <span style={{ color: t.ok }}> · CONFIG-COMPLETE</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {steps.map((s) => {
          const a = byStep.get(s);
          const status = a?.status ?? 'pending';
          return (
            <span key={s} className={t.fontMono} title={`${s}: ${status}${a?.tier ? ' · ' + a.tier : ''}${a?.reason ? ' — ' + a.reason : ''}`}
              style={{ fontSize: 14, padding: '4px 8px', border: `1px solid ${COLOR(t, status)}`, color: COLOR(t, status), borderRadius: t.glass ? 6 : 0 }}>
              {s}{a?.tier ? ` · ${a.tier}` : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run src/__tests__/lib/catalog/rollup.test.ts`
Expected: PASS (2 tests).
Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | wc -l`
Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalog/rollup.ts src/components/layout-lab/PipelineRollup.tsx src/__tests__/lib/catalog/rollup.test.ts
git commit -m "feat(catalog): tier roll-up (stub-vs-real visibility)"
```

---

## Task 10: UE schema snapshot exporter

**Files:**
- Create: `scripts/snapshot-ue-schema.mjs`
- Create: `src/lib/catalog/ue-schema.generated.json` (committed snapshot; `{}` until first run on a machine with the UE tree)
- Create: `src/lib/catalog/ue-schema.ts` (typed loader)
- Test: `src/__tests__/lib/catalog/ue-schema.test.ts`

**Context:** Schema-down: the app validates against UE row-struct shapes. Snapshot the `F*Row` `UPROPERTY` field names from `Source/PoF/**/*.h` into a JSON all CLIs read, so a wave authors against one consistent schema. Runs on a machine with the UE tree; commits the snapshot for the others.

- [ ] **Step 1: Write the failing test (against a fixture header)**

Add fixture `src/__tests__/fixtures/ue/Source/PoF/Rows.h`:
```cpp
USTRUCT() struct FARPGCurrencyDef : public FTableRowBase {
  GENERATED_BODY()
  UPROPERTY(EditAnywhere) FText DisplayName;
  UPROPERTY(EditAnywhere) float Cap;
};
```
`src/__tests__/lib/catalog/ue-schema.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseRowStructs } from '@/lib/catalog/ue-schema';

describe('parseRowStructs', () => {
  it('extracts struct name + UPROPERTY field names from a header', () => {
    const out = parseRowStructs(join(process.cwd(), 'src/__tests__/fixtures/ue/Source/PoF/Rows.h'));
    expect(out.FARPGCurrencyDef).toEqual(['DisplayName', 'Cap']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/ue-schema.test.ts`
Expected: FAIL — import unresolved.

- [ ] **Step 3: Implement the parser + loader + snapshot**

`src/lib/catalog/ue-schema.ts`:
```typescript
import { readFileSync, existsSync } from 'node:fs';
import schema from './ue-schema.generated.json';

export type UeSchema = Record<string, string[]>; // structName → field names

/** Parse one .h file's `USTRUCT ... FTableRowBase` blocks → { StructName: [fields] }. */
export function parseRowStructs(headerPath: string): UeSchema {
  if (!existsSync(headerPath)) return {};
  const src = readFileSync(headerPath, 'utf8');
  const out: UeSchema = {};
  const structRe = /struct\s+(\w*Row\w*|F\w*Def)\s*:\s*public\s+FTableRowBase\s*\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = structRe.exec(src))) {
    const fields = [...m[2].matchAll(/UPROPERTY\([^)]*\)\s*\n?\s*[\w:<>*\s]+?\s+(\w+)\s*;/g)].map((f) => f[1]);
    out[m[1]] = fields;
  }
  return out;
}

/** The committed snapshot of UE row-struct shapes (schema-down source for validation). */
export function ueSchema(): UeSchema {
  return schema as UeSchema;
}
```
`src/lib/catalog/ue-schema.generated.json`:
```json
{}
```
`scripts/snapshot-ue-schema.mjs`:
```javascript
import { readdirSync, statSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.POF_UE_ROOT || 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'src', 'lib', 'catalog', 'ue-schema.generated.json');
const structRe = /struct\s+(\w*Row\w*|F\w*Def)\s*:\s*public\s+FTableRowBase\s*\{([\s\S]*?)\n\}/g;
function walk(d, out = []) { if (!existsSync(d)) return out; for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p, out) : n.endsWith('.h') && out.push(p); } return out; }
const schema = {};
if (existsSync(root)) for (const f of walk(join(root, 'Source'))) { const s = readFileSync(f, 'utf8'); let m; while ((m = structRe.exec(s))) schema[m[1]] = [...m[2].matchAll(/UPROPERTY\([^)]*\)\s*\n?\s*[\w:<>*\s]+?\s+(\w+)\s*;/g)].map((x) => x[1]); }
writeFileSync(outPath, JSON.stringify(schema, null, 2) + '\n');
console.log(`snapshot-ue-schema: ${Object.keys(schema).length} struct(s) → ue-schema.generated.json`);
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run src/__tests__/lib/catalog/ue-schema.test.ts`
Expected: PASS (1 test).
Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | wc -l`
Expected: `0` (ensure `resolveJsonModule` is on in tsconfig; it is — Next default).

- [ ] **Step 5: Commit**

```bash
git add scripts/snapshot-ue-schema.mjs src/lib/catalog/ue-schema.ts src/lib/catalog/ue-schema.generated.json src/__tests__/fixtures/ue/Source/PoF/Rows.h src/__tests__/lib/catalog/ue-schema.test.ts
git commit -m "feat(catalog): UE row-struct schema snapshot exporter"
```

---

## Task 11: PILOT — wire one logic row (Status Effect) end-to-end

**Files:**
- Create: `src/lib/catalog/pipelines/status-effect.ts` (the pilot pipeline spec)
- Test: `src/__tests__/lib/catalog/pipelines/status-effect.test.ts`
- Run: `npm run gen:pipelines` (re-barrels)

**Context:** Prove the chassis on a logic-heavy row that already has UE infra: a **Status Effect / Buff** maps to a `UGE_*` GameplayEffect + a `VS*EffectTest` (e.g. the existing `VSStatusBurningEffectTest`). Its steps: Brief (L0) → Rules/effect logic (L0 data + L2 `cppSymbolExists`) → Balance (L0) → Icon (L1 selection, deferred runner not needed) → Test Gate (L3 `runtimeDeferred`) → UE Packaging (L2 `seedRowPresent` + manifest). This reaches **config-complete (L0–L2)** with the Test Gate `deferred` — exactly the parallel-dev bar.

- [ ] **Step 1: Write the failing test**

`src/__tests__/lib/catalog/pipelines/status-effect.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('status-effect pilot pipeline', () => {
  beforeEach(() => _resetRegistry());
  it('registers a config-complete-capable pipeline with a deferred runtime gate', async () => {
    await import('@/lib/catalog/pipelines/status-effect');
    const p = getCatalogPipeline('status-effect');
    expect(p).not.toBeNull();
    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Effect Logic');
    expect(labels).toContain('Test Gate');

    const entity = { id: 'burning', name: 'Burning', lifecycle: 'planned' as const, data: {} };
    // Effect Logic, once produced, derives a non-pending L0 result.
    const logic = p!.steps.find((s) => s.label === 'Effect Logic')!;
    expect(logic.accept(logic.produce(entity).data ?? {}).status).toBe('pass');
    // Test Gate is L3 deferred regardless of data (live-UE runner not yet built).
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/pipelines/status-effect.test.ts`
Expected: FAIL — `status-effect` import unresolved.

- [ ] **Step 3: Implement the pilot pipeline spec**

`src/lib/catalog/pipelines/status-effect.ts`:
```typescript
import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

registerCatalogPipeline({
  catalogId: 'status-effect',
  steps: [
    {
      archetype: 'brief', label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({ data: { brief: `${e.name} is a damage-over-time status effect that ticks for several seconds and stacks with intensity. `.repeat(3) } }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },
    {
      archetype: 'rules', label: 'Effect Logic',
      view: { kind: 'table', field: 'effect', columns: [{ key: 'magnitude' }, { key: 'period', unit: 's' }, { key: 'duration', unit: 's' }, { key: 'tag' }] },
      produce: (e) => ({ data: { effect: { magnitude: -5, period: 1, duration: 3, tag: `State.${slug(e.name)}` } }, ueAssets: [`/Game/Abilities/Generated/GE_Gen_${slug(e.name)}`] }),
      accept: fieldsPopulated('effect', 'Effect rules complete (magnitude/period/duration/tag)', ['magnitude', 'period', 'duration', 'tag']),
    },
    {
      archetype: 'balance', label: 'Balance',
      view: { kind: 'table', field: 'balance', columns: [{ key: 'dps' }] },
      produce: () => ({ data: { balance: { dps: 5 }, dps: 5 } }),
      accept: withinPercent('dps', 'DPS within ±20% of tier (5)', 5, 20),
    },
    {
      archetype: 'gallery', label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e) => ({ data: { selected: 0 }, ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Icon`] }),
      accept: selected('selected', 'A status icon is selected'),
    },
    {
      archetype: 'checklist', label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({ data: { checks: ['effect applies', 'ticks for duration', 'expires + removes tag'] } }),
      accept: runtimeDeferred('VSStatusBurningEffectTest', 'Functional test passes in UE'),
    },
    {
      archetype: 'manifest', label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e) => {
        const s = slug(e.name);
        const assets = [`GE_Gen_${s}`, `T_${s}_Icon`, `DT_GeneratedAbilities :: ${s}`];
        return { data: { assets }, ueAssets: assets.map((a) => `/Game/Abilities/Generated/${a}`) };
      },
      accept: minCount('assets', 'All produced assets packaged', 3),
    },
  ],
});
```

- [ ] **Step 4: Run test + re-barrel + scoped check**

Run: `npx vitest run src/__tests__/lib/catalog/pipelines/status-effect.test.ts`
Expected: PASS (1 test).
Run: `npm run gen:pipelines`
Expected: `gen-pipeline-registry: wired 1 catalog pipeline(s).`
Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | wc -l`
Expected: `0`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/pipelines/status-effect.ts src/lib/catalog/pipelines/registry.generated.ts src/__tests__/lib/catalog/pipelines/status-effect.test.ts
git commit -m "feat(catalog): PILOT status-effect pipeline end-to-end (config-complete, runtime deferred)"
```

- [ ] **Step 6: OPERATOR REVIEW GATE**

Stop. Demo: the pilot reaches config-complete (Brief/Effect Logic/Balance/Icon/Packaging = `pass` at L0–L2; Test Gate = `deferred` at L3). Operator reviews the spec ergonomics, the archetype coverage, and the acceptance feel **before the swarm**. Capture adjustments to the chassis here; do not start Wave 2 until approved.

---

## Wave 2…N — The swarm (execution contract, not linear tasks)

Once the pilot is approved, the 30 rows are produced **in dependency waves** by parallel CLIs. This is a *process*, driven by the chassis above — each row is a `src/lib/catalog/pipelines/<catalogId>.ts` spec file (like the pilot), plus a bespoke `ArchetypeStep`-registered component only where a row's View genuinely needs custom interaction.

**Per-CLI loop (one row):**
1. Read `docs/catalog/PIPELINE_REVIEW.md` for the row's archetype sequence + cross-catalog links.
2. Author `src/lib/catalog/pipelines/<catalogId>.ts` (archetype `StepSpec[]`); reuse `dataCheckers`/`ueStaticCheckers`/`deferred`; reference `ueSchema()` for field names.
3. For any non-generic View, add a bespoke component under `src/components/layout-lab/steps/<catalogId>/` and register it; otherwise rely on `ArchetypeStep`.
4. Edit UE **source as text** where the row's content-up flow requires it (generated C++, `manifest.json`, seed script CATALOG); commit narrowly to the UE repo per [[reference-ue-shared-concurrency]].
5. Run `npm run gen:pipelines` then `npm run check:scoped` (NOT full `validate` — avoid foreign failures).
6. Reach **config-complete (L0–L2)**; record L3/L4 as `deferred` via the deferred checkers. Never block on the live editor.
7. Commit the row's pipeline + tests.

**Wave schedule (dependency order):**
- **Wave 2 — presentation + logic spine (shared, built first):** icon-set, vfx-asset, music-track, ambient, material, currency, loot-tables, spellbook/skill-ability, status-effect (pilot done). These are consumed by others.
- **Wave 3 — core content consumers:** item, bestiary, prop-environment, character-hero-npc, combat-map, zone-map.
- **Wave 4 — systems + narrative:** crafting-recipe, vendor-shop, progression-curve, achievement, save-checkpoint, quest, dialog-tree, cutscene, codex-lore, faction-reputation, screen-flow, state-graph, hud-element, input-scheme, tutorial-beat.

**Guardrails (enforced by the chassis):**
- No central registry edits — self-registration + `gen:pipelines` only.
- `pipeline_artifacts` upsert is idempotent (PK `catalog_id,entity_id,step`) → CLIs are **resumable**; re-running re-reads existing artifacts.
- Cross-catalog `CatalogLink`s may reference an upstream entity that is still `deferred` (the `catalog_lifecycle.links` field already exists).
- One schema snapshot per wave (`npm run snapshot-ue-schema` on the UE machine, commit the JSON).

## DEFERRED to a later plan — Live-UE lease + L3/L4 runner

Not built here (operator decision: build after the swarm reaches config-complete). When built, it will: acquire a single-resource lease (reuse `headless_builds`), run `UnrealEditor-Cmd … -abslog=<unique>` (functional tests like `VSStatusBurningEffectTest`, judged by `-abslog` markers per [[reference-ue-headless-shutdown-crash]]), and POST verdicts to `/api/pipeline-artifacts`, flipping `deferred` → `pass`/`fail`. Configurable: operator-triggered drain or an always-on serialized worker.

---

## Self-Review

**Spec coverage (vs `WIRING-AND-ACCEPTANCE.md` + the 3 locked decisions):**
- New `pipeline_artifacts` table → Task 4 ✓; API → Task 5 ✓; client read is via `apiFetch` against Task 5 (no separate hook task needed — the lab store remains the interactive client; the API is the server-of-record the swarm + roll-up read).
- Schema-down/content-up → Task 10 snapshot ✓; static validation via `ueStaticCheckers` (Task 2) ✓.
- 4-tier ladder + `deferred` → Tasks 1/2/3 ✓; `Acceptance` carries tier → Task 6 ✓; roll-up surfaces it → Task 9 ✓.
- Live-UE lease configurable, deferred → explicitly a later plan ✓ (decision 3).
- Reuse `headless_builds`/`visual_verifications`/`ability_specs`, add only `pipeline_artifacts` → honored (no new tables besides `pipeline_artifacts`) ✓.
- Hybrid archetypes → `ArchetypeStep` (Task 7) + bespoke-via-registry escape hatch ✓.
- Pilot = logic row (status-effect) → Task 11 ✓.
- Minimize shared-file writes → self-registration + codegen (Task 8) ✓; scoped check (Task 8) ✓.

**Placeholder scan:** No "TBD/TODO"; every code step has complete code; the swarm section is an explicit process contract (not a code task) and the live-UE runner is explicitly scoped out, not hand-waved.

**Type consistency:** `AcceptanceTier`/`AcceptanceStatus`/`AcceptanceResult`/`Checker` (Task 1) are reused unchanged in Tasks 2/3/4/6/9. `PipelineArtifact` (Task 4) is the type consumed by Tasks 9/Wave2. `StepSpec`/`CatalogPipeline` (Task 6) are produced by Tasks 7/8/11. `produce` returns `StepOutput` (from `labPipelineStore`) everywhere. `getStepComponent` (existing) is the bespoke escape hatch referenced in Task 7. `_resetRegistry` (Task 8) is used by Tasks 8/11 tests.

**One gap fixed inline:** Task 6's test imports `LabEntity` shape `{id,name,lifecycle,data}` — matches `useLabCatalogData.ts` `LabEntity` exactly. Task 11 reuses it. No drift.
