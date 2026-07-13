import { describe, it, expect } from 'vitest';
import {
  normalizePassRatePercent,
  resolveBudgetUsd,
  DEFAULT_BUDGET_USD,
  createDefaultConfig,
} from '@/lib/harness/orchestrator';
import { SCENARIOS, scenarioNames } from '@/lib/harness/scenarios';

// ── Direction 1a — pass-rate unit normalization ─────────────────────────────

describe('normalizePassRatePercent', () => {
  it('treats a 0–1 fraction as a fraction (×100)', () => {
    expect(normalizePassRatePercent(0.9)).toBe(90);
    expect(normalizePassRatePercent(0.5)).toBe(50);
    expect(normalizePassRatePercent(0.01)).toBe(1);
  });

  it('treats a value >1 as an already-percent', () => {
    expect(normalizePassRatePercent(90)).toBe(90);
    expect(normalizePassRatePercent(75)).toBe(75);
  });

  it('maps exactly 1 to 100% (a fraction, not 1%)', () => {
    expect(normalizePassRatePercent(1)).toBe(100);
  });

  it('clamps to [0,100] and handles junk', () => {
    expect(normalizePassRatePercent(150)).toBe(100);
    expect(normalizePassRatePercent(0)).toBe(0);
    expect(normalizePassRatePercent(-5)).toBe(0);
    expect(normalizePassRatePercent(NaN)).toBe(0);
  });

  it('is the fix for the MCP 0.9 → ~1% termination bug', () => {
    // An MCP caller passing the documented 0.9 must NOT terminate the loop the
    // moment 1% of features pass — 0.9 canonicalizes to a 90% target.
    expect(normalizePassRatePercent(0.9)).toBe(90);
  });
});

describe('createDefaultConfig — targetPassRate is canonicalized', () => {
  const base = { projectPath: 'C:/p', projectName: 'P', ueVersion: '5.8' };

  it('normalizes a 0–1 fraction to 0–100 percent', () => {
    expect(createDefaultConfig({ ...base, targetPassRate: 0.9 }).targetPassRate).toBe(90);
  });

  it('leaves a percent untouched and defaults to 90', () => {
    expect(createDefaultConfig({ ...base, targetPassRate: 80 }).targetPassRate).toBe(80);
    expect(createDefaultConfig({ ...base }).targetPassRate).toBe(90);
  });
});

// ── Direction 1d — default budget ceiling ───────────────────────────────────

describe('resolveBudgetUsd', () => {
  it('applies the default cap when no budget is given', () => {
    expect(resolveBudgetUsd(undefined, undefined)).toBe(DEFAULT_BUDGET_USD);
    expect(DEFAULT_BUDGET_USD).toBe(25);
  });

  it('applies the default cap for a 0 / null budget WITHOUT the unlimited opt-out', () => {
    expect(resolveBudgetUsd(0, undefined)).toBe(DEFAULT_BUDGET_USD);
    expect(resolveBudgetUsd(null, undefined)).toBe(DEFAULT_BUDGET_USD);
    expect(resolveBudgetUsd(null, false)).toBe(DEFAULT_BUDGET_USD);
  });

  it('honors an explicit positive budget', () => {
    expect(resolveBudgetUsd(5, undefined)).toBe(5);
    expect(resolveBudgetUsd(100, false)).toBe(100);
  });

  it('only removes the ceiling when unlimited:true is set explicitly', () => {
    expect(resolveBudgetUsd(undefined, true)).toBeNull();
    expect(resolveBudgetUsd(0, true)).toBeNull();
    expect(resolveBudgetUsd(null, true)).toBeNull();
  });

  it('createDefaultConfig threads the unlimited flag through', () => {
    const cfg = createDefaultConfig({ projectPath: 'C:/p', projectName: 'P', ueVersion: '5.8', unlimited: true });
    expect(cfg.unlimited).toBe(true);
  });
});

// ── Direction 1c — scenarios shared across every control surface ────────────

describe('SCENARIOS shared map', () => {
  it('exposes the curated area sets the CLI used to own privately', () => {
    expect(Object.keys(SCENARIOS).sort()).toEqual(['content-overhaul', 'ui-overhaul']);
    expect(scenarioNames().sort()).toEqual(['content-overhaul', 'ui-overhaul']);
  });

  it('each scenario reports a total matching its area count', () => {
    for (const def of Object.values(SCENARIOS)) {
      expect(def.areas.length).toBeGreaterThan(0);
      expect(def.total).toBe(def.areas.length);
    }
  });

  it('a scenario feeds config.areas through createDefaultConfig', () => {
    const areas = SCENARIOS['ui-overhaul'].areas;
    const cfg = createDefaultConfig({ projectPath: 'C:/p', projectName: 'P', ueVersion: '5.8', areas });
    expect(cfg.areas).toBe(areas);
  });
});

// ── Direction 1b — maxConcurrent survives into the executor config ──────────

describe('maxConcurrent is expressible through config', () => {
  it('preserves an executor maxConcurrent override', () => {
    const cfg = createDefaultConfig({
      projectPath: 'C:/p', projectName: 'P', ueVersion: '5.8',
      executor: {
        sessionTimeoutMs: 1000, maxRetriesPerArea: 3,
        allowedTools: ['Bash'], skipPermissions: true, bareMode: false,
        maxConcurrent: 4,
      },
    });
    expect(cfg.executor.maxConcurrent).toBe(4);
  });
});
