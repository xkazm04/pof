import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup, within } from '@testing-library/react';

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));

import { PromptDiffView } from '@/components/modules/evaluator/PromptDiffView';

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => cleanup());

describe('PromptDiffView', () => {
  it('renders deleted and inserted lines with +/- gutter signs (unified by default)', () => {
    const { container } = render(
      <PromptDiffView before="Create a sword" after="Create a hammer" />,
    );
    const del = container.querySelector('[data-diff-line="del"]');
    const add = container.querySelector('[data-diff-line="add"]');
    expect(del).toBeTruthy();
    expect(add).toBeTruthy();
    expect(del?.querySelector('[data-gutter-sign]')?.textContent).toBe('-');
    expect(add?.querySelector('[data-gutter-sign]')?.textContent).toBe('+');
  });

  it('highlights only the changed words inline', () => {
    const { container } = render(
      <PromptDiffView before="Create a sword" after="Create a hammer" />,
    );
    const del = container.querySelector('[data-diff-line="del"]')!;
    const add = container.querySelector('[data-diff-line="add"]')!;
    // The removed word is tagged del; the inserted word add; the shared prefix stays eq.
    expect(within(del as HTMLElement).getByText('sword').getAttribute('data-diff')).toBe('del');
    expect(within(add as HTMLElement).getByText('hammer').getAttribute('data-diff')).toBe('add');
    expect(del.querySelector('[data-diff="add"]')).toBeNull();
    expect(add.querySelector('[data-diff="del"]')).toBeNull();
  });

  it('shows insertion/deletion counts', () => {
    const { getByLabelText } = render(
      <PromptDiffView before={'keep\nold line'} after={'keep\nnew line\nextra'} />,
    );
    // old line -> new line is a 1/1 swap, plus one extra inserted line = 2 added, 1 removed.
    expect(getByLabelText('2 insertions')).toBeTruthy();
    expect(getByLabelText('1 deletion')).toBeTruthy();
  });

  it('switches to a side-by-side split view with original/optimized columns', () => {
    const { getByRole, getByText, queryByText } = render(
      <PromptDiffView before="hello world" after="hello there" />,
    );
    expect(queryByText('Original')).toBeNull();
    fireEvent.click(getByRole('button', { name: /split/i }));
    expect(getByText('Original')).toBeTruthy();
    expect(getByText('Optimized')).toBeTruthy();
  });

  it('copies the optimized prompt to the clipboard', async () => {
    const { getByRole } = render(
      <PromptDiffView before="old" after="optimized prompt text" />,
    );
    fireEvent.click(getByRole('button', { name: /copy optimized/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('optimized prompt text');
      expect(toastSuccess).toHaveBeenCalled();
    });
  });
});
