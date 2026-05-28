# Procedural Zone-Graph Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deterministic zone-graph generator wired into the World module's Map tab — parameters + seed → candidate zones rendered in `ZoneMapCanvas`, auto-validated via `zone-analysis.ts`, with reroll + a SQLite-backed seed gallery of pinned favorites.

**Architecture:** A pure generator/validator lib is the core; `procgen-db` gains a pins table + API route; `ZoneMapCanvas` becomes generic so generated zones render; a self-contained panel embeds in the clean `MapTopologyGroup`.

**Tech Stack:** Next.js 16 route handlers, React 19, Zustand-free (useCRUD), better-sqlite3, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-28-zone-graph-generator-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/world/zone-graph-generator.ts` | **new** — `generateZoneGraph` + `validateZoneGraph` (pure) |
| `src/types/procgen.ts` | **modify** — `ZoneGraphPin` type |
| `src/lib/procgen-db.ts` | **modify** — `zone_graph_pins` CRUD |
| `src/app/api/procgen/zone-pins/route.ts` | **new** — GET/POST/DELETE |
| `src/components/modules/core-engine/sub_world/map/MapCanvas.tsx` | **modify** — generic over `MapZone` |
| `src/components/modules/core-engine/sub_world/map/ZoneGeneratorPanel.tsx` | **new** — generator UI |
| `src/components/modules/core-engine/sub_world/map/MapTopologyGroup.tsx` | **modify** — embed the panel |
| `src/__tests__/lib/zone-graph-generator.test.ts` | **new** |
| `src/__tests__/lib/procgen-db-zone-pins.test.ts` | **new** |

---

## Task 1: Pure generator + validator

**Files:**
- Create: `src/lib/world/zone-graph-generator.ts`
- Test: `src/__tests__/lib/zone-graph-generator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/zone-graph-generator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateZoneGraph, validateZoneGraph, type ZoneGraphParams } from '@/lib/world/zone-graph-generator';

const base: ZoneGraphParams = {
  zoneCount: 8, branchiness: 0, topology: 'linear', difficulty: 'linear', maxLevel: 30, seed: 1234,
};
const edgeCount = (zs: { connections: string[] }[]) => zs.reduce((a, z) => a + z.connections.length, 0);

describe('generateZoneGraph', () => {
  it('is deterministic for identical params and varies with the seed', () => {
    expect(generateZoneGraph(base)).toEqual(generateZoneGraph(base));
    expect(generateZoneGraph({ ...base, seed: 9999 })).not.toEqual(generateZoneGraph(base));
  });

  it('honors zoneCount (clamped 2..14)', () => {
    expect(generateZoneGraph({ ...base, zoneCount: 6 })).toHaveLength(6);
    expect(generateZoneGraph({ ...base, zoneCount: 1 })).toHaveLength(2);   // clamped up
    expect(generateZoneGraph({ ...base, zoneCount: 99 })).toHaveLength(14); // clamped down
  });

  it('assigns hub first and boss last', () => {
    const zs = generateZoneGraph(base);
    expect(zs[0].type).toBe('hub');
    expect(zs[zs.length - 1].type).toBe('boss');
  });

  it('linear topology connects each non-last zone to exactly the next', () => {
    const zs = generateZoneGraph({ ...base, topology: 'linear' });
    for (let i = 0; i < zs.length - 1; i++) expect(zs[i].connections).toEqual([zs[i + 1].id]);
    expect(zs[zs.length - 1].connections).toEqual([]);
  });

  it('hub-and-spoke connects the hub to every other zone', () => {
    const zs = generateZoneGraph({ ...base, topology: 'hub-and-spoke' });
    const others = zs.slice(1).map((z) => z.id);
    expect([...zs[0].connections].sort()).toEqual([...others].sort());
  });

  it('metroidvania adds more edges as branchiness rises', () => {
    const lo = generateZoneGraph({ ...base, topology: 'metroidvania', branchiness: 0 });
    const hi = generateZoneGraph({ ...base, topology: 'metroidvania', branchiness: 1 });
    expect(edgeCount(hi)).toBeGreaterThan(edgeCount(lo));
  });

  it('produces a monotonic non-inverted difficulty ramp', () => {
    const zs = generateZoneGraph(base);
    for (let i = 0; i < zs.length; i++) {
      expect(zs[i].levelMin).toBeLessThanOrEqual(zs[i].levelMax);
      if (i > 0) expect(zs[i].levelMin).toBeGreaterThanOrEqual(zs[i - 1].levelMin);
    }
  });
});

describe('validateZoneGraph', () => {
  it('reports zero errors for generated graphs across topologies and seeds', () => {
    for (const topology of ['linear', 'hub-and-spoke', 'metroidvania'] as const) {
      for (const seed of [1, 42, 777, 2026]) {
        const res = validateZoneGraph(generateZoneGraph({ ...base, topology, seed }));
        expect(res.errors).toBe(0);
        expect(res.ok).toBe(true);
        expect(res.perZone).toHaveLength(8);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/zone-graph-generator.test.ts`
Expected: FAIL — cannot resolve `@/lib/world/zone-graph-generator`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/world/zone-graph-generator.ts`:

```ts
import { createRNG } from '@/lib/seeded-rng';
import { lintZone, type ZoneFinding, type ZoneLike } from './zone-analysis';

export type ZoneTopology = 'linear' | 'hub-and-spoke' | 'metroidvania';
export type DifficultyCurve = 'gentle' | 'linear' | 'steep';

export interface ZoneGraphParams {
  zoneCount: number;
  branchiness: number;
  topology: ZoneTopology;
  difficulty: DifficultyCurve;
  maxLevel: number;
  seed: number;
}

/** Minimal renderable + lintable zone (structurally a MapZone + level fields). */
export interface GeneratedZone {
  id: string;
  displayName: string;
  cx: number;
  cy: number;
  type: 'hub' | 'combat' | 'boss';
  status: 'active' | 'locked' | 'completed';
  connections: string[];
  levelMin: number;
  levelMax: number;
  levelRange: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function ease(t: number, curve: DifficultyCurve): number {
  if (curve === 'steep') return t * t;        // slow start, big late jumps
  if (curve === 'gentle') return Math.sqrt(t); // big early, flattens
  return t;                                     // linear
}

function role(i: number, n: number): GeneratedZone['type'] {
  if (i === 0) return 'hub';
  if (i === n - 1) return 'boss';
  return 'combat';
}

function layout(i: number, n: number, topology: ZoneTopology, rng: () => number): { cx: number; cy: number } {
  if (topology === 'hub-and-spoke') {
    if (i === 0) return { cx: 50, cy: 50 };
    const angle = (2 * Math.PI * (i - 1)) / (n - 1);
    return { cx: clamp(50 + 38 * Math.cos(angle), 6, 94), cy: clamp(50 + 38 * Math.sin(angle), 6, 94) };
  }
  if (topology === 'metroidvania') {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = ((col + 0.5) / cols) * 84 + 8 + (rng() - 0.5) * 8;
    const cy = ((row + 0.5) / rows) * 84 + 8 + (rng() - 0.5) * 8;
    return { cx: clamp(cx, 6, 94), cy: clamp(cy, 6, 94) };
  }
  // linear
  const cx = n > 1 ? 8 + (i * 84) / (n - 1) : 50;
  return { cx: clamp(cx, 6, 94), cy: clamp(50 + (rng() - 0.5) * 24, 6, 94) };
}

function connect(zones: GeneratedZone[], topology: ZoneTopology, branchiness: number, rng: () => number): void {
  const n = zones.length;
  if (topology === 'linear') {
    for (let i = 0; i < n - 1; i++) zones[i].connections = [zones[i + 1].id];
    return;
  }
  if (topology === 'hub-and-spoke') {
    zones[0].connections = zones.slice(1).map((z) => z.id);
    for (let i = 1; i < n; i++) if (zones[i].type !== 'boss') zones[i].connections = [zones[0].id];
    return;
  }
  // metroidvania: spanning chain + branchiness-scaled forward cross edges
  for (let i = 0; i < n - 1; i++) zones[i].connections = [zones[i + 1].id];
  const extra = Math.round(clamp(branchiness, 0, 1) * (n - 2));
  for (let k = 0; k < extra; k++) {
    const from = Math.floor(rng() * (n - 2));            // 0..n-3
    const to = from + 2 + Math.floor(rng() * (n - from - 2)); // >= from+2
    if (to < n && !zones[from].connections.includes(zones[to].id)) {
      zones[from].connections.push(zones[to].id);
    }
  }
}

/** Deterministically generate a candidate zone graph. Pure (seeded RNG, no wall clock). */
export function generateZoneGraph(params: ZoneGraphParams): GeneratedZone[] {
  const n = clamp(Math.floor(params.zoneCount), 2, 14);
  const rng = createRNG(params.seed);
  const span = Math.max(1, params.maxLevel - 1);

  // Monotonic level bounds: bounds[i]..bounds[i+1] is zone i's window.
  const bounds: number[] = [];
  for (let i = 0; i <= n; i++) bounds.push(1 + Math.round(span * ease(Math.min(1, i / (n - 1)), params.difficulty)));

  const zones: GeneratedZone[] = [];
  for (let i = 0; i < n; i++) {
    const type = role(i, n);
    const { cx, cy } = layout(i, n, params.topology, rng);
    const levelMin = bounds[i];
    const levelMax = Math.max(bounds[i + 1], levelMin);
    zones.push({
      id: `g${i}`,
      displayName: type === 'hub' ? 'Hub' : type === 'boss' ? 'Boss Arena' : `Zone ${i}`,
      cx: Math.round(cx),
      cy: Math.round(cy),
      type,
      status: i === 0 ? 'active' : 'locked',
      connections: [],
      levelMin,
      levelMax,
      levelRange: levelMin === levelMax ? `${levelMin}` : `${levelMin}-${levelMax}`,
    });
  }
  connect(zones, params.topology, params.branchiness, rng);
  return zones;
}

export interface ZoneGraphValidation {
  perZone: { zoneId: string; findings: ZoneFinding[] }[];
  errors: number;
  warnings: number;
  ok: boolean;
}

/** Lint every generated zone through zone-analysis and aggregate. */
export function validateZoneGraph(zones: GeneratedZone[]): ZoneGraphValidation {
  const roster = zones as ZoneLike[];
  const perZone = zones.map((z) => ({ zoneId: z.id, findings: lintZone(z, roster) }));
  let errors = 0;
  let warnings = 0;
  for (const { findings } of perZone) {
    for (const f of findings) {
      if (f.severity === 'error') errors++;
      else if (f.severity === 'warn') warnings++;
    }
  }
  return { perZone, errors, warnings, ok: errors === 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/zone-graph-generator.test.ts`
Expected: PASS (8 tests). If `validateZoneGraph` reports errors, check that the chain keeps connections within the roster (all ids `g0..g{n-1}`) — dangling/unknown ids are the only `error` severity here.

- [ ] **Step 5: Commit**

```bash
git add src/lib/world/zone-graph-generator.ts src/__tests__/lib/zone-graph-generator.test.ts
git commit -m "feat(zone-procgen): deterministic zone-graph generator + validator"
```

---

## Task 2: procgen-db zone-pin persistence

**Files:**
- Modify: `src/types/procgen.ts`
- Modify: `src/lib/procgen-db.ts`
- Test: `src/__tests__/lib/procgen-db-zone-pins.test.ts`

- [ ] **Step 1: Add the type**

In `src/types/procgen.ts`, append:

```ts
import type { ZoneGraphParams } from '@/lib/world/zone-graph-generator';

export interface ZoneGraphPin {
  id: number;
  seed: number;
  params: ZoneGraphParams;
  label: string;
  zoneCount: number;
  topology: string;
  createdAt: string;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/lib/procgen-db-zone-pins.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// In-memory DB so the test never touches ~/.pof/pof.db (mirrors procgen-db.test.ts).
vi.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { saveZonePin, listZonePins, deleteZonePin } from '@/lib/procgen-db';
import type { ZoneGraphParams } from '@/lib/world/zone-graph-generator';

const params: ZoneGraphParams = {
  zoneCount: 8, branchiness: 0.5, topology: 'metroidvania', difficulty: 'linear', maxLevel: 30, seed: 42,
};

describe('procgen-db zone pins', () => {
  it('starts empty', () => {
    expect(listZonePins()).toEqual([]);
  });

  it('saves and lists pins newest-first with params parsed', () => {
    saveZonePin({ seed: 42, params, label: 'first', zoneCount: 8, topology: 'metroidvania' });
    saveZonePin({ seed: 99, params: { ...params, seed: 99 }, label: 'second', zoneCount: 8, topology: 'metroidvania' });
    const pins = listZonePins();
    expect(pins).toHaveLength(2);
    expect(pins[0].label).toBe('second');           // newest first
    expect(pins[0].params.seed).toBe(99);           // parsed object, not a string
    expect(pins[1].params.topology).toBe('metroidvania');
  });

  it('deletes a pin', () => {
    const pins = listZonePins();
    deleteZonePin(pins[0].id);
    expect(listZonePins().some((p) => p.id === pins[0].id)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/procgen-db-zone-pins.test.ts`
Expected: FAIL — `saveZonePin`/`listZonePins`/`deleteZonePin` are not exported.

- [ ] **Step 4: Add the CRUD to `procgen-db.ts`**

In `src/lib/procgen-db.ts`, change the import line to also import the pin type:

```ts
import type { ProcgenRun, ZoneGraphPin } from '@/types/procgen';
import type { ZoneGraphParams } from '@/lib/world/zone-graph-generator';
```

Then append at the end of the file:

```ts
function ensureZonePinTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS zone_graph_pins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seed INTEGER NOT NULL,
      params TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      zone_count INTEGER NOT NULL,
      topology TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function rowToPin(row: Record<string, unknown>): ZoneGraphPin {
  return {
    id: row.id as number,
    seed: row.seed as number,
    params: JSON.parse(row.params as string) as ZoneGraphParams,
    label: row.label as string,
    zoneCount: row.zone_count as number,
    topology: row.topology as string,
    createdAt: row.created_at as string,
  };
}

export function saveZonePin(input: {
  seed: number; params: ZoneGraphParams; label?: string; zoneCount: number; topology: string;
}): ZoneGraphPin {
  ensureZonePinTable();
  const db = getDb();
  const info = db
    .prepare('INSERT INTO zone_graph_pins (seed, params, label, zone_count, topology) VALUES (?, ?, ?, ?, ?)')
    .run(input.seed, JSON.stringify(input.params), input.label ?? '', input.zoneCount, input.topology);
  const row = db.prepare('SELECT * FROM zone_graph_pins WHERE id = ?').get(info.lastInsertRowid) as Record<string, unknown>;
  return rowToPin(row);
}

export function listZonePins(): ZoneGraphPin[] {
  ensureZonePinTable();
  const rows = getDb().prepare('SELECT * FROM zone_graph_pins ORDER BY id DESC').all() as Record<string, unknown>[];
  return rows.map(rowToPin);
}

export function deleteZonePin(id: number): void {
  ensureZonePinTable();
  getDb().prepare('DELETE FROM zone_graph_pins WHERE id = ?').run(id);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/procgen-db-zone-pins.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types/procgen.ts src/lib/procgen-db.ts src/__tests__/lib/procgen-db-zone-pins.test.ts
git commit -m "feat(zone-procgen): zone_graph_pins SQLite CRUD"
```

---

## Task 3: Zone-pins API route

**Files:**
- Create: `src/app/api/procgen/zone-pins/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/procgen/zone-pins/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { saveZonePin, listZonePins, deleteZonePin } from '@/lib/procgen-db';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function GET() {
  try {
    return apiSuccess(listZonePins());
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to list zone pins');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { seed, params, label, zoneCount, topology } = body;
    if (typeof seed !== 'number' || !params) return apiError('seed and params are required', 400);
    const pin = saveZonePin({
      seed,
      params,
      label,
      zoneCount: typeof zoneCount === 'number' ? zoneCount : (params.zoneCount ?? 0),
      topology: typeof topology === 'string' ? topology : (params.topology ?? ''),
    });
    return apiSuccess(pin);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to save zone pin');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return apiError('id query param is required', 400);
    deleteZonePin(id);
    return apiSuccess({ deleted: id });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to delete zone pin');
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "procgen/zone-pins" || echo "route OK"`
Expected: `route OK`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/procgen/zone-pins/route.ts
git commit -m "feat(zone-procgen): zone-pins GET/POST/DELETE API route"
```

---

## Task 4: Make ZoneMapCanvas generic over MapZone

**Files:**
- Modify: `src/components/modules/core-engine/sub_world/map/MapCanvas.tsx`

- [ ] **Step 1: Replace the type import + signature**

In `MapCanvas.tsx`, replace the `ZoneRecord` import line (`import type { ZoneRecord } from '../_shared/data';`) with an exported `MapZone` interface and make the props generic. Change:

```tsx
import type { ZoneRecord } from '../_shared/data';

const ACCENT = ACCENT_CYAN;

interface MapCanvasProps {
  zones: ZoneRecord[];
  selectedZone: ZoneRecord;
  onSelectZone: (z: ZoneRecord) => void;
  matchingIds?: Set<string>;
}

export function ZoneMapCanvas({ zones, selectedZone, onSelectZone, matchingIds }: MapCanvasProps) {
```

to:

```tsx
const ACCENT = ACCENT_CYAN;

/** The minimal zone shape the canvas renders. ZoneRecord is a structural superset. */
export interface MapZone {
  id: string;
  displayName: string;
  cx: number;
  cy: number;
  type: 'hub' | 'combat' | 'boss';
  status: 'active' | 'locked' | 'completed';
  connections: string[];
}

interface MapCanvasProps<Z extends MapZone> {
  zones: Z[];
  selectedZone: Z;
  onSelectZone: (z: Z) => void;
  matchingIds?: Set<string>;
}

export function ZoneMapCanvas<Z extends MapZone>({ zones, selectedZone, onSelectZone, matchingIds }: MapCanvasProps<Z>) {
```

The function body is unchanged (it only reads `id, displayName, cx, cy, type, status, connections`).

- [ ] **Step 2: Verify typecheck (existing caller still infers)**

Run: `npx tsc --noEmit 2>&1 | grep -E "MapCanvas|MapTopologyGroup" || echo "canvas OK"`
Expected: `canvas OK` (the `MapTopologyGroup` call infers `Z = ZoneRecord`).

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/core-engine/sub_world/map/MapCanvas.tsx
git commit -m "refactor(zone-map): make ZoneMapCanvas generic over a minimal MapZone"
```

---

## Task 5: ZoneGeneratorPanel + embed in the Map tab

**Files:**
- Create: `src/components/modules/core-engine/sub_world/map/ZoneGeneratorPanel.tsx`
- Modify: `src/components/modules/core-engine/sub_world/map/MapTopologyGroup.tsx`

- [ ] **Step 1: Write the panel**

Create `src/components/modules/core-engine/sub_world/map/ZoneGeneratorPanel.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Wand2, RefreshCw, Pin, Trash2 } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, ACCENT_VIOLET, withOpacity, OPACITY_10, OPACITY_30 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ZoneMapCanvas } from './MapCanvas';
import {
  generateZoneGraph, validateZoneGraph,
  type ZoneGraphParams, type ZoneTopology, type DifficultyCurve, type GeneratedZone,
} from '@/lib/world/zone-graph-generator';
import { useCRUD } from '@/hooks/useCRUD';
import { apiFetch } from '@/lib/api-utils';
import type { ZoneGraphPin } from '@/types/procgen';

const ACCENT = ACCENT_VIOLET;
const TOPOLOGIES: ZoneTopology[] = ['linear', 'hub-and-spoke', 'metroidvania'];
const CURVES: DifficultyCurve[] = ['gentle', 'linear', 'steep'];
const randomSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;

export function ZoneGeneratorPanel() {
  const [params, setParams] = useState<ZoneGraphParams>({
    zoneCount: 6, branchiness: 0.4, topology: 'metroidvania', difficulty: 'linear', maxLevel: 30, seed: 1337,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const zones = useMemo(() => generateZoneGraph(params), [params]);
  const validation = useMemo(() => validateZoneGraph(zones), [zones]);
  const selected: GeneratedZone = zones.find((z) => z.id === selectedId) ?? zones[0];

  const { data: pins, mutate } = useCRUD<ZoneGraphPin[]>('/api/procgen/zone-pins', []);

  const set = <K extends keyof ZoneGraphParams>(k: K, v: ZoneGraphParams[K]) => setParams((p) => ({ ...p, [k]: v }));
  const reroll = () => setParams((p) => ({ ...p, seed: randomSeed() }));
  const pinCurrent = () =>
    mutate('/api/procgen/zone-pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed: params.seed, params, label: `${params.topology} ×${params.zoneCount}`, zoneCount: params.zoneCount, topology: params.topology }),
    });
  const restorePin = (pin: ZoneGraphPin) => setParams(pin.params);
  const removePin = (id: number) => mutate(`/api/procgen/zone-pins?id=${id}`, { method: 'DELETE' });

  const statusColor = validation.errors > 0 ? STATUS_ERROR : validation.warnings > 0 ? STATUS_WARNING : STATUS_SUCCESS;

  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <SectionHeader icon={Wand2} label="Procedural Zone Generator" color={ACCENT} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
        {/* Controls */}
        <div className="space-y-3 text-xs">
          <label className="block">
            <span className="text-text-muted font-mono uppercase tracking-wider">Zones: {params.zoneCount}</span>
            <input type="range" min={2} max={14} value={params.zoneCount} onChange={(e) => set('zoneCount', Number(e.target.value))} className="w-full" style={{ accentColor: ACCENT }} />
          </label>
          <label className="block">
            <span className="text-text-muted font-mono uppercase tracking-wider">Branchiness: {params.branchiness.toFixed(2)}</span>
            <input type="range" min={0} max={1} step={0.05} value={params.branchiness} onChange={(e) => set('branchiness', Number(e.target.value))} className="w-full" style={{ accentColor: ACCENT }} />
          </label>
          <label className="block">
            <span className="text-text-muted font-mono uppercase tracking-wider">Topology</span>
            <select value={params.topology} onChange={(e) => set('topology', e.target.value as ZoneTopology)} className="w-full bg-surface-deep border border-border rounded px-2 py-1 text-text">
              {TOPOLOGIES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-text-muted font-mono uppercase tracking-wider">Difficulty curve</span>
            <select value={params.difficulty} onChange={(e) => set('difficulty', e.target.value as DifficultyCurve)} className="w-full bg-surface-deep border border-border rounded px-2 py-1 text-text">
              {CURVES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={reroll} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs" style={{ backgroundColor: withOpacity(ACCENT, OPACITY_10), color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_30)}` }}>
              <RefreshCw className="w-3 h-3" /> Reroll
            </button>
            <button onClick={pinCurrent} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs" style={{ backgroundColor: withOpacity(ACCENT, OPACITY_10), color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_30)}` }}>
              <Pin className="w-3 h-3" /> Pin
            </button>
            <span className="text-text-muted font-mono">seed {params.seed}</span>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2 space-y-2">
          <div className="w-full aspect-video bg-surface-deep/30 rounded-xl relative overflow-hidden border border-border/60 min-h-[200px]">
            <ZoneMapCanvas zones={zones} selectedZone={selected} onSelectZone={(z) => setSelectedId(z.id)} />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono" style={{ color: statusColor }} data-testid="zone-gen-validation">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
            {validation.ok ? 'Progression-valid' : `${validation.errors} error(s)`} · {validation.warnings} warning(s)
          </div>
        </div>
      </div>

      {/* Seed gallery */}
      {pins.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-2">Seed gallery</div>
          <div className="flex flex-wrap gap-2">
            {pins.map((pin) => (
              <span key={pin.id} className="flex items-center gap-1.5 text-xs bg-surface-hover px-2 py-1 rounded border border-border/40">
                <button onClick={() => restorePin(pin)} className="text-text hover:text-text" title="Restore this seed + params">
                  {pin.label || `seed ${pin.seed}`}
                </button>
                <button onClick={() => removePin(pin.id)} className="text-text-muted hover:text-text" title="Delete">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </BlueprintPanel>
  );
}
```

> If `apiFetch` ends up unused after the final edit, remove its import to satisfy lint (the panel uses `mutate`, not `apiFetch`, so drop the `import { apiFetch }` line).

- [ ] **Step 2: Embed it in the Map tab**

In `MapTopologyGroup.tsx`, add the import after the `TopologyGraph` import (line 18):

```tsx
import { ZoneGeneratorPanel } from './ZoneGeneratorPanel';
```

Then render it just before the closing `</>` of the component's return (immediately after `<TopologyGraph matchingIds={matchingIds} />`):

```tsx
      <ZoneGeneratorPanel />
```

- [ ] **Step 3: Remove the unused apiFetch import**

The panel only uses `mutate`. Delete the `import { apiFetch } from '@/lib/api-utils';` line from `ZoneGeneratorPanel.tsx`.

- [ ] **Step 4: Verify typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "ZoneGeneratorPanel|MapTopologyGroup" || echo "ui OK"`
Expected: `ui OK`.
Run: `npx eslint src/components/modules/core-engine/sub_world/map/ZoneGeneratorPanel.tsx src/components/modules/core-engine/sub_world/map/MapTopologyGroup.tsx src/components/modules/core-engine/sub_world/map/MapCanvas.tsx`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/modules/core-engine/sub_world/map/ZoneGeneratorPanel.tsx src/components/modules/core-engine/sub_world/map/MapTopologyGroup.tsx
git commit -m "feat(zone-procgen): generator panel + seed gallery in the World Map tab"
```

---

## Task 6: Validation + docs

- [ ] **Step 1: Run the new tests + typecheck my files**

Run: `npx vitest run src/__tests__/lib/zone-graph-generator.test.ts src/__tests__/lib/procgen-db-zone-pins.test.ts`
Expected: PASS (11 total).
Run: `npx tsc --noEmit 2>&1 | grep -E "zone-graph-generator|procgen-db|zone-pins|MapCanvas|ZoneGeneratorPanel|MapTopologyGroup|types/procgen" || echo "my files type-clean"`
Expected: `my files type-clean` (pre-existing foreign errors elsewhere are not mine).

- [ ] **Step 2: Docs sync**

Run: `git grep -ni "procgen.*log\|logs a roomcount" -- docs ':!docs/superpowers'`
If a doc describes `procgen-db` as logging-only, update it to mention the zone-graph generator + pins. If no match, no doc change needed.

- [ ] **Step 3: Done.** Feature complete when both test suites pass and my files are type/lint-clean. (UI panel rendering/interaction is not browser-verified in this environment — note that when reporting.)

---

## Self-Review notes

- **Spec coverage:** generator+validator (T1), pins persistence (T2), API (T3), generic canvas (T4), panel+embed (T5), validate+docs (T6). All spec sections covered.
- **Type consistency:** `ZoneGraphParams`/`GeneratedZone` defined in T1 and imported by T2/T5; `ZoneGraphPin` shape in T2 matches the route (T3) and panel (T5); `MapZone` (T4) is satisfied by `GeneratedZone`.
- **No placeholders:** every code step is complete.
- **React purity:** generation in `useMemo`; entropy only in the `reroll` handler.
