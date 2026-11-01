/**
 * Section-12 amendment: the walker emits an EXPLICIT 0 for a covered node no walk reached, and
 * leaves a node it did not cover ABSENT. Over the merged (imported + sampled) model, the inspector
 * must render those two differently in DOM text, and the overview must count the 0 as a reach row.
 *
 * Plain DOM assertions only (no jest-dom in this repo), own `afterEach(cleanup)`.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { OrreryPanel } from '@/components/story/orrery/OrreryPanel';
import { WalkControl } from '@/components/story/WalkControl';
import { buildMergedModel, mergeWalkEvidence } from '@/lib/story/orrery/walk';
import { describeNode } from '@/components/story/orrery/render/describe';
import { honestyGraph, ix } from '@/__tests__/components/story/orrery/panelFixture';
import { HASH, walkReport } from '@/__tests__/components/story/walkFixture';
import type { OrreryModel } from '@/lib/story/orrery';
import type { StoryGraph } from '@/lib/story/types';

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

// Sampled-only: l.none = explicit 0 for `uniform`, l.ghost absent.
const graph: StoryGraph = { ...honestyGraph(), evidence: undefined };
const merged = mergeWalkEvidence(graph, HASH, walkReport());
const model = buildMergedModel(graph, 'fx', merged);

function panel(m: OrreryModel, selected: number) {
  return render(
    <OrreryPanel
      model={m}
      selected={selected}
      detail={null}
      tab="inspect"
      onTab={vi.fn()}
      onSelect={vi.fn()}
      onCloseDetail={vi.fn()}
      focus={m.root}
    />,
  );
}

function cells(selected: number) {
  return render(
    <WalkControl
      target={null}
      last={{ jobId: 'walk-1', report: walkReport(), durationMs: 1 }}
      merged={merged}
      model={model}
      selected={selected}
      lens="uniform"
      onLens={vi.fn()}
      onDone={vi.fn()}
    />,
  );
}

describe('explicit 0 vs absent, merged model, in the DOM', () => {
  it('inspector bars: 0% on a solid track vs an em dash on a hatched one', () => {
    const zero = panel(model, ix(model, 'l.none'));
    const zText = zero.container.querySelector('[data-role=orrery-bars]')?.textContent ?? '';
    expect(zText).toContain('uniform');
    expect(zText).toContain('0%');
    expect(zero.container.querySelector('[data-role=orrery-bar]')?.getAttribute('data-measured')).toBeNull();
    cleanup();

    const absent = panel(model, ix(model, 'l.ghost'));
    const aText = absent.container.querySelector('[data-role=orrery-bars]')?.textContent ?? '';
    expect(aText).toContain('—');
    expect(aText).not.toContain('0%');
    expect(absent.container.querySelector('[data-role=orrery-bar]')?.getAttribute('data-measured')).toBe('false');
    expect(absent.container.textContent).toContain('unmeasured, which is not the same as 0%');
  });

  it('walk cell table: "0% - measured, not reached in n walks (sampled, verified)" vs "unmeasured"', () => {
    const zero = cells(ix(model, 'l.none'));
    const cell = zero.container.querySelector('[data-role=orrery-walk-cell]');
    expect(cell?.getAttribute('data-reach')).toBe('measured-zero');
    expect(cell?.querySelector('b')?.textContent).toBe('0%');
    expect(cell?.textContent).toContain('measured, not reached in 400 walks (sampled, verified)');
    cleanup();

    const absent = cells(ix(model, 'l.ghost'));
    const box = absent.container.querySelector('[data-role=orrery-walk-cells]');
    expect(box?.getAttribute('data-measured')).toBe('false');
    expect(box?.textContent).toContain('unmeasured, which is not 0%');
    expect(box?.textContent).not.toContain('measured, not reached');
    cleanup();

    // A non-zero cell does not claim "not reached".
    const half = cells(ix(model, 'l.half'));
    const hc = [...half.container.querySelectorAll('[data-role=orrery-walk-cell]')];
    expect(hc.every((c) => c.getAttribute('data-reach') === 'measured')).toBe(true);
    expect(half.container.textContent).not.toContain('not reached');
  });

  it('screen-reader description: measured vs never measured', () => {
    expect(describeNode(model, ix(model, 'l.none'))).toContain('reach measured');
    expect(describeNode(model, ix(model, 'l.ghost'))).toContain('never measured, which is not zero');
  });

  it('overview counts the explicit 0 as a reach row (3 of 6), the absent node not', () => {
    const r = panel(model, -1);
    expect(r.container.querySelector('[data-role=orrery-panelbody]')?.textContent).toContain('3 of 6 nodes');
  });
});
