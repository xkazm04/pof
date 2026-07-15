import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QualityDiscrepancyBanner } from '@/components/modules/evaluator/AggregateQualityDashboard/QualityDiscrepancyBanner';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function mockVerdicts(list: JudgeVerdict[]) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ success: true, data: list }) })) as unknown as typeof fetch);
}

// 'items' → arpg-inventory in CATALOG_MODULE.
const cells = [{ moduleId: 'arpg-inventory', label: 'Inventory', avgQuality: 4.5 }];

describe('QualityDiscrepancyBanner', () => {
  it('renders a badge + plain-language reason when signals disagree', async () => {
    mockVerdicts([
      { catalogId: 'items', entityId: 'sword', step: 'Economy', judge: 'llm-panel', verdict: 'fail', score: 40, findings: 'x', model: 'opus' },
    ]);
    render(<QualityDiscrepancyBanner cells={cells} />);
    await waitFor(() => expect(screen.getByTestId('quality-discrepancy-banner')).toBeTruthy());
    expect(screen.getByText(/read healthy on the matrix/)).toBeTruthy();
    expect(screen.getByText(/Feature-matrix quality reads healthy/)).toBeTruthy();
    expect(screen.getByText('Inventory')).toBeTruthy();
  });

  it('renders nothing when the judges agree with the matrix', async () => {
    mockVerdicts([
      { catalogId: 'items', entityId: 'sword', step: 'Economy', judge: 'llm-panel', verdict: 'pass', score: 95, findings: 'x', model: 'opus' },
    ]);
    const { container } = render(<QualityDiscrepancyBanner cells={cells} />);
    await waitFor(() => expect(screen.queryByTestId('quality-discrepancy-banner')).toBeNull());
    expect(container.querySelector('[data-testid="quality-discrepancy-banner"]')).toBeNull();
  });

  it('renders nothing when there are no verdicts', async () => {
    mockVerdicts([]);
    render(<QualityDiscrepancyBanner cells={cells} />);
    // Give the effect a tick; banner stays absent.
    await waitFor(() => expect(screen.queryByTestId('quality-discrepancy-banner')).toBeNull());
  });
});
