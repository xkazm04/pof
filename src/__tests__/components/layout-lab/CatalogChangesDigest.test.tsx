/**
 * The changed-since digest's whole job is honesty about what the store can prove.
 *
 * Four states that must stay distinguishable — no baseline / reading / unknown (failed read) /
 * the digest — plus the two blind spots stated out loud: a verdict-only write archives
 * nothing, and the history is capped so a churned step's count is a floor.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { CatalogChangesDigest } from '@/components/layout-lab/CatalogChangesDigest';
import { LIGHT } from '@/components/layout-lab/theme';
import type { CatalogChangeRow } from '@/components/layout-lab/labCatalogChanges';
import type { CatalogChangesState } from '@/components/layout-lab/hooks/useCatalogChanges';

const STEPS = ['StepA', 'StepB'];
const SINCE = '2026-08-17T09:00:00.000Z';

const row = (over: Partial<CatalogChangeRow> = {}): CatalogChangeRow => ({
  entityId: 'e1', step: 'StepA', status: 'pass', updatedAt: '2026-08-17T12:00:00.000Z',
  revisionsSince: 0, historyTruncated: false, ...over,
});

function renderDigest(state: CatalogChangesState, onOpenStep = vi.fn(), onRetry = vi.fn()) {
  const utils = render(
    <CatalogChangesDigest t={LIGHT} state={state} steps={STEPS} onRetry={onRetry}
      nameOf={(id) => (id === 'e1' ? 'Entity One' : undefined)} onOpenStep={onOpenStep} />,
  );
  return { ...utils, onOpenStep, onRetry };
}

const ready = (rows: CatalogChangeRow[], truncated = 0): CatalogChangesState =>
  ({ kind: 'ready', changes: { since: SINCE, cap: 20, rows, truncated } });

afterEach(cleanup);

describe('CatalogChangesDigest', () => {
  it('says "no baseline yet" on a first visit — never "everything changed"', () => {
    const { getByTestId } = renderDigest({ kind: 'no-baseline' });
    expect(getByTestId('changes-no-baseline').textContent).toContain('No baseline yet');
  });

  it('reports a failed read as UNKNOWN, not as "nothing moved"', () => {
    const { getByTestId, getByText, onRetry } = renderDigest({ kind: 'error', error: 'HTTP 500' });
    expect(getByTestId('changes-error').textContent).toContain('this is unknown, not "nothing"');
    fireEvent.click(getByText(/retry/i));
    expect(onRetry).toHaveBeenCalled();
  });

  it('names the moment in the empty state', () => {
    const { getByTestId } = renderDigest(ready([]));
    const text = getByTestId('changes-headline').textContent ?? '';
    expect(text).toMatch(/^Nothing moved since .+\.$/);
    expect(text).not.toBe('Nothing moved since .');
  });

  it('separates a proven content change from a bare re-write', () => {
    const { getByTestId } = renderDigest(ready([
      row({ step: 'StepA', revisionsSince: 2 }),
      row({ step: 'StepB', revisionsSince: 0 }),
    ]));
    expect(getByTestId('changes-headline').textContent).toContain('2 steps moved since');
    expect(getByTestId('changes-row-e1::StepA').textContent).toContain('content changed — 2 versions archived since');
    expect(getByTestId('changes-row-e1::StepB').textContent)
      .toContain('written since — nothing was archived, so this was a verdict-only write or its first version');
  });

  it('STATES the truncation blind spot on the row and in the footnote', () => {
    const { getByTestId } = renderDigest(ready([row({ revisionsSince: 20, historyTruncated: true })], 1));
    expect(getByTestId('changes-row-e1::StepA').textContent)
      .toContain("at least — this step's history is capped at 20 versions, so older ones are gone");
    const note = getByTestId('changes-blind-spot').textContent ?? '';
    expect(note).toContain('1 step has hit the 20-version cap');
    expect(note).toContain('verdict-only write shows as');
  });

  it('always names the archiving blind spot, even with nothing truncated', () => {
    const { getByTestId } = renderDigest(ready([row()]));
    expect(getByTestId('changes-blind-spot').textContent).toContain('Only content changes are archived');
  });

  it('jumps to the step by its index in the CURRENT pipeline', () => {
    const { getByTestId, onOpenStep } = renderDigest(ready([row({ step: 'StepB', revisionsSince: 1 })]));
    fireEvent.click(getByTestId('changes-row-e1::StepB').querySelector('button')!);
    expect(onOpenStep).toHaveBeenCalledWith('e1', 1);
  });

  it('never fabricates a jump for a step the pipeline no longer lists', () => {
    const { getByTestId } = renderDigest(ready([row({ step: 'Retired', revisionsSince: 1 })]));
    const li = getByTestId('changes-row-e1::Retired');
    expect(li.querySelector('button')).toBeNull();
    expect(li.textContent).toContain("not in the catalog's current pipeline");
  });

  it('falls back to the entity id when the board does not know the name', () => {
    const { getByTestId } = renderDigest(ready([row({ entityId: 'ghost' })]));
    expect(getByTestId('changes-row-ghost::StepA').textContent).toContain('ghost · StepA');
  });
});
