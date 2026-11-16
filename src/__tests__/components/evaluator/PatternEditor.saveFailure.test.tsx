/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): PatternEditor closed itself after updatePattern
 * whatever the outcome, so a failed save threw the operator's edit away.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { PatternEditor } from '@/components/modules/evaluator/PatternLibraryView/PatternEditor';
import type { ImplementationPattern } from '@/types/pattern-library';

const pattern = { id: 'p1', description: 'old text', pitfalls: ['a'] } as unknown as ImplementationPattern;

function stubFetch(success: boolean) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    json: async () => (success
      ? { success: true, data: { pattern: { ...pattern, description: 'edited text' } } }
      : { success: false, error: 'database is locked' }),
  }) as Response));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PatternEditor - a failed save keeps the edit', () => {
  it('stays open with the edited text and shows an inline error when the API fails', async () => {
    stubFetch(false);
    const onDone = vi.fn();
    render(<PatternEditor pattern={pattern} onDone={onDone} />);
    const textarea = screen.getAllByRole('textbox')[0] as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'edited text' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/save failed/i));
    expect(onDone).not.toHaveBeenCalled();
    expect((screen.getAllByRole('textbox')[0] as HTMLTextAreaElement).value).toBe('edited text');
  });

  it('closes after a successful save', async () => {
    stubFetch(true);
    const onDone = vi.fn();
    render(<PatternEditor pattern={pattern} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });
});
