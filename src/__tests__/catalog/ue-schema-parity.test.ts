// /diablo W10 (D6): the schema-down snapshot's first real consumer. A step that declares which UE fields its data
// realizes (`StepSpec.ue`) is checked against the snapshot of the UE project's headers — an app field claiming a UE
// home that does not exist fails here. Refresh the snapshot with `npm run snapshot:ue-schema` after a UE header change.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { ueSchema } from '@/lib/catalog/ue-schema';

const schema = ueSchema();
const declared = allCatalogPipelines().flatMap((p) => p.steps.filter((s) => s.ue).map((s) => ({ catalog: p.catalogId, step: s.label, ue: s.ue! })));

describe('schema-down parity (app step fields ↔ UE types)', () => {
  it('the snapshot is populated (it was `{}` for four months)', () => {
    expect(Object.keys(schema).length).toBeGreaterThan(10);
  });

  it('at least one step declares its UE fields', () => {
    expect(declared.length).toBeGreaterThan(0);
  });

  for (const d of declared) {
    it(`${d.catalog} · ${d.step} → ${d.ue.type}: every declared UE field exists`, () => {
      const fields = schema[d.ue.type];
      expect(fields, `${d.ue.type} is not in the snapshot`).toBeDefined();
      const missing = Object.values(d.ue.fields).filter((f) => !fields!.includes(f));
      expect(missing).toEqual([]);
    });
  }
});
