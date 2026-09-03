/**
 * The two honesty defects, at the surfaces a human actually reads.
 *
 * A finding nobody scored must not render "80%" (or a silent "0%"), and a
 * finding that failed to reproduce must be legible as unreproducible-after-N —
 * never as a false positive, and never dimmed away like a dismissal.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { PlaytestFinding, ReproRecord } from '@/types/game-director';

// The fix button spawns a CLI session through the module stores — irrelevant here.
vi.mock('@/components/modules/game-director/FindingFixButton', () => ({
  FindingFixButton: () => null,
}));

import { FindingsList } from '@/components/modules/game-director/SessionDetail/FindingsList';
import { FindingCard } from '@/components/modules/game-director/FindingsExplorer/FindingCard';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

let seq = 0;
function finding(over: Partial<PlaytestFinding> = {}): PlaytestFinding {
  return {
    id: `f-${seq++}`,
    sessionId: 's1',
    category: 'gameplay-feel',
    severity: 'high',
    title: 'Dash cancels itself on slopes',
    description: 'Player dash stops early on any surface above 30 degrees.',
    relatedModule: null,
    screenshotRef: null,
    gameTimestamp: null,
    suggestedFix: '',
    confidence: null,
    confidenceBasis: null,
    createdAt: new Date().toISOString(),
    triageStatus: 'active',
    triageNote: '',
    snoozedUntil: null,
    fixDispatchedAt: null,
    reproAttempts: null,
    reproBuildId: null,
    reproLastAttemptedAt: null,
    ...over,
  };
}

const noop = () => {};
const noopApply = async () => true;

describe('FindingsList confidence rendering', () => {
  it('says "not scored" instead of showing a number for an unscored finding', () => {
    const { container } = render(
      <FindingsList findings={[finding()]} expandedId={null} onToggle={noop} onFixDispatched={noop} />,
    );
    expect(container.textContent).toMatch(/not scored/i);
    expect(container.textContent).not.toMatch(/\b80%/);
    expect(container.textContent).not.toMatch(/\b0%/);
  });

  it('shows the number only when an observer actually scored it', () => {
    const { container } = render(
      <FindingsList
        findings={[finding({ confidence: 85, confidenceBasis: 'observer' })]}
        expandedId={null}
        onToggle={noop}
        onFixDispatched={noop}
      />,
    );
    expect(container.textContent).toMatch(/85%/);
    expect(container.textContent).not.toMatch(/not scored/i);
  });

  it('marks a legacy number whose basis was never recorded', () => {
    const { container } = render(
      <FindingsList
        findings={[finding({ confidence: 80, confidenceBasis: 'unattributed' })]}
        expandedId={null}
        onToggle={noop}
        onFixDispatched={noop}
      />,
    );
    expect(container.textContent).toMatch(/80%/);
    expect(container.textContent).toMatch(/unattributed/i);
  });

  it('renders the expanded detail row without a fabricated confidence', () => {
    const f = finding();
    const { container } = render(
      <FindingsList findings={[f]} expandedId={f.id} onToggle={noop} onFixDispatched={noop} />,
    );
    expect(container.textContent).toMatch(/Confidence: not scored/i);
  });
});

describe('FindingCard unreproducible state', () => {
  it('names the state and its attempt count, and does not dim it away', () => {
    const { container } = render(
      <FindingCard
        finding={finding({
          triageStatus: 'unreproducible',
          reproAttempts: 9,
          reproBuildId: 'main@ab12cd3',
        })}
        index={0}
        busy={false}
        onApply={noopApply}
        onFixDispatched={noop}
      />,
    );
    expect(container.textContent).toMatch(/unreproduc/i);
    // The attempt count is on the card, not buried — "could not reproduce"
    // without a denominator says nothing about reliability.
    expect(container.textContent).toMatch(/9/);
    expect(container.textContent).toMatch(/main@ab12cd3/);
    // Dismissed states are dimmed; this one is not a dismissal.
    expect(container.querySelector('.opacity-60')).toBeNull();
  });

  it('offers an unreproducible action that demands an attempt count before saving', () => {
    const applied: Array<{ status: string; attempts: number | null }> = [];
    render(
      <FindingCard
        finding={finding()}
        index={0}
        busy={false}
        onApply={async (_f, status: string, _note?: string, _snooze?: string | null, repro?: ReproRecord | null) => {
          applied.push({ status, attempts: repro?.attempts ?? null });
          return true;
        }}
        onFixDispatched={noop}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /could not reproduce/i }));
    const attemptsInput = screen.getByLabelText(/attempts/i) as HTMLInputElement;
    const save = screen.getByRole('button', { name: /save triage/i });

    // Zero attempts is "not attempted" — the save must stay blocked.
    expect(save.hasAttribute('disabled')).toBe(true);
    fireEvent.click(save);
    expect(applied).toHaveLength(0);

    fireEvent.change(attemptsInput, { target: { value: '5' } });
    expect(save.hasAttribute('disabled')).toBe(false);
    fireEvent.click(save);
    expect(applied).toEqual([{ status: 'unreproducible', attempts: 5 }]);
  });

  it('keeps false positive as its own separate action', () => {
    render(
      <FindingCard
        finding={finding()}
        index={0}
        busy={false}
        onApply={noopApply}
        onFixDispatched={noop}
      />,
    );
    expect(screen.getByRole('button', { name: /false positive/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /could not reproduce/i })).toBeTruthy();
  });
});
