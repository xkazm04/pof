import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('currency pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "currency" with correct step labels and acceptance', async () => {
    await import('@/lib/catalog/pipelines/currency');
    const p = getCatalogPipeline('currency');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Economy Rules');
    expect(labels).toContain('Test Gate');

    const entity = { id: 'gold', name: 'Gold', lifecycle: 'planned' as const, data: {} };

    // Economy Rules: produce + accept → pass
    const rules = p!.steps.find((s) => s.label === 'Economy Rules')!;
    expect(rules.accept(rules.produce(entity).data ?? {}).status).toBe('pass');

    // Test Gate: deferred L3
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });

    // L2 static checks on Economy Rules: FARPGCurrencyDef is in fixture Rows.h → pass
    const ueRoot = join(process.cwd(), 'src/__tests__/fixtures/ue');
    const checks = rules.staticChecks!(entity);
    expect(checks).toHaveLength(1);
    const l2 = checks[0](ueRoot);
    expect(l2.tier).toBe('L2');
    expect(l2.status).toBe('pass');
  });
});
