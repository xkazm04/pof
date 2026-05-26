import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('bestiary pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "bestiary" with correct step labels, acceptance, and static checks', async () => {
    await import('@/lib/catalog/pipelines/bestiary');
    const p = getCatalogPipeline('bestiary');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Stat Block');
    expect(labels).toContain('Abilities');
    expect(labels).toContain('Test Gate');

    const entity = { id: 'brute', name: 'Brute', lifecycle: 'planned' as const, data: {} };

    // Stat Block: produce + accept → pass
    const statBlock = p!.steps.find((s) => s.label === 'Stat Block')!;
    expect(statBlock.accept(statBlock.produce(entity).data ?? {}).status).toBe('pass');

    // Stat Block L2 static check: AARPGEnemyCharacter is in fixture Enemy.h → pass
    const ueRoot = join(process.cwd(), 'src/__tests__/fixtures/ue');
    const checks = statBlock.staticChecks!(entity);
    expect(checks).toHaveLength(1);
    const l2 = checks[0](ueRoot);
    expect(l2.tier).toBe('L2');
    expect(l2.status).toBe('pass');

    // Abilities: produce + accept → pass
    const abilities = p!.steps.find((s) => s.label === 'Abilities')!;
    expect(abilities.accept(abilities.produce(entity).data ?? {}).status).toBe('pass');

    // Test Gate: deferred L3
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
  });
});
