import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('icon-sets pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "icon-sets" with correct step labels and acceptance', async () => {
    await import('@/lib/catalog/pipelines/icon-sets');
    const p = getCatalogPipeline('icon-sets');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Accessibility');

    const entity = { id: 'ability-icons', name: 'Ability Icons', lifecycle: 'planned' as const, data: {} };

    // Icon 2D Art: produce + accept → pass, tier L1 (selection step)
    const iconStep = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconResult = iconStep.accept(iconStep.produce(entity).data ?? {});
    expect(iconResult.status).toBe('deferred'); // a swatch placeholder is not a generated asset — the gallery gate now defers with a reason
    expect(iconResult.tier).toBe('L4'); // a missing VISUAL asset, reported at the tier the walker expects for a deferral

    // Test Gate: deferred L3
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
  });
});
