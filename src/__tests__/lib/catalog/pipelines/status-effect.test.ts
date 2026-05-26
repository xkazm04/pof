import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
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

    // L2 static checks are now expressible + resolve to an L2 result. Against the test
    // fixture UE tree, Burning's not-yet-generated symbol resolves to `deferred` (the honest
    // "generate the C++ then re-check" gap) — proving the L2 path is wired, not absent.
    const ueRoot = join(process.cwd(), 'src/__tests__/fixtures/ue');
    const logicChecks = logic.staticChecks!(entity);
    expect(logicChecks).toHaveLength(1);
    const l2 = logicChecks[0](ueRoot);
    expect(l2.tier).toBe('L2');
    expect(['pass', 'deferred']).toContain(l2.status);
  });
});
