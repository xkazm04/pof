import { describe, it, expect } from 'vitest';
import { diffArtifactData, diffRevision } from '@/components/layout-lab/steps/shared/revisionDiff';

const batch = (n: number) => ({
  id: `b${n}`, at: '2026-09-01T00:00:00.000Z', direction: `d${n}`, prompt: `p${n}`,
  candidates: [0, 1, 2].map((c) => ({ id: `b${n}-c${c}`, swatch: 'x', payload: { selected: `b${n}-c${c}` } })),
});

describe('diffArtifactData (current → archived)', () => {
  it('reports changed / removed / added keys sorted by key and omits unchanged ones', () => {
    expect(diffArtifactData({ a: 1, b: 'x', n: { k: 1 } }, { a: 2, c: true, n: { k: 1 } })).toEqual([
      { key: 'a', kind: 'changed', from: '1', to: '2' },
      { key: 'b', kind: 'removed' },
      { key: 'c', kind: 'added' },
    ]);
  });

  it('summarises genHistory as batch count + selected id, never a raw JSON dump', () => {
    const current = { genHistory: { batches: [0, 1, 2, 3].map(batch), selectedId: 'b3-c0' } };
    const archived = { genHistory: { batches: [0, 1].map(batch), selectedId: 'b1-c2' } };
    expect(diffArtifactData(current, archived)).toEqual([
      { key: 'genHistory', kind: 'changed', summary: 'batches 4 → 2 · selected b3-c0 → b1-c2' },
    ]);
  });
});

describe('diffRevision', () => {
  const D = { brief: 'same', stats: { hp: 10 } };

  it('treats ueAssets as content, as contentChanged does', () => {
    const rows = diffRevision({ data: D, ueAssets: ['/Game/A'] }, { data: D, ueAssets: ['/Game/B'] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: 'ueAssets', kind: 'changed' });
  });

  it('identical data + ueAssets -> no rows', () => {
    expect(diffRevision({ data: D, ueAssets: ['/Game/A'] }, { data: { ...D }, ueAssets: ['/Game/A'] })).toEqual([]);
  });
});
