import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import { buildRuntimeDeferredReason } from '@/types/observation';

// In-memory store backing the mocked artifacts DB (mirrors drain.test.ts).
const store = new Map<string, PipelineArtifact>();
const key = (c: string, e: string, s: string) => `${c}|${e}|${s}`;

vi.mock('@/lib/pipeline-artifacts-db', () => ({
  listDeferredArtifacts: (f?: { tier?: string; catalogId?: string; entityId?: string }) =>
    [...store.values()].filter((a) =>
      a.status === 'deferred' &&
      (!f?.tier || a.tier === f.tier) &&
      (!f?.catalogId || a.catalogId === f.catalogId) &&
      (!f?.entityId || a.entityId === f.entityId)),
}));

import {
  listPlannedTests,
  scaffoldAllPlanned,
  buildScaffoldTask,
} from '@/lib/ue-test-scaffold/plannedTests';

function seed(a: Partial<PipelineArtifact> & { catalogId: string; entityId: string; step: string; testName?: string }) {
  const { testName, ...rest } = a;
  const full = {
    data: {}, ueAssets: [], status: 'deferred', tier: 'L3',
    ...(testName ? { reason: buildRuntimeDeferredReason(testName) } : {}),
    ...rest,
  } as PipelineArtifact;
  store.set(key(full.catalogId, full.entityId, full.step), full);
}

beforeEach(() => store.clear());

describe('listPlannedTests', () => {
  it('lists deferred L3 gates carrying a recovered test name, flagged scaffoldAvailable', () => {
    seed({ catalogId: 'items', entityId: 'sword', step: 'TestGate', testName: 'VSItemsDefinitionsTest' });
    seed({ catalogId: 'currency', entityId: 'gold', step: 'TestGate', testName: 'PoF.Currency.WalletRules' });
    // A deferred row with NO recovered test name (e.g. an L4 visual reason) is excluded.
    seed({ catalogId: 'vfx', entityId: 'fx', step: 'VisualGate', reason: 'RHI+Gemini visual check not yet run', tier: 'L4' });

    const planned = listPlannedTests();
    expect(planned).toHaveLength(2);
    expect(planned.map((p) => p.testName).sort()).toEqual(['PoF.Currency.WalletRules', 'VSItemsDefinitionsTest']);
    expect(planned.every((p) => p.scaffoldAvailable)).toBe(true);
  });

  it('honors the drain filter', () => {
    seed({ catalogId: 'items', entityId: 'sword', step: 'TestGate', testName: 'VSItemsDefinitionsTest' });
    seed({ catalogId: 'currency', entityId: 'gold', step: 'TestGate', testName: 'PoF.Currency.WalletRules' });
    expect(listPlannedTests({ catalogId: 'items' })).toHaveLength(1);
  });
});

describe('scaffoldAllPlanned', () => {
  it('de-duplicates by test name and generates a scaffold per name', () => {
    // Two entities in the SAME catalog request the same gate name — one scaffold, two requesters.
    seed({ catalogId: 'items', entityId: 'sword', step: 'TestGate', testName: 'VSItemsDefinitionsTest' });
    seed({ catalogId: 'items', entityId: 'shield', step: 'TestGate', testName: 'VSItemsDefinitionsTest' });
    seed({ catalogId: 'currency', entityId: 'gold', step: 'TestGate', testName: 'PoF.Currency.WalletRules' });

    const scaffolds = scaffoldAllPlanned();
    expect(scaffolds).toHaveLength(2);
    const items = scaffolds.find((s) => s.testName === 'VSItemsDefinitionsTest')!;
    expect(items.requestedBy).toHaveLength(2);
    expect(items.scaffold.code).toContain('IMPLEMENT_SIMPLE_AUTOMATION_TEST(');
    expect(items.scaffold.parsed.registeredName).toContain('VSItemsDefinitionsTest');
  });
});

describe('buildScaffoldTask', () => {
  it('creates an ask-claude CLI task carrying the scaffold + target path + registered name', () => {
    seed({ catalogId: 'items', entityId: 'sword', step: 'TestGate', testName: 'VSItemsDefinitionsTest' });
    const sf = scaffoldAllPlanned()[0];
    const task = buildScaffoldTask(sf);
    expect(task.type).toBe('ask-claude');
    expect(task.label).toContain('VSItemsDefinitionsTest');
    expect(task.prompt).toContain('Source/PoF/Test/');
    expect(task.prompt).toContain('IMPLEMENT_SIMPLE_AUTOMATION_TEST(');
    expect(task.prompt).toContain('Automation RunTests VSItemsDefinitionsTest');
    expect(task.prompt).toContain('items/sword/TestGate'); // the requesting deferred gate
  });
});
