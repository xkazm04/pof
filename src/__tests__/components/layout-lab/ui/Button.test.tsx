import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Button } from '@/components/layout-lab/ui/Button';

afterEach(cleanup);

describe('Button', () => {
  it('fires onClick and carries the focus-ring class', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    const btn = screen.getByRole('button', { name: 'Go' });
    expect(btn.className).toContain('focus-ring');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });
  it('marks the active variant via aria-pressed', () => {
    render(<Button active>On</Button>);
    expect(screen.getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe('true');
  });
  it('accent variant uses accent tokens', () => {
    render(<Button variant="accent">A</Button>);
    expect(screen.getByRole('button', { name: 'A' }).style.background).toContain('var(--lab-accent)');
  });
});
