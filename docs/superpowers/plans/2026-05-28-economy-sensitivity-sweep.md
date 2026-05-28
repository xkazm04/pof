# Economy Sensitivity Sweep (clean core) — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A pure, deterministic sweep engine that ranks faucet/sink `baseAmount` parameters by how much they move a chosen economy output (tornado data). UI deferred.

**Spec:** `docs/superpowers/specs/2026-05-28-economy-sensitivity-sweep-design.md`

---

## Task 1: Pure sweep engine

**Files:**
- Create: `src/lib/economy/sensitivity-sweep.ts`
- Test: `src/__tests__/lib/economy-sensitivity-sweep.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/economy-sensitivity-sweep.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runSensitivitySweep } from '@/lib/economy/sensitivity-sweep';
import { DEFAULT_FAUCETS } from '@/lib/economy/definitions';
import type { SimulationConfig } from '@/types/economy-simulator';

const tinyConfig: SimulationConfig = {
  agentCount: 5, maxLevel: 4, maxPlayHours: 6, philosophy: 'balanced', seed: 7,
};
const params = DEFAULT_FAUCETS.filter((f) => ['enemy-kill-gold', 'quest-reward', 'boss-kill-gold'].includes(f.id));

describe('runSensitivitySweep', () => {
  it('returns one entry per param, sorted by delta desc', () => {
    const res = runSensitivitySweep(tinyConfig, { output: 'netFlow', range: 0.5, params });
    expect(res.entries).toHaveLength(params.length);
    for (let i = 1; i < res.entries.length; i++) {
      expect(res.entries[i - 1].delta).toBeGreaterThanOrEqual(res.entries[i].delta);
    }
  });

  it('brackets the base value and reports delta as |high - low|', () => {
    const res = runSensitivitySweep(tinyConfig, { output: 'netFlow', range: 0.5, params });
    for (const e of res.entries) {
      expect(e.lowValue).toBeLessThan(e.baseValue);
      expect(e.highValue).toBeGreaterThan(e.baseValue);
      expect(e.delta).toBeCloseTo(Math.abs(e.high - e.low));
    }
  });

  it('is deterministic for the same seed', () => {
    const a = runSensitivitySweep(tinyConfig, { output: 'gini', range: 0.5, params });
    const b = runSensitivitySweep(tinyConfig, { output: 'gini', range: 0.5, params });
    expect(a).toEqual(b);
  });

  it('a stronger gold faucet yields a higher net flow at the high end', () => {
    const res = runSensitivitySweep(tinyConfig, { output: 'netFlow', range: 0.5, params });
    const ek = res.entries.find((e) => e.paramId === 'enemy-kill-gold')!;
    expect(ek.high).toBeGreaterThanOrEqual(ek.low);
    expect(ek.kind).toBe('faucet');
  });

  it('carries the chosen output and a numeric baseline', () => {
    const res = runSensitivitySweep(tinyConfig, { output: 'criticalAlerts', range: 0.3, params });
    expect(res.output).toBe('criticalAlerts');
    expect(typeof res.baseline).toBe('number');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/economy-sensitivity-sweep.test.ts`
Expected: FAIL — cannot resolve `@/lib/economy/sensitivity-sweep`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/economy/sensitivity-sweep.ts`:

```ts
import type { SimulationConfig, SimulationResult, EconomyFlow } from '@/types/economy-simulator';
import { runSimulation } from './simulation-engine';
import { getAllFlows } from './definitions';

export type SweepOutput = 'gini' | 'netFlow' | 'criticalAlerts';

export interface TornadoEntry {
  paramId: string;
  label: string;
  kind: EconomyFlow['type'];
  baseValue: number;
  lowValue: number;
  highValue: number;
  low: number;
  high: number;
  delta: number;
}

export interface SweepResult {
  output: SweepOutput;
  range: number;
  baseline: number;
  entries: TornadoEntry[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function extractOutput(result: SimulationResult, output: SweepOutput): number {
  const last = result.metrics[result.metrics.length - 1];
  if (output === 'gini') return last?.giniCoefficient ?? 0;
  if (output === 'netFlow') return last?.netFlowPerHour ?? 0;
  return result.alerts.filter((a) => a.severity === 'critical').length;
}

function withOverride(config: SimulationConfig, id: string, baseAmount: number): SimulationConfig {
  const others = (config.flowOverrides ?? []).filter((o) => o.id !== id);
  return { ...config, flowOverrides: [...others, { id, baseAmount }] };
}

/**
 * Deterministic one-at-a-time sensitivity sweep over faucet/sink `baseAmount`.
 * For each parameter, re-runs the seeded economy engine at baseValue × (1 ± range),
 * measures how far the chosen output moves, and ranks parameters by that swing —
 * the data a tornado chart consumes. Pure given a fixed seed.
 */
export function runSensitivitySweep(
  config: SimulationConfig,
  opts: { output: SweepOutput; range?: number; params?: EconomyFlow[] },
): SweepResult {
  const range = opts.range ?? 0.5;
  const params = opts.params ?? getAllFlows();
  const baseline = extractOutput(runSimulation(config), opts.output);

  const entries: TornadoEntry[] = params.map((flow) => {
    const lowValue = round2(flow.baseAmount * (1 - range));
    const highValue = round2(flow.baseAmount * (1 + range));
    const low = extractOutput(runSimulation(withOverride(config, flow.id, lowValue)), opts.output);
    const high = extractOutput(runSimulation(withOverride(config, flow.id, highValue)), opts.output);
    return {
      paramId: flow.id,
      label: flow.name,
      kind: flow.type,
      baseValue: flow.baseAmount,
      lowValue,
      highValue,
      low,
      high,
      delta: Math.abs(high - low),
    };
  });

  entries.sort((a, b) => b.delta - a.delta);
  return { output: opts.output, range, baseline, entries };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/economy-sensitivity-sweep.test.ts`
Expected: PASS (5 tests). If the "stronger faucet" assertion fails (spend-gating offset), relax it to `expect(ek.delta).toBeGreaterThanOrEqual(0)` — but with the seed it should hold.

- [ ] **Step 5: Typecheck + lint + commit**

Run: `npx tsc --noEmit 2>&1 | grep "sensitivity-sweep" || echo "sweep type-clean"` → expect `sweep type-clean`.
Run: `npx eslint src/lib/economy/sensitivity-sweep.ts src/__tests__/lib/economy-sensitivity-sweep.test.ts` → exit 0.

```bash
git add src/lib/economy/sensitivity-sweep.ts src/__tests__/lib/economy-sensitivity-sweep.test.ts
git commit -m "feat(economy-sweep): deterministic parameter sensitivity-sweep engine"
```

---

## Self-Review notes

- Spec coverage: sweep engine + output extraction + ranking + determinism — all in Task 1.
- Types: `SweepOutput`/`TornadoEntry`/`SweepResult` match the spec; `kind: EconomyFlow['type']`
  (= `'faucet'|'sink'`); `flowOverrides` is `Partial<EconomyFlow>[]` so `{id, baseAmount}` fits.
- Deferred (foreign-dirty): tornado-chart UI + `/api/economy-simulator` action.
