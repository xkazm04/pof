# Living Health Map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Health Map" tab in the Crash Analyzer rendering crash-affected modules as a deterministic hot-core risk map (size ∝ crash count, color ∝ severity, hover card of top patterns).

**Architecture:** A pure DOM-free lib derives per-module health + a phyllotaxis layout; an SVG view renders it; one tab is added to the existing `CrashAnalyzerView`.

**Tech Stack:** React 19, framer-motion, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-28-living-health-map-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/crash-health/health-map.ts` | **new** — `buildModuleHealth` + `layoutHealthMap` (pure) |
| `src/components/modules/evaluator/CrashHealthMap.tsx` | **new** — SVG risk map + hover card |
| `src/components/modules/evaluator/CrashAnalyzerView.tsx` | **modify** — Health Map tab |
| `src/__tests__/lib/health-map.test.ts` | **new** |
| `src/__tests__/components/CrashHealthMap.test.tsx` | **new** |

---

## Task 1: Pure health-map lib

**Files:**
- Create: `src/lib/crash-health/health-map.ts`
- Test: `src/__tests__/lib/health-map.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/health-map.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildModuleHealth, layoutHealthMap, type ModuleHealthNode } from '@/lib/crash-health/health-map';

const reports = [
  { id: 'c1', mappedModule: 'arpg-character', severity: 'critical' as const },
  { id: 'c2', mappedModule: 'arpg-character', severity: 'high' as const },
  { id: 'c3', mappedModule: 'arpg-character', severity: 'low' as const },
  { id: 'c4', mappedModule: 'arpg-combat', severity: 'low' as const },
];
const patterns = [
  { name: 'Null in HandleDeath', occurrences: 3, isSystemic: true, crashIds: ['c1', 'c2'] },
  { name: 'Bigger', occurrences: 5, isSystemic: false, crashIds: ['c3'] },
  { name: 'Combat ensure', occurrences: 2, isSystemic: false, crashIds: ['c4'] },
];

describe('buildModuleHealth', () => {
  const nodes = buildModuleHealth({ reports, patterns });

  it('ranks the higher-risk module first', () => {
    expect(nodes[0].moduleId).toBe('arpg-character');
    expect(nodes[0].riskScore).toBeGreaterThan(nodes[1].riskScore);
  });

  it('counts crashes and worst severity per module', () => {
    expect(nodes[0].crashCount).toBe(3);
    expect(nodes[0].maxSeverity).toBe('critical');
    const combat = nodes.find((n) => n.moduleId === 'arpg-combat')!;
    expect(combat.crashCount).toBe(1);
    expect(combat.maxSeverity).toBe('low');
  });

  it('attributes patterns to a module, sorted by occurrences and capped at 3', () => {
    expect(nodes[0].patternCount).toBe(2);
    expect(nodes[0].topPatterns[0].name).toBe('Bigger');      // 5 > 3
    expect(nodes[0].topPatterns[1].name).toBe('Null in HandleDeath');
    expect(nodes[0].topPatterns.length).toBeLessThanOrEqual(3);
    expect(nodes[0].systemicCount).toBe(1);
  });
});

describe('layoutHealthMap', () => {
  const nodes: ModuleHealthNode[] = [
    { moduleId: 'a', crashCount: 10, riskScore: 20, maxSeverity: 'critical', patternCount: 0, systemicCount: 0, topPatterns: [] },
    { moduleId: 'b', crashCount: 2, riskScore: 5, maxSeverity: 'low', patternCount: 0, systemicCount: 0, topPatterns: [] },
    { moduleId: 'c', crashCount: 5, riskScore: 10, maxSeverity: 'high', patternCount: 0, systemicCount: 0, topPatterns: [] },
  ];

  it('is deterministic and preserves node count', () => {
    const a = layoutHealthMap(nodes, { width: 640, height: 420 });
    expect(a).toEqual(layoutHealthMap(nodes, { width: 640, height: 420 }));
    expect(a).toHaveLength(3);
  });

  it('places the highest-risk node at the centre', () => {
    const pos = layoutHealthMap(nodes, { width: 640, height: 420 });
    expect(pos[0].node.moduleId).toBe('a');
    expect(pos[0].x).toBeCloseTo(320);
    expect(pos[0].y).toBeCloseTo(210);
  });

  it('sizes node radius by crash count', () => {
    const pos = layoutHealthMap(nodes, { width: 640, height: 420 });
    const ra = pos.find((p) => p.node.moduleId === 'a')!.r;
    const rb = pos.find((p) => p.node.moduleId === 'b')!.r;
    expect(ra).toBeGreaterThan(rb);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/health-map.test.ts`
Expected: FAIL — cannot resolve `@/lib/crash-health/health-map`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/crash-health/health-map.ts`:

```ts
import type { CrashReport, CrashPattern, CrashSeverity } from '@/types/crash-analyzer';

type HealthReport = Pick<CrashReport, 'id' | 'mappedModule' | 'severity'>;
type HealthPattern = Pick<CrashPattern, 'crashIds' | 'occurrences' | 'name' | 'isSystemic'>;

export interface ModulePattern {
  name: string;
  occurrences: number;
  isSystemic: boolean;
}

export interface ModuleHealthNode {
  moduleId: string;
  crashCount: number;
  riskScore: number;
  maxSeverity: CrashSeverity | 'none';
  patternCount: number;
  systemicCount: number;
  topPatterns: ModulePattern[];
}

export interface PositionedHealthNode {
  node: ModuleHealthNode;
  x: number;
  y: number;
  r: number;
}

const SEV_WEIGHT: Record<CrashSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const SEV_RANK: CrashSeverity[] = ['low', 'medium', 'high', 'critical'];

function worse(a: CrashSeverity | 'none', b: CrashSeverity): CrashSeverity {
  if (a === 'none') return b;
  return SEV_RANK.indexOf(b) > SEV_RANK.indexOf(a) ? b : a;
}

/** Aggregate per-module crash health from reports + detected patterns. Pure. */
export function buildModuleHealth(input: { reports: HealthReport[]; patterns: HealthPattern[] }): ModuleHealthNode[] {
  const moduleOf = new Map<string, string>();
  const byModule = new Map<string, HealthReport[]>();
  for (const r of input.reports) {
    const m = r.mappedModule ?? 'unmapped';
    moduleOf.set(r.id, m);
    const list = byModule.get(m);
    if (list) list.push(r); else byModule.set(m, [r]);
  }

  const patternsByModule = new Map<string, ModulePattern[]>();
  for (const p of input.patterns) {
    const mods = new Set<string>();
    for (const cid of p.crashIds) { const m = moduleOf.get(cid); if (m) mods.add(m); }
    for (const m of mods) {
      const arr = patternsByModule.get(m) ?? [];
      arr.push({ name: p.name, occurrences: p.occurrences, isSystemic: p.isSystemic });
      patternsByModule.set(m, arr);
    }
  }

  const nodes: ModuleHealthNode[] = [];
  for (const [moduleId, mreports] of byModule) {
    let maxSeverity: CrashSeverity | 'none' = 'none';
    let weightSum = 0;
    for (const r of mreports) { weightSum += SEV_WEIGHT[r.severity]; maxSeverity = worse(maxSeverity, r.severity); }
    const pats = (patternsByModule.get(moduleId) ?? []).slice().sort((a, b) => b.occurrences - a.occurrences);
    const systemicCount = pats.filter((p) => p.isSystemic).length;
    nodes.push({
      moduleId,
      crashCount: mreports.length,
      riskScore: weightSum + 2 * systemicCount,
      maxSeverity,
      patternCount: pats.length,
      systemicCount,
      topPatterns: pats.slice(0, 3),
    });
  }
  return nodes.sort((a, b) => b.riskScore - a.riskScore);
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Deterministic phyllotaxis risk-map layout: highest risk at the centre, spiralling out. Pure. */
export function layoutHealthMap(nodes: ModuleHealthNode[], opts: { width: number; height: number }): PositionedHealthNode[] {
  const sorted = nodes.slice().sort((a, b) => b.riskScore - a.riskScore);
  const cx = opts.width / 2;
  const cy = opts.height / 2;
  const margin = 24;
  const minR = 10;
  const maxR = 34;
  const maxCrash = Math.max(1, ...sorted.map((n) => n.crashCount));
  const usable = Math.max(1, Math.min(opts.width, opts.height) / 2 - margin - maxR);
  const spread = usable / Math.max(1, Math.sqrt(Math.max(1, sorted.length - 1)));
  return sorted.map((node, i) => {
    const radius = spread * Math.sqrt(i);
    const angle = i * GOLDEN_ANGLE;
    const r = minR + (maxR - minR) * Math.sqrt(node.crashCount / maxCrash);
    return { node, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), r };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/health-map.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/crash-health/health-map.ts src/__tests__/lib/health-map.test.ts
git commit -m "feat(health-map): pure per-module crash-health aggregation + risk-map layout"
```

---

## Task 2: CrashHealthMap view + component test

**Files:**
- Create: `src/components/modules/evaluator/CrashHealthMap.tsx`
- Test: `src/__tests__/components/CrashHealthMap.test.tsx`

- [ ] **Step 1: Write the view**

Create `src/components/modules/evaluator/CrashHealthMap.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { SEVERITY_TOKENS, STATUS_LOCKED } from '@/lib/chart-colors';
import { buildModuleHealth, layoutHealthMap } from '@/lib/crash-health/health-map';
import type { CrashReport, CrashPattern } from '@/types/crash-analyzer';

const VW = 640;
const VH = 420;

function nodeColor(maxSeverity: string): string {
  const tok = (SEVERITY_TOKENS as Record<string, { color: string }>)[maxSeverity];
  return tok?.color ?? STATUS_LOCKED;
}

export function CrashHealthMap({ reports, patterns }: { reports: CrashReport[]; patterns: CrashPattern[] }) {
  const nodes = useMemo(() => buildModuleHealth({ reports, patterns }), [reports, patterns]);
  const positioned = useMemo(() => layoutHealthMap(nodes, { width: VW, height: VH }), [nodes]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = positioned.find((p) => p.node.moduleId === activeId)?.node ?? null;

  if (nodes.length === 0) {
    return <div className="text-center py-10 text-sm text-text-muted">No crash data to map yet.</div>;
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" className="rounded-xl border border-border bg-surface-deep/40" role="img" aria-label="Module crash health map">
        {positioned.map((p) => {
          const color = nodeColor(p.node.maxSeverity);
          const breathing = p.node.systemicCount > 0 || p.node.maxSeverity === 'critical';
          return (
            <g
              key={p.node.moduleId}
              data-testid="health-node"
              transform={`translate(${p.x}, ${p.y})`}
              onMouseEnter={() => setActiveId(p.node.moduleId)}
              onClick={() => setActiveId(p.node.moduleId)}
              style={{ cursor: 'pointer' }}
            >
              <motion.circle
                r={p.r}
                fill={color}
                fillOpacity={0.25}
                stroke={color}
                strokeWidth={activeId === p.node.moduleId ? 3 : 1.5}
                animate={breathing ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={breathing ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
                style={{ transformOrigin: 'center' }}
              />
              <text textAnchor="middle" dy={p.r + 12} fontSize={11} className="font-mono" fill="var(--text-muted)">
                {p.node.moduleId.replace(/^arpg-/, '')}
              </text>
              <text textAnchor="middle" dy={4} fontSize={12} fontWeight={700} fill="var(--text)">
                {p.node.crashCount}
              </text>
            </g>
          );
        })}
      </svg>

      {active && (
        <div className="mt-3 rounded-lg border border-border bg-surface p-3" data-testid="health-card">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">{active.moduleId}</span>
            <span className="text-xs font-mono" style={{ color: nodeColor(active.maxSeverity) }}>
              {active.crashCount} crash{active.crashCount === 1 ? '' : 'es'} · {active.maxSeverity}
            </span>
          </div>
          {active.topPatterns.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {active.topPatterns.map((pat) => (
                <li key={pat.name} className="text-xs text-text-muted flex items-center gap-2">
                  <span className="flex-1 truncate">{pat.name}</span>
                  <span className="font-mono">×{pat.occurrences}</span>
                  {pat.isSystemic && <span className="text-2xs px-1 rounded" style={{ color: nodeColor('critical') }}>systemic</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-text-muted italic">No recurring patterns in this module.</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the component test**

Create `src/__tests__/components/CrashHealthMap.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { CrashHealthMap } from '@/components/modules/evaluator/CrashHealthMap';
import type { CrashReport, CrashPattern } from '@/types/crash-analyzer';

const r = (id: string, mappedModule: string, severity: CrashReport['severity']): CrashReport =>
  ({ id, mappedModule, severity } as CrashReport);

describe('CrashHealthMap', () => {
  afterEach(cleanup);

  it('renders one node per crash-affected module with the module label', () => {
    const reports = [r('c1', 'arpg-character', 'critical'), r('c2', 'arpg-character', 'high'), r('c3', 'arpg-combat', 'low')];
    render(<CrashHealthMap reports={reports} patterns={[] as CrashPattern[]} />);
    expect(screen.getAllByTestId('health-node')).toHaveLength(2);
    expect(screen.getByText('character')).toBeTruthy();
  });

  it('shows an empty hint when there is no crash data', () => {
    render(<CrashHealthMap reports={[]} patterns={[]} />);
    expect(screen.queryAllByTestId('health-node')).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run the component test**

Run: `npx vitest run src/__tests__/components/CrashHealthMap.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/evaluator/CrashHealthMap.tsx src/__tests__/components/CrashHealthMap.test.tsx
git commit -m "feat(health-map): SVG risk-map view with per-module hover card"
```

---

## Task 3: Wire the Health Map tab into CrashAnalyzerView

**Files:**
- Modify: `src/components/modules/evaluator/CrashAnalyzerView.tsx`

- [ ] **Step 1: Import the view**

After the `useCrashAnalyzerStore` import (line 16), add:

```tsx
import { CrashHealthMap } from './CrashHealthMap';
```

- [ ] **Step 2: Extend the ViewTab union**

Change line 61 from:

```tsx
type ViewTab = 'crashes' | 'patterns' | 'import';
```

to:

```tsx
type ViewTab = 'crashes' | 'patterns' | 'import' | 'health';
```

- [ ] **Step 3: Add the sub-tab button**

After the Patterns `<SubTab .../>` (line ~188), add:

```tsx
          <SubTab label="Health Map" active={viewTab === 'health'} onClick={() => setViewTab('health')} />
```

- [ ] **Step 4: Add the render block**

Immediately after the Import-tab render block (`{hasData && viewTab === 'import' && (<ImportPanel />)}`, ~line 293), add:

```tsx
      {hasData && viewTab === 'health' && (
        <CrashHealthMap reports={reports} patterns={patterns} />
      )}
```

- [ ] **Step 5: Verify typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "CrashAnalyzerView|CrashHealthMap" || echo "wired OK"`
Expected: `wired OK`.
Run: `npx eslint src/components/modules/evaluator/CrashAnalyzerView.tsx src/components/modules/evaluator/CrashHealthMap.tsx src/lib/crash-health/health-map.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/modules/evaluator/CrashAnalyzerView.tsx
git commit -m "feat(health-map): add Health Map tab to the Crash Analyzer"
```

---

## Task 4: Validation + docs

- [ ] **Step 1: Run the new tests + typecheck my files**

Run: `npx vitest run src/__tests__/lib/health-map.test.ts src/__tests__/components/CrashHealthMap.test.tsx`
Expected: PASS (8 total).
Run: `npx tsc --noEmit 2>&1 | grep -E "health-map|CrashHealthMap|CrashAnalyzerView" || echo "my files type-clean"`
Expected: `my files type-clean`.

- [ ] **Step 2: Docs sync**

Run: `git grep -ni "crash analyzer" -- docs ':!docs/superpowers'`
If a doc enumerates Crash Analyzer tabs/features, add the Health Map. If no match, no doc change needed.

- [ ] **Step 3: Done.** Feature complete when both suites pass and my files are type/lint-clean. (The SVG view's hover interaction is not browser-verified in this environment — note that when reporting.)

---

## Self-Review notes

- **Spec coverage:** pure lib (T1), view + component test (T2), tab wiring (T3), validate/docs (T4).
- **Type consistency:** `ModuleHealthNode`/`PositionedHealthNode` from T1 used by T2; `buildModuleHealth` input shape (`Pick`) is satisfied by full `CrashReport[]`/`CrashPattern[]` passed from the view.
- **No placeholders:** all code/commands complete.
- **No hardcoded hex:** colors via `SEVERITY_TOKENS` + `STATUS_LOCKED` + CSS vars.
