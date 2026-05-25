import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ShellSwitcher } from '@/components/ecw/ShellSwitcher';
import { readShellPref } from '@/lib/ecw/shell-pref';

describe('ShellSwitcher', () => {
  afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

  it('renders both shell options', () => {
    render(<ShellSwitcher />);
    expect(screen.getByRole('button', { name: /legacy/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /new/i })).toBeTruthy();
  });

  it('defaults to New pressed (ECW is the default shell)', () => {
    render(<ShellSwitcher />);
    expect(screen.getByRole('button', { name: /new/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /legacy/i }).getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking Legacy sets the legacy pref + url flag', () => {
    render(<ShellSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /legacy/i }));
    expect(readShellPref()).toBe('legacy');
    expect(window.location.search).toContain('legacy=1');
  });

  it('clicking New clears the legacy flag + pref', () => {
    window.history.replaceState({}, '', '/?legacy=1');
    render(<ShellSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    expect(readShellPref()).toBe('ecw');
    expect(new URLSearchParams(window.location.search).get('legacy')).toBeNull();
  });

  it('uses no arbitrary hex color class on the active button', () => {
    const { container } = render(<ShellSwitcher />);
    expect(container.innerHTML).not.toMatch(/\[#[0-9a-fA-F]{3,8}\]/);
  });
});
