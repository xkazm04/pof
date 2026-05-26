import { describe, it, expect, beforeEach } from 'vitest';
import { registerCatalogPipeline, getCatalogPipeline, _resetRegistry } from '@/lib/catalog/pipeline-registry';
import { minCount } from '@/lib/catalog/acceptance/dataCheckers';

describe('pipeline-registry', () => {
  beforeEach(() => _resetRegistry());
  it('registers and retrieves a catalog pipeline', () => {
    registerCatalogPipeline({
      catalogId: 'demo',
      steps: [{ archetype: 'checklist', label: 'Gate', view: { kind: 'checklist', field: 'checks' }, produce: () => ({ data: { checks: ['a'] } }), accept: minCount('checks', 'Checks', 1) }],
    });
    expect(getCatalogPipeline('demo')?.steps[0].label).toBe('Gate');
    expect(getCatalogPipeline('missing')).toBeNull();
  });
  it('last registration wins (idempotent re-register)', () => {
    const mk = (label: string) => ({ catalogId: 'demo', steps: [{ archetype: 'checklist' as const, label, view: { kind: 'checklist' as const, field: 'c' }, produce: () => ({ data: {} }), accept: minCount('c', label, 0) }] });
    registerCatalogPipeline(mk('first'));
    registerCatalogPipeline(mk('second'));
    expect(getCatalogPipeline('demo')?.steps[0].label).toBe('second');
  });
});
