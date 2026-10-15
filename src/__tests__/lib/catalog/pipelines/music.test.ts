import { describe, it, expect, beforeEach, vi } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('music pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "music" with correct step labels and acceptance', async () => {
    await import('@/lib/catalog/pipelines/music');
    const p = getCatalogPipeline('music');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Stems & Layers');
    expect(labels).toContain('Transitions');
    expect(labels).toContain('Loop & Markers');
    expect(labels).toContain('Mix & Loudness');
    expect(labels).toContain('Trigger Binding');
    expect(labels).toContain('Streaming Budget');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    const entity = {
      id: 'music-combat-a',
      name: 'Combat A',
      lifecycle: 'planned' as const,
      data: {},
    };

    // Concept Brief: ≥300 chars — should pass
    const briefStep = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefResult = briefStep.accept(briefStep.produce(entity).data ?? {});
    expect(briefResult.status).toBe('pass');
    expect(briefResult.tier).toBe('L0');

    // Stems & Layers: all 4 fields populated — should pass
    const stemsStep = p!.steps.find((s) => s.label === 'Stems & Layers')!;
    const stemsResult = stemsStep.accept(stemsStep.produce(entity).data ?? {});
    expect(stemsResult.status).toBe('pass');
    expect(stemsResult.tier).toBe('L0');

    // Mix & Loudness: integratedLUFS = −16 (signed) within ±2 of target −16 — should pass
    const mixStep = p!.steps.find((s) => s.label === 'Mix & Loudness')!;
    const mixResult = mixStep.accept(mixStep.produce(entity).data ?? {});
    expect(mixResult.status).toBe('pass');
    expect(mixResult.tier).toBe('L0');

    // Icon 2D Art: produce sets selected=0 → accepted (L1 selection)
    const iconStep = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconResult = iconStep.accept(iconStep.produce(entity).data ?? {});
    expect(iconResult.status).toBe('deferred'); // a swatch placeholder is not a generated asset — the gallery gate now defers with a reason
    expect(iconResult.tier).toBe('L4'); // a missing VISUAL asset, reported at the tier the walker expects for a deferral

    // Test Gate: deferred L3 (runtime test, not yet runnable)
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });

    // UE Packaging: ≥8 assets — should pass
    const packStep = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const packResult = packStep.accept(packStep.produce(entity).data ?? {});
    expect(packResult.status).toBe('pass');
    expect(packResult.tier).toBe('L0');
  });
});

describe('music pipeline: transition latency against the attribution window', () => {
  beforeEach(() => _resetRegistry());

  const BAR_MS = (60_000 / 96) * 4; // the pipeline's single sync point, at its declared 96 BPM
  const ATTRIBUTION_WINDOW_MS = 500;
  const RESPONSIVE = ['combatEnter', 'eliteEscalation', 'bossClimax'] as const;

  async function transitionsStep() {
    vi.resetModules();
    const registry = await import('@/lib/catalog/pipeline-registry');
    await import('@/lib/catalog/pipelines/music');
    const step = registry.getCatalogPipeline('music')!.steps.find((s) => s.label === 'Transitions')!;
    const entity = { id: 'music-combat-a', name: 'Combat A', lifecycle: 'planned' as const, data: {} };
    const data = step.produce(entity).data ?? {};
    return { step, data, transitions: (data.transitions ?? {}) as Record<string, Record<string, unknown>> };
  }

  it('every responsive transition that waits past the window covers the gap with an immediate accent', async () => {
    const { transitions } = await transitionsStep();
    expect(BAR_MS).toBeGreaterThan(ATTRIBUTION_WINDOW_MS);
    const uncovered = RESPONSIVE.filter((k) => !transitions[k]?.immediateAccent);
    expect(uncovered).toEqual([]);
  });

  it('declares a commit horizon and the requested-versus-used boundary report', async () => {
    const { transitions } = await transitionsStep();
    expect(transitions.commitHorizon).toBeTruthy();
    expect(String(transitions.commitHorizon)).toMatch(/next bar/i);
  });

  it('acceptance fails a responsive transition with no accent, and passes the produced data', async () => {
    const { step, data, transitions } = await transitionsStep();
    expect(step.accept(data).status).toBe('pass');
    const stripped = { ...data, transitions: { ...transitions, combatEnter: { ...transitions.combatEnter, immediateAccent: undefined } } };
    const verdict = step.accept(stripped);
    expect(verdict.status).not.toBe('pass');
  });
});
