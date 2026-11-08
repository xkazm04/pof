/**
 * scan-sweep night 2026-11-08 (module-topology-graph): when the Copy button became a
 * sibling of the toggle (to avoid nested interactive controls) the row became a single
 * `flex items-stretch` line — and the expanded details panel stayed a child of it, so
 * opening a row painted the descriptions + suggested owner as a fourth COLUMN squeezed
 * to the right of the buttons instead of below them. The details must sit outside the
 * horizontal control row.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { OverlapRow } from '@/components/modules/evaluator/CrossModuleOverlapPanel/OverlapRow';
import type { OverlapPair } from '@/lib/overlap-detection';

afterEach(cleanup);

const OVERLAP: OverlapPair = {
  moduleA: 'arpg-save', moduleB: 'save-load', featureA: 'Save versioning', featureB: 'Save versioning',
  descriptionA: 'A-side description', descriptionB: 'B-side description', similarity: 0.9,
  reason: 'name_match', suggestedOwner: 'arpg-save', ownershipReason: 'owns the slot format',
};

function renderRow(isExpanded: boolean) {
  return render(
    <OverlapRow
      overlap={OVERLAP} twin={null} reviewKeys={[]} reviewBusy={false} onReview={() => {}}
      isExpanded={isExpanded} isCopied={false} onToggle={() => {}} onCopy={() => {}}
    />,
  );
}

describe('OverlapRow expanded details layout', () => {
  it('renders the details panel below the control row, not as a flex-row sibling of the buttons', () => {
    const { getByText, getByRole } = renderRow(true);
    const toggle = getByRole('button', { expanded: true });
    const controlRow = toggle.parentElement!;
    const details = getByText('A-side description').closest('.grid')!.parentElement!;

    expect(controlRow.className).toMatch(/\bflex\b/);
    expect(controlRow.contains(details)).toBe(false);
    // The copy button still shares the toggle's row.
    expect(controlRow.contains(getByRole('button', { name: /Copy overlap details/ }))).toBe(true);
  });

  it('control: collapsed rows render no details', () => {
    const { queryByText } = renderRow(false);
    expect(queryByText('A-side description')).toBeNull();
  });
});
