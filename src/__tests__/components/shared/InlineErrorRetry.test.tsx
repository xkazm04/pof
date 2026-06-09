import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

describe('InlineErrorRetry', () => {
  it('renders the message inside an alert role with a Retry affordance', () => {
    render(<InlineErrorRetry message="Server exploded" onRetry={() => {}} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Server exploded');
    expect(screen.getByRole('button', { name: /Retry/ })).toBeTruthy();
  });

  it('invokes onRetry when Retry is clicked', () => {
    const onRetry = vi.fn();
    render(<InlineErrorRetry message="boom" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the dismiss button unless onDismiss is provided', () => {
    const { rerender } = render(<InlineErrorRetry message="boom" onRetry={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Dismiss error' })).toBeNull();

    const onDismiss = vi.fn();
    rerender(<InlineErrorRetry message="boom" onRetry={() => {}} onDismiss={onDismiss} />);
    const dismiss = screen.getByRole('button', { name: 'Dismiss error' });
    fireEvent.click(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
