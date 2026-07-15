import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { EvaluatorScanDeltas } from '@/components/modules/game-director/RegressionTrackerView/EvaluatorScanDeltas';
import type { ScanDelta } from '@/lib/evaluator/scan-delta';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

function delta(over: Partial<ScanDelta>): ScanDelta {
  return {
    scanId: over.scanId ?? 's1',
    timestamp: over.timestamp ?? Date.parse('2026-07-15T02:00:00Z'),
    scannedAt: over.scannedAt ?? '2026-07-15T02:00:00Z',
    modulesEvaluated: over.modulesEvaluated ?? ['arpg-combat'],
    newTotal: over.newTotal ?? 0,
    resolvedTotal: over.resolvedTotal ?? 0,
    persistingTotal: over.persistingTotal ?? 0,
    newBySeverity: over.newBySeverity ?? { critical: 0, high: 0, medium: 0, low: 0 },
    resolvedBySeverity: over.resolvedBySeverity ?? { critical: 0, high: 0, medium: 0, low: 0 },
    hasPrevious: over.hasPrevious ?? true,
  };
}

describe('EvaluatorScanDeltas', () => {
  it('renders nothing when history is empty (tracker unchanged)', () => {
    const { container } = render(<EvaluatorScanDeltas deltas={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a distinguishable code-quality source with new/resolved counts', () => {
    const { container } = render(
      <EvaluatorScanDeltas deltas={[delta({ newTotal: 3, resolvedTotal: 2, persistingTotal: 5 })]} />,
    );
    const text = container.textContent ?? '';
    // Labelled as its own source, distinct from playtest sessions.
    expect(text).toContain('Deep-Eval Scan Regressions');
    expect(text).toContain('source: code quality');
    // Latest-scan summary surfaces the new / resolved / persisting counts.
    expect(text).toContain('3');
    expect(text).toContain('2');
    expect(text).toContain('5');
  });
});
