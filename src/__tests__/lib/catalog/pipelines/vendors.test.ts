import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('vendors pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "vendors" with correct step labels, acceptance, and Test Gate deferred', async () => {
    await import('@/lib/catalog/pipelines/vendors');
    const p = getCatalogPipeline('vendors');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Inventory Pool');
    expect(labels).toContain('Economy Sim');
    expect(labels).toContain('Test Gate');

    const entity = { id: 'vendor-blacksmith', name: 'Blacksmith', lifecycle: 'planned' as const, data: {} };

    // Concept Brief: produce + accept → pass
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    expect(brief.accept(brief.produce(entity).data ?? {}).status).toBe('pass');

    // Inventory Pool: produce + accept → pass
    const pool = p!.steps.find((s) => s.label === 'Inventory Pool')!;
    expect(pool.accept(pool.produce(entity).data ?? {}).status).toBe('pass');

    // Economy Sim: produce + accept → pass (marginPct=28 is within ±20% of target 30)
    const sim = p!.steps.find((s) => s.label === 'Economy Sim')!;
    expect(sim.accept(sim.produce(entity).data ?? {}).status).toBe('pass');

    // Test Gate: deferred L3
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
  });
});
