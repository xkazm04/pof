import { describe, it, expect } from 'vitest';
import { PRUNE_POLICIES, categorize, classifyTree, prunePlan, type ReferenceIndex } from '@/lib/visual-gen/generated-tree';

const file = (path: string) => ({ path, sizeBytes: 10, mtimeMs: 1 });
const orphan = PRUNE_POLICIES.find((p) => p.id === 'orphan-previews')!;
const refs = (failed: string[] = []): ReferenceIndex => ({ names: new Set(), sources: new Map(), scanned: ['db'], failed });
const plan = (paths: string[], failed: string[] = []) => {
  const present = new Set(paths);
  const classified = classifyTree(paths.map((p) => categorize(file(p))), refs(failed), present);
  return prunePlan(orphan, classified, { now: 2, staleDays: 1, present });
};

describe('orphan-previews follows the rules of its own module', () => {
  it('a nested preview whose mesh sits beside it is not an orphan', () => {
    expect(plan(['anim/sub/x.preview.png', 'anim/sub/x.glb']).count).toBe(0);
  });

  it('a root preview whose mesh sits beside it is not an orphan', () => {
    expect(plan(['x.preview.png', 'x.glb']).count).toBe(0);
  });

  it('a preview a failed scan could not judge is never a candidate', () => {
    expect(plan(['anim/lost.preview.png'], ['pipeline_artifacts']).count).toBe(0);
  });

  it('a provable orphan is still selected', () => {
    expect(plan(['anim/lost.preview.png']).files.map((f) => f.path)).toEqual(['anim/lost.preview.png']);
  });
});
