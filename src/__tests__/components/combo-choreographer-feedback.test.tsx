import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { AIComboChoreographer } from '@/components/modules/content/animations/AIComboChoreographer';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
});

/** Type into the prompt, click Generate, and run the 600ms generation delay. */
function generate(text: string) {
  const input = screen.getByPlaceholderText(/3-hit combo/i);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /Generate/i }));
  act(() => { vi.advanceTimersByTime(600); });
}

describe('AIComboChoreographer parse feedback', () => {
  it('warns when no hit types are recognized and a default combo was used', () => {
    render(<AIComboChoreographer />);
    generate('please make something cool');

    expect(screen.getByText(/No hit types recognized in your description/i)).toBeTruthy();
    // The suggestion vocabulary is surfaced.
    expect(screen.getByText('sweep')).toBeTruthy();
    expect(screen.getByText('thrust')).toBeTruthy();
  });

  it('shows matched-keyword chips and no warning when keywords are recognized', () => {
    render(<AIComboChoreographer />);
    generate('wide sweep into heavy overhead finisher');

    expect(screen.getByText('Matched keywords:')).toBeTruthy();
    expect(screen.getByText('wide')).toBeTruthy();
    expect(screen.getByText('heavy')).toBeTruthy();
    expect(screen.queryByText(/No hit types recognized/i)).toBeNull();
  });
});
