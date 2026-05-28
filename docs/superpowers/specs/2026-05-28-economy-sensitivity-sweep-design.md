# Economy parameter sensitivity sweep — clean core

**Date:** 2026-05-28
**Backlog item:** `idea-de8f9f47-parameter-sensitivity-sweep-to`
**Status:** Design approved — **clean core only** (the tornado-chart UI in `EconomySimulatorView`
is deferred because that file is being edited by a concurrent session).

## Problem

The economy simulator is descriptive ("what happened") but not prescriptive ("which knob to
turn"). Designers face dozens of faucets/sinks and can't see which few dominate inflation /
inequality.

## Goal (this slice)

A pure, deterministic **sensitivity-sweep engine**: vary one faucet/sink `baseAmount` at a
time across a ± range, re-run the seeded `runSimulation`, measure how much a chosen output
moves, and rank parameters by that swing — i.e. the data a tornado chart needs. The chart UI
is a later slice (blocked on the foreign `EconomySimulatorView`).

## Architecture — `src/lib/economy/sensitivity-sweep.ts` (new, pure)

```ts
export type SweepOutput = 'gini' | 'netFlow' | 'criticalAlerts';

export interface TornadoEntry {
  paramId: string;
  label: string;
  kind: 'faucet' | 'sink';
  baseValue: number;          // the flow's default baseAmount
  lowValue: number;           // baseAmount at -range
  highValue: number;          // baseAmount at +range
  low: number;                // output metric with lowValue
  high: number;               // output metric with highValue
  delta: number;              // |high - low| — the tornado bar width
}

export interface SweepResult {
  output: SweepOutput;
  range: number;
  baseline: number;           // output with no overrides
  entries: TornadoEntry[];    // sorted by delta desc
}

export function runSensitivitySweep(
  config: SimulationConfig,
  opts: { output: SweepOutput; range?: number; params?: EconomyFlow[] },
): SweepResult;
```

- **Output extraction** from a `SimulationResult`:
  - `gini` → last `metrics[].giniCoefficient` (endgame inequality)
  - `netFlow` → last `metrics[].netFlowPerHour`
  - `criticalAlerts` → `alerts.filter(a => a.severity === 'critical').length`
- **Per parameter** (default `params = getAllFlows()` = faucets + sinks): run the engine with
  `flowOverrides = [{ id, baseAmount: baseValue × (1 ± range) }]` for the low and high ends,
  extract the output, `delta = |high − low|`. (Overrides set the raw `baseAmount` via the
  engine's existing `flowOverrides` path; low and high bypass the philosophy multiplier
  identically, so the per-param delta is a clean signal.)
- **Baseline** = one run with no overrides.
- Entries sorted by `delta` desc (tornado order: biggest lever first).
- **Deterministic:** `runSimulation` is seeded; only `durationMs`/`completedAt` use the wall
  clock and those are not read here — so identical inputs → identical entries.

Items are **not** swept this slice: the engine has no item-parameter override path (only
`flowOverrides`), and the backlog's concrete example is faucet/sink `baseAmount`.

## File-by-file impact

| File | Change |
|------|--------|
| `src/lib/economy/sensitivity-sweep.ts` | **new** — the sweep engine |
| `src/__tests__/lib/economy-sensitivity-sweep.test.ts` | **new** |

Deferred (foreign-dirty, later slice): a `tornado` action on `/api/economy-simulator` and a
tornado-chart panel in `EconomySimulatorView`.

## Test plan (TDD)

Use a **tiny** config (e.g. `agentCount: 5, maxPlayHours: 6, maxLevel: 4, seed: 7,
philosophy: 'balanced'`) and 2–3 params so the test runs fast:

1. One entry per param; `entries.length === params.length`.
2. Sorted by `delta` desc (`entries[i].delta >= entries[i+1].delta`).
3. Each entry: `lowValue < baseValue < highValue` and `delta === |high − low|`.
4. **Determinism:** two calls deep-equal.
5. **Correctness:** for a strong faucet (`enemy-kill-gold`) with `output: 'netFlow'`,
   `high >= low` (more gold source → higher net flow) — validates the override path is wired
   to the right parameter.

Run `npm run validate` — my files type/lint/test-clean (foreign tree failures excluded).
