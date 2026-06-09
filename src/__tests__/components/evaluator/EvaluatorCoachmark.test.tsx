import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { EvaluatorCoachmark } from '@/components/modules/evaluator/EvaluatorCoachmark';
import { EVALUATOR_SECTIONS } from '@/lib/evaluator/tab-glossary';

const STORAGE_KEY = 'pof-evaluator-coachmark-dismissed';

// setup.ts has no afterEach(cleanup) and shares one localStorage across tests.
afterEach(cleanup);
beforeEach(() => localStorage.removeItem(STORAGE_KEY));

describe('EvaluatorCoachmark', () => {
  it('renders expanded on first run with a plain-language blurb for every section', () => {
    render(<EvaluatorCoachmark />);
    expect(screen.getByRole('note', { name: 'What the evaluator tabs mean' })).toBeTruthy();
    for (const section of EVALUATOR_SECTIONS) {
      expect(screen.getByText(section.label)).toBeTruthy();
      expect(screen.getByText(section.blurb)).toBeTruthy();
    }
  });

  it('dismisses to a small reopen affordance and persists the choice', () => {
    render(<EvaluatorCoachmark />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss tab guide' }));

    expect(screen.queryByRole('note', { name: 'What the evaluator tabs mean' })).toBeNull();
    expect(screen.getByRole('button', { name: /what do the tabs mean/i })).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('starts collapsed when previously dismissed, and reopening clears the flag', () => {
    localStorage.setItem(STORAGE_KEY, '1');
    render(<EvaluatorCoachmark />);

    // Collapsed: no expanded note, just the reopen affordance.
    expect(screen.queryByRole('note', { name: 'What the evaluator tabs mean' })).toBeNull();
    const reopen = screen.getByRole('button', { name: /what do the tabs mean/i });

    fireEvent.click(reopen);
    expect(screen.getByRole('note', { name: 'What the evaluator tabs mean' })).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
