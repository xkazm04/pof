/**
 * A produce FAILURE MARKER (`{ done: false, data: {}, error }`) is not content (`stepRecord.ts`:
 * "content exists iff done — only content is ever graded"). The server's checker context lists
 * only persisted rows (`headless.ts` → `serverCheckerContext`), and a marker never reaches the
 * server. So the lab's ONE checker context must not hand a marker's empty `data` to a checker as
 * a produced sibling, nor grade it through `siblingVerdict` — or a derived checker (the Items
 * Test Gate) reads a failed, content-less step as produced-and-graded where the server reads it
 * as missing.
 */
import { describe, it, expect } from 'vitest';
import { buildLabCheckerContext } from '@/components/layout-lab/labCheckerContext';
import type { LabStepArtifact } from '@/components/layout-lab/labPipelineStore';

const marker: LabStepArtifact = { done: false, data: {}, ueAssets: [], at: '2026-11-08T00:00:00Z', error: 'boom' };
const produced: LabStepArtifact = { done: true, data: { brief: 'x' }, ueAssets: [], at: '2026-11-08T00:00:00Z' };

describe('buildLabCheckerContext — a failure marker is not a sibling', () => {
  const steps = { 'Concept Brief': produced, 'Economy': marker };

  it('lists only steps that hold content, like the server context', () => {
    const ctx = buildLabCheckerContext('items', steps, {});
    expect(Object.keys(ctx.siblings ?? {})).toEqual(['Concept Brief']);
  });

  it('does not grade a failure marker through siblingVerdict', () => {
    const ctx = buildLabCheckerContext('items', steps, {}, { entityId: 'item-1', verdicts: [] });
    expect(ctx.siblingVerdict?.('Economy')).toBeUndefined();
  });
});
