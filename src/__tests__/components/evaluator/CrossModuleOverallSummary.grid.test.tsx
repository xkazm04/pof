/**
 * scan-sweep (cross-module-features): the summary card row is "Overall" plus one
 * card per status key (6 today) but was laid out as a fixed `grid-cols-5`, so the
 * last card ("Unknown") wrapped alone onto a second row. The column count must be
 * the card count, derived from STATUS_KEYS rather than typed by hand.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { OverallSummary } from '@/components/modules/evaluator/CrossModuleFeatureDashboard/OverallSummary';
import { STATUS_KEYS } from '@/components/modules/evaluator/CrossModuleFeatureDashboard/constants';

afterEach(cleanup);

const TOTALS = { total: 10, implemented: 2, improved: 1, partial: 3, missing: 2, unknown: 2 };

/** Columns a grid declares, by Tailwind class or inline repeat(). */
function declaredColumns(el: HTMLElement): number | null {
  const cls = el.className.match(/(?:^|\s)grid-cols-(\d+)(?:\s|$)/);
  if (cls) return Number(cls[1]);
  const rep = el.style.gridTemplateColumns.match(/repeat\((\d+)/);
  return rep ? Number(rep[1]) : null;
}

describe('OverallSummary card row', () => {
  it('declares one column per card, so no card wraps alone', () => {
    const { container } = render(<OverallSummary totals={TOTALS} overallPct={30} onRefresh={() => {}} />);
    const row = container.firstElementChild as HTMLElement;
    expect(row.children.length).toBe(STATUS_KEYS.length + 1);
    expect(declaredColumns(row)).toBe(row.children.length);
  });
});
