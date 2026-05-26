import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('status-effect pilot pipeline', () => {
  beforeEach(() => _resetRegistry());
  it('registers a config-complete-capable pipeline with a deferred runtime gate', async () => {
    await import('@/lib/catalog/pipelines/status-effect');
    const p = getCatalogPipeline('status-effect');
    expect(p).not.toBeNull();
    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Effect Logic');
    expect(labels).toContain('Test Gate');

    const entity = { id: 'burning', name: 'Burning', lifecycle: 'planned' as const, data: {} };
    const logic = p!.steps.find((s) => s.label === 'Effect Logic')!;
    expect(logic.accept(logic.produce(entity).data ?? {}).status).toBe('pass');
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
  });
});
