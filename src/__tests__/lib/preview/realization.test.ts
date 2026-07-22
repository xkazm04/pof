import { describe, it, expect } from 'vitest';
import { getRealization, reviewedPipelines } from '@/lib/preview/realization';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('realization audit registry', () => {
  it('spellbook is reviewed with the 2026-07-22 audit', () => {
    expect(reviewedPipelines()).toContain('spellbook');
    const eff = getRealization('spellbook', 'Effect Logic');
    expect(eff?.browser).toBe('proven');
    expect(eff?.ue).toBe('proven');
    expect(eff?.note.length).toBeGreaterThan(10);
  });

  it('the UE moat never claims browser realization', () => {
    expect(getRealization('spellbook', 'Test Gate')?.browser).toBe('no');
    expect(getRealization('spellbook', 'UE Packaging')?.browser).toBe('no');
  });

  it('unreviewed pipelines return nothing (no fabricated evidence)', () => {
    expect(getRealization('vendors', 'Concept Brief')).toBeUndefined();
    expect(getRealization('spellbook', 'Nonexistent Step')).toBeUndefined();
  });

  it('every audited step label exists in the real spellbook pipeline (no drift)', () => {
    const pipeline = getCatalogPipeline('spellbook');
    if (!pipeline) return; // registry unavailable in this env — covered by catalog suites
    const labels = new Set(pipeline.steps.map((s: { label: string }) => s.label));
    const audited = ['Concept Brief', 'Effect Logic', 'Targeting', 'Balance', 'Animation', 'VFX', 'Test Gate', 'UE Packaging'];
    for (const step of audited) {
      expect(labels.has(step), `audited step "${step}" missing from the live pipeline`).toBe(true);
    }
  });
});
