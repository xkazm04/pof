import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';

afterEach(cleanup);

describe('InlineErrorRetry with a long message', () => {
  it('keeps the full text reachable on the truncated span', () => {
    const message = `EACCES: permission denied, scandir ${'very/'.repeat(30)}deep`;
    render(<InlineErrorRetry message={message} onRetry={vi.fn()} />);
    expect(screen.getByText(message).getAttribute('title')).toBe(message);
  });

  it('does not submit a surrounding form', () => {
    render(<InlineErrorRetry message="x" onRetry={vi.fn()} onDismiss={vi.fn()} />);
    for (const button of screen.getAllByRole('button')) {
      expect(button.getAttribute('type')).toBe('button');
    }
  });
});
