// scan-sweep --challenge catalog-core-infrastructure/B: the headless recipe stops presenting another
// entity's template as passing, and a submit names what settles its verdict and the entity's next step.
import { describe, it, expect, vi } from 'vitest';

// `submitStepArtifact` PERSISTS — this file states its own throwaway DB (see headless.test.ts).
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-headless-recipe-next-${process.pid}.db`;
});

import { buildStepRecipe, submitStepArtifact } from '@/lib/catalog/headless';
import { settlementOf } from '@/lib/catalog/stepSettlement';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { stepsForProfile } from '@/lib/catalog/stepScope';
import { upsertArtifact } from '@/lib/pipeline-artifacts-db';

const CAT = 'bestiary';
const EXEMPLAR = 'bestiary-melee-grunt';
const STEP0 = 'Concept & Role';

describe('buildStepRecipe — the example is honest about whose content it is', () => {
  it('a non-exemplar entity\'s data-blind example is stamped as the exemplar template and held pending', () => {
    const r = buildStepRecipe(CAT, 'bestiary-ranged-caster', STEP0, undefined, []);
    expect(r.example?.data.template).toEqual({ exemplar: EXEMPLAR, entity: 'bestiary-ranged-caster' });
    expect(r.acceptance.exampleStatus).toBe('pending');
    expect(r.acceptance.exampleReason?.startsWith('TEMPLATE')).toBe(true);
  });

  it('[guard] the exemplar\'s own example is unchanged: no template key, grades pass', () => {
    const r = buildStepRecipe(CAT, EXEMPLAR, STEP0, undefined, []);
    expect(r.example?.data).not.toHaveProperty('template');
    expect(r.acceptance.exampleStatus).toBe('pass');
  });
});

describe('buildStepRecipe — settle names what settles the current verdict', () => {
  const spec = (label: string) => getCatalogPipeline(CAT)!.steps.find((s) => s.label === label)!;

  it('a persisted L3 deferral carries the drain that settles it', () => {
    const reason = 'live-UE runner not yet run: VSBestiaryTest';
    upsertArtifact({ catalogId: CAT, entityId: 'bestiary-brute', step: 'Test Gate', data: { checks: [] }, ueAssets: [], status: 'deferred', tier: 'L3', reason });
    const r = buildStepRecipe(CAT, 'bestiary-brute', 'Test Gate', undefined, []);
    const verdict = { status: r.acceptance.currentStatus, tier: r.current?.tier, reason: r.acceptance.currentReason };
    expect(r.settle).toEqual(settlementOf(verdict, spec('Test Gate')));
    expect(r.settle).toMatchObject({ kind: 'drain', tool: 'pof_drain_gates', args: { tier: 'L3' } });
  });

  it('a current pass has nothing to settle', () => {
    upsertArtifact({ catalogId: CAT, entityId: 'bestiary-elite-knight', step: 'Lore / Codex', data: { lore: 'x' }, ueAssets: [], status: 'pass', tier: 'L0' });
    const r = buildStepRecipe(CAT, 'bestiary-elite-knight', 'Lore / Codex', undefined, []);
    expect(r.acceptance.currentStatus).toBe('pass');
    expect(r.settle).toBeNull();
  });
});

describe('submitStepArtifact — next names the settle and the entity\'s next step', () => {
  it('next.settle is the submitted verdict\'s settlement; entityStep is the ladder\'s pick (a fail at index 5)', () => {
    const entity = 'bestiary-ranged-caster';
    const steps = stepsForProfile(getCatalogPipeline(CAT)!, 'pof').map((s) => s.label);
    upsertArtifact({ catalogId: CAT, entityId: entity, step: steps[5], data: { abilities: [] }, ueAssets: [], status: 'fail', tier: 'L0', reason: 'no abilities' });
    const res = submitStepArtifact(CAT, entity, steps[0], {}, [], { policy: 'mcp-submit' });
    expect(res.next.settle).toEqual(settlementOf(res.acceptance));
    expect(res.next.entityStep).toEqual({ step: steps[5], priority: 'fail' });
  });

  it('[guard] artifact and acceptance are byte-identical to the pre-change response (only `next` is added)', () => {
    const { next, ...rest } = submitStepArtifact(CAT, EXEMPLAR, STEP0, {}, [], { policy: 'mcp-submit' });
    expect(next).toBeDefined();
    // Captured from the base tree (5b801322) for this exact submission on a fresh DB.
    expect(rest).toEqual({
      artifact: {
        catalogId: CAT, entityId: EXEMPLAR, step: STEP0,
        data: { _provenance: expect.any(Object) },
        ueAssets: [], status: 'pending', tier: 'L0',
        reason: 'field "brief" is 0 characters, needs ≥ 300',
      },
      acceptance: {
        status: 'pending', tier: 'L0', label: 'Brief ≥ 300 characters', detail: '0 / 300 chars',
        reason: 'field "brief" is 0 characters, needs ≥ 300',
      },
    });
  });
});
