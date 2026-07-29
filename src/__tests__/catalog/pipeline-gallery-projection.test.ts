import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { appendBatch, emptyHistory, historyData, makeBatch, selectCandidate, allCandidates } from '@/components/layout-lab/steps/shared/genHistory';
import { genericGalleryCandidates } from '@/components/layout-lab/steps/shared/genericGalleryCandidates';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { StepSpec } from '@/lib/catalog/stepSpec';

/**
 * Regression: a gallery selection must NEVER clobber the data its Produce wrote.
 *
 * `character-pipeline` declared `view: { kind: 'gallery', field: 'candidates' }` while its
 * Produce wrote `candidates` as an ARRAY of real Tripo/Leonardo verdicts and its acceptance
 * graded `selected`. Because a chosen candidate's payload is projected onto the artifact under
 * the VIEW FIELD, selecting a mesh overwrote that verdict array with a numeric index — and the
 * graded field (`selected`) was never written by any selection, so acceptance stayed pinned to
 * the hardcoded stub value forever. These tests lock the coherent contract in:
 * view field == selection field == candidate payload key == accepted field.
 */

const ENTITY: LabEntity = { id: 'jinx', name: 'Jinx', lifecycle: 'planned', data: {} };

function step(catalogId: string, label: string): StepSpec {
  const p = allCatalogPipelines().find((x) => x.catalogId === catalogId);
  const s = p?.steps.find((x) => x.label === label);
  if (!s) throw new Error(`step ${catalogId}/${label} not registered`);
  return s;
}

/** Simulate the lab's generate → select loop over a step's produce stub. */
function selectNth(spec: StepSpec, n: number): Record<string, unknown> {
  const produced = (spec.produce(ENTITY).data ?? {}) as Record<string, unknown>;
  const field = (spec.view as { field: string }).field;
  const count = (spec.view as { candidates: number }).candidates;
  const raw = spec.genCandidates
    ? spec.genCandidates.build('lint direction', 0, [{ name: 'a.glb', url: '/api/visual-gen/asset/a.glb' }])
    : genericGalleryCandidates(field, count, 'lint direction', 0);
  let history = appendBatch(emptyHistory(), makeBatch({ seq: 0, at: '2026-07-27T00:00:00.000Z', direction: 'lint direction', prompt: 'p', candidates: raw }));
  history = selectCandidate(history, allCandidates(history)[n].id);
  // Exactly how the lab persists a selection: produce output + the selected payload projection.
  return { ...produced, ...historyData(history) };
}

describe('gallery selection projection (character-pipeline regression)', () => {
  for (const label of ['Concept 2D', '3D Generation', 'Icon 2D Art']) {
    it(`"${label}" — selecting a candidate keeps the produced candidate array intact`, () => {
      const spec = step('character-pipeline', label);
      const produced = (spec.produce(ENTITY).data ?? {}) as Record<string, unknown>;
      expect(Array.isArray(produced.candidates)).toBe(true);

      const after = selectNth(spec, 1);
      expect(Array.isArray(after.candidates)).toBe(true);
      expect(after.candidates).toEqual(produced.candidates);
    });

    it(`"${label}" — the selection drives acceptance (not the hardcoded produce value)`, () => {
      const spec = step('character-pipeline', label);
      const field = (spec.view as { field: string }).field;

      const after = selectNth(spec, 1);
      expect(after[field]).toBe(1);
      // Terminal after a clean selection (Rule 5): `pass` when the selected candidate carries
      // a real generated asset, `deferred` (with a reason) when it is only a swatch preview —
      // never fail/pending. Which one it is, is the SELECTED CANDIDATE's property.
      const r = spec.accept(after);
      expect(['pass', 'deferred']).toContain(r.status);
      if (r.status === 'deferred') expect(r.reason).toBeTruthy();

      // A cleared selection must NOT still pass on a stale produce value.
      const cleared = { ...after, [field]: null };
      expect(spec.accept(cleared).status).not.toBe('pass');

      // …and neither may a selection that no longer names a kept candidate: the index alone
      // is not the verdict any more.
      const dangling = { ...after, genHistory: { ...(after.genHistory as object), selectedId: 'b9-c9' } };
      expect(spec.accept(dangling).status).toBe('fail');
    });
  }

  it('the 3D gallery still carries a real .glb url onto the artifact', () => {
    const spec = step('character-pipeline', '3D Generation');
    const after = selectNth(spec, 0);
    expect(after.glbUrl).toBe('/api/visual-gen/asset/a.glb');
  });
});
