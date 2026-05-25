import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ShellSwitcher } from '@/components/ecw/ShellSwitcher';

describe('ShellSwitcher', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'));
  afterEach(cleanup);

  it('renders both shell options', () => {
    render(<ShellSwitcher />);
    expect(screen.getByRole('button', { name: /legacy/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /new/i })).toBeTruthy();
  });

  it('marks Legacy active when no ?ecw flag', () => {
    window.history.replaceState({}, '', '/');
    render(<ShellSwitcher />);
    expect(screen.getByRole('button', { name: /legacy/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /new/i }).getAttribute('aria-pressed')).toBe('false');
  });

  it('marks New active when ?ecw=1', () => {
    window.history.replaceState({}, '', '/?ecw=1');
    render(<ShellSwitcher />);
    expect(screen.getByRole('button', { name: /new/i }).getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking New sets ?ecw=1 in the URL', () => {
    window.history.replaceState({}, '', '/');
    render(<ShellSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    expect(new URLSearchParams(window.location.search).get('ecw')).toBe('1');
  });

  it('clicking Legacy removes ?ecw from the URL', () => {
    window.history.replaceState({}, '', '/?ecw=1');
    render(<ShellSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /legacy/i }));
    expect(new URLSearchParams(window.location.search).get('ecw')).toBeNull();
  });
});
