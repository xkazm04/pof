/**
 * The provenance stamp is ADDITIVE metadata: it must be able to say who produced an
 * artifact without being able to move a verdict. Two things guarantee that, and both are
 * pinned here: `_provenance` is a VOLATILE key of the judge content hash (so stamping it
 * cannot mark a standing verdict stale or trip the lab's drift banner), and the engine
 * resolution rules are pure and total.
 *
 * Standard: catalog-pipeline-authoring / direction-is-an-input-not-a-text-box.
 */
import { describe, it, expect } from 'vitest';
import { stepContentHash } from '@/lib/judge/contentHash';
import { NON_CONTENT_KEYS } from '@/lib/judge/payload';
import {
  CLIENT_DECLARABLE_ENGINES,
  LAB_PRODUCE_ENGINE,
  UNKNOWN_ENGINE,
  engineProvenance,
  isClientDeclarableEngine,
  readProvenance,
  resolvePersistedEngine,
  withProvenance,
} from '@/lib/provenance';

describe('_provenance can never move a verdict', () => {
  it('is a non-content key, so the judge never reads it', () => {
    expect(NON_CONTENT_KEYS.has('_provenance')).toBe(true);
  });

  it('stamping an engine leaves the content hash byte-identical', () => {
    const data = { brief: 'a solid iron sword', budget: { total: 10 } };
    const before = stepContentHash(data);
    const stamped = withProvenance(data, engineProvenance('Claude', { model: 'sonnet' }));
    expect(stepContentHash(stamped)).toBe(before);
  });

  it('changing a recorded engine leaves the content hash byte-identical', () => {
    const a = withProvenance({ brief: 'x' }, engineProvenance('Code'));
    const b = withProvenance({ brief: 'x' }, engineProvenance('Claude', { model: 'opus' }));
    expect(stepContentHash(a)).toBe(stepContentHash(b));
  });

  it('withProvenance never mutates its input and never touches other keys', () => {
    const data = { brief: 'x', genHistory: { batches: [] } };
    const out = withProvenance(data, engineProvenance('Code'));
    expect(data).not.toHaveProperty('_provenance');
    expect(out.brief).toBe('x');
    expect(out.genHistory).toBe(data.genHistory);
    expect(readProvenance(out)?.engine).toBe('Code');
  });

  it('merges into an existing stamp rather than replacing it', () => {
    const data = withProvenance({ brief: 'x' }, { engine: 'unknown', promptVersion: 'q1' });
    const out = withProvenance(data, engineProvenance('Code'));
    expect(readProvenance(out)?.engine).toBe('Code');
    expect(readProvenance(out)?.promptVersion).toBe('q1');
  });
});

describe('resolvePersistedEngine — what a CLIENT is allowed to claim', () => {
  it('accepts a declared engine from the allow-list', () => {
    expect(resolvePersistedEngine({ declared: 'Code' })).toBe('Code');
  });

  it('refuses an engine the client cannot prove, with no prior record', () => {
    expect(resolvePersistedEngine({ claimed: 'Claude' })).toBe(UNKNOWN_ENGINE);
    expect(resolvePersistedEngine({ claimed: 'Tripo' })).toBe(UNKNOWN_ENGINE);
  });

  it('keeps an engine the server already recorded for that row', () => {
    expect(resolvePersistedEngine({ claimed: 'Claude', attested: 'Claude' })).toBe('Claude');
  });

  it('does not let a prior record launder a DIFFERENT claim', () => {
    expect(resolvePersistedEngine({ claimed: 'Tripo', attested: 'Claude' })).toBe(UNKNOWN_ENGINE);
  });

  it('reports unknown — never a guess — when nothing is declared, claimed or recorded', () => {
    expect(resolvePersistedEngine({})).toBe(UNKNOWN_ENGINE);
  });

  it('the allow-list holds only engines a client can honestly assert', () => {
    expect([...CLIENT_DECLARABLE_ENGINES]).toEqual(['Code']);
    expect(isClientDeclarableEngine(LAB_PRODUCE_ENGINE)).toBe(true);
    expect(isClientDeclarableEngine('Claude')).toBe(false);
  });
});
