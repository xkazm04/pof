import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { IconButton } from '@/components/layout-lab/ui/IconButton';

afterEach(cleanup);

describe('IconButton', () => {
  it('is named by ariaLabel and carries the focus ring', () => {
    render(<IconButton ariaLabel="Switch theme">*</IconButton>);
    expect(screen.getByRole('button', { name: 'Switch theme' }).className).toContain('focus-ring');
  });
  it('announces pressed state on BOTH sides of a toggle', () => {
    const { rerender } = render(<IconButton ariaLabel="Pin" active={false}>*</IconButton>);
    expect(screen.getByRole('button', { name: 'Pin' }).getAttribute('aria-pressed')).toBe('false');
    rerender(<IconButton ariaLabel="Pin" active>*</IconButton>);
    expect(screen.getByRole('button', { name: 'Pin' }).getAttribute('aria-pressed')).toBe('true');
  });
  it('a plain action icon button (no `active` prop) is not a toggle', () => {
    render(<IconButton ariaLabel="Close">*</IconButton>);
    expect(screen.getByRole('button', { name: 'Close' }).getAttribute('aria-pressed')).toBeNull();
  });
});
