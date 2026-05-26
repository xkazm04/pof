import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// Stub orchestrator so no real fetch happens.
vi.mock('@/lib/one-shot/orchestrator', () => ({
  createOrchestrator: () => ({
    start: vi.fn(),
    refine: vi.fn(),
    approveAndRun: vi.fn(),
    cancel: vi.fn(),
  }),
}));

import { OneShotPanel } from '@/components/layout-lab/one-shot/OneShotPanel';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { LIGHT } from '@/components/layout-lab/theme';

describe('OneShotPanel', () => {
  beforeEach(() => {
    useOneShotJobStore.getState().reset();
    useOneShotLabStore.setState({ panelOpen: false, pendingNavigation: null });
  });

  afterEach(() => cleanup());

  it('renders nothing when panelOpen is false', () => {
    const { container } = render(<OneShotPanel t={LIGHT} />);
    expect(container.firstChild).toBeNull();
  });

  it('opens to a catalog picker when phase is idle', () => {
    useOneShotLabStore.setState({ panelOpen: true });
    render(<OneShotPanel t={LIGHT} />);
    expect(screen.getByLabelText(/catalog/i)).toBeTruthy();
    // The Analyze button should be present
    expect(screen.getByRole('button', { name: /analyze/i })).toBeTruthy();
  });

  it('shows proposal content and Run pipeline button when phase is proposing', () => {
    useOneShotJobStore.setState({
      phase: 'proposing',
      catalogId: 'items',
      proposal: { name: 'Test Sword', rationale: 'A good sword for testing', data: { tier: 'uncommon' } },
      refinementTurns: 0,
    });
    useOneShotLabStore.setState({ panelOpen: true });
    render(<OneShotPanel t={LIGHT} />);
    expect(screen.getByText('Test Sword')).toBeTruthy();
    expect(screen.getByRole('button', { name: /run pipeline/i })).toBeTruthy();
  });

  it('shows run log when phase is running with recorded steps', () => {
    useOneShotJobStore.setState({
      phase: 'running',
      catalogId: 'items',
      stepResults: [
        { step: 'Concept Brief', outcome: 'pass' },
        { step: 'Attributes', outcome: 'fail', reason: 'missing data' },
      ],
    });
    useOneShotLabStore.setState({ panelOpen: true });
    render(<OneShotPanel t={LIGHT} />);
    expect(screen.getByText('Concept Brief')).toBeTruthy();
    expect(screen.getByText('Attributes')).toBeTruthy();
    expect(screen.getByText('PASS')).toBeTruthy();
    expect(screen.getByText('FAIL')).toBeTruthy();
  });

  it('shows run log when phase is completed with summary', () => {
    useOneShotJobStore.setState({
      phase: 'completed',
      catalogId: 'items',
      stepResults: [{ step: 'Concept Brief', outcome: 'pass' }],
      lastSummary: { ran: 1, passed: 1, failed: 0, skipped: 0, deferred: 0 },
    });
    useOneShotLabStore.setState({ panelOpen: true });
    render(<OneShotPanel t={LIGHT} />);
    // Run log + summary shown
    expect(screen.getByText('Concept Brief')).toBeTruthy();
  });

  it('shows distribution bucket label when store has distribution data', () => {
    const fixture = {
      catalogId: 'items',
      total: 10,
      byAttribute: {
        tier: { uncommon: 4, rare: 3, epic: 2, legendary: 1 },
      },
      underrepresented: [{ attribute: 'tier', value: 'legendary', count: 1, expected: 2 }],
      sample: [],
    };
    useOneShotJobStore.setState({
      phase: 'proposing',
      catalogId: 'items',
      proposal: { name: 'Test Sword', rationale: 'good', data: {} },
      distribution: fixture,
    });
    useOneShotLabStore.setState({ panelOpen: true });
    render(<OneShotPanel t={LIGHT} />);
    expect(screen.getByText('uncommon')).toBeTruthy();
  });
});
