import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('input-schemes pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "input-schemes" with correct step labels and acceptance', async () => {
    await import('@/lib/catalog/pipelines/input-schemes');
    const p = getCatalogPipeline('input-schemes');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Action Mapping');
    expect(labels).toContain('Accessibility');
    expect(labels).toContain('Test Gate');

    const entity = { id: 'input-gamepad', name: 'Gamepad', lifecycle: 'planned' as const, data: {} };

    // Action Mapping: produce + accept → pass (all four required fields populated)
    const actionMapping = p!.steps.find((s) => s.label === 'Action Mapping')!;
    expect(actionMapping.accept(actionMapping.produce(entity).data ?? {}).status).toBe('pass');

    // Action Mapping L2 static check: AARPGPlayerController may not be in fixture → tier L2, status pass or deferred
    const ueRoot = join(process.cwd(), 'src/__tests__/fixtures/ue');
    const checks = actionMapping.staticChecks!(entity);
    expect(checks).toHaveLength(1);
    const l2 = checks[0](ueRoot);
    expect(l2.tier).toBe('L2');
    expect(['pass', 'deferred']).toContain(l2.status);

    // Test Gate: always deferred L3
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
  });
});
