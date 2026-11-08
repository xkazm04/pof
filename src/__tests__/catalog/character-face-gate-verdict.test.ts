/**
 * The character-pipeline face gates (Face Gate 2D / Face Gate 3D) grade the RECORDED verdict, not
 * only its presence. Before: `fieldsPopulated` accepted any non-empty `verdict`, so a gate that
 * recorded `fail` (the face did not survive) still satisfied the step and the next credit spend
 * read as gated. A recorded `fail` must fail the step; an unrecognised verdict must not pass.
 */
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

const GATES = ['Face Gate 2D', 'Face Gate 3D'] as const;
const entity = { id: 'char-test', name: 'Jinx', lifecycle: 'planned', data: {} } as never;

function gateStep(label: string) {
  const step = getCatalogPipeline('character-pipeline')?.steps.find((s) => s.label === label);
  if (!step) throw new Error(`character-pipeline has no "${label}" step`);
  return step;
}

function withVerdict(label: string, verdict: unknown) {
  const data = structuredClone(gateStep(label).produce(entity).data ?? {}) as { gate: Record<string, unknown> };
  data.gate.verdict = verdict;
  return data as Record<string, unknown>;
}

describe('character-pipeline face gates grade the recorded verdict', () => {
  for (const label of GATES) {
    it(`${label}: a recorded pass verdict passes`, () => {
      expect(gateStep(label).accept(withVerdict(label, 'pass')).status).toBe('pass');
    });

    it(`${label}: a recorded fail verdict fails the step and says so`, () => {
      const r = gateStep(label).accept(withVerdict(label, 'fail'));
      expect(r.status).toBe('fail');
      expect(r.reason ?? '').toMatch(/fail/);
    });

    it(`${label}: an unrecognised verdict never passes`, () => {
      expect(gateStep(label).accept(withVerdict(label, 'looks fine')).status).not.toBe('pass');
    });

    it(`${label}: a missing field is still reported (presence check kept)`, () => {
      const data = withVerdict(label, 'pass') as { gate: Record<string, unknown> };
      delete data.gate.evidence;
      expect(gateStep(label).accept(data).status).not.toBe('pass');
    });
  }
});
