/**
 * ScanTab view states and toggle semantics (scan-sweep night 2026-11-08,
 * core-engine-scan-telemetry). The hook is replaced so the view is driven directly.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ScanFinding } from '@/types/scan';
import { FIX_VERIFICATION_IDLE } from '@/lib/evaluator/scan-fix-verify';

afterEach(cleanup);

const view = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/components/modules/core-engine/ScanTab/useScanTab', () => ({ useScanTab: () => view.current }));

import { ScanTab } from '@/components/modules/core-engine/ScanTab';

function finding(id: string, resolvedAt?: string): ScanFinding {
  return {
    id, pass: 'quality', category: `cat ${id}`, severity: 'high', file: null, line: null,
    description: `desc ${id}`, suggestedFix: 'fix', effort: 'small', foundAt: '2026-11-08T00:00:00Z', resolvedAt,
  };
}

function state(active: ScanFinding[], resolved: ScanFinding[] = []) {
  const bySeverity = { critical: [], high: active, medium: [], low: [] };
  return {
    moduleLabel: 'Combat', findings: [...active, ...resolved], deltaState: { status: 'none' },
    resolveFindings: vi.fn(), undoResolve: vi.fn(), lastResolved: null, resolveError: null,
    passOptions: ['ground-truth', 'structure', 'quality', 'performance'],
    selectedPasses: new Set(['quality']), togglePass: vi.fn(), scanCount: 0,
    scanCli: { isRunning: false }, fixCli: { isRunning: false }, startScan: vi.fn(),
    activeFindings: active, resolvedFindings: resolved, bySeverity,
    severityCounts: { critical: 0, high: active.length, medium: 0, low: 0 },
    passCounts: {}, expandedFindings: new Set(), toggleFinding: vi.fn(),
    selectedFindings: new Set(), toggleSelectFinding: vi.fn(), toggleSelectAll: vi.fn(), allSelected: false,
    startBatchFix: vi.fn(), fixFinding: vi.fn(), fixVerification: FIX_VERIFICATION_IDLE, verifyFixes: vi.fn(),
    markSelectedResolved: vi.fn(), isBatchFixing: false, fixProgress: 0, fixTotalRef: { current: 0 }, activeFixId: null,
  };
}

describe('ScanTab — pass toggles state their selection', () => {
  beforeEach(() => { view.current = state([finding('a')]); });

  it('each pass toggle carries aria-pressed matching selectedPasses', () => {
    const { container } = render(<ScanTab moduleId="arpg-combat" />);
    const pressed = Array.from(container.querySelectorAll('button[aria-pressed]'));
    const byLabel = new Map(pressed.map((b) => [b.textContent?.trim() ?? '', b.getAttribute('aria-pressed')]));
    expect(pressed.length).toBeGreaterThanOrEqual(4);
    expect([...byLabel.entries()].filter(([, v]) => v === 'true').length).toBe(1);
  });
});
