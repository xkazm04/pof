import { describe, it, expect, beforeAll } from 'vitest';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';

/** Produced artifact data is shipped content: it must never carry a TODO note. */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

describe('produced step data carries no TODO copy', () => {
  beforeAll(async () => { await import('@/lib/catalog/pipelines/registry.generated'); });

  it('no step produce output contains a TODO', () => {
    const hits: string[] = [];
    for (const p of allCatalogPipelines()) {
      const entity = { id: 'probe-entity', name: 'Probe Entity', lifecycle: 'planned' as const, data: {} };
      for (const step of p.steps) {
        let out;
        try { out = step.produce(entity); } catch { continue; }
        for (const s of strings(out.data)) if (/\bTODO\b/.test(s)) hits.push(`${p.catalogId}/${step.label}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
