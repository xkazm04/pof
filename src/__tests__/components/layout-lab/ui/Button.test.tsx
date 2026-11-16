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
  it('a toggle that is OFF (active={false}) still announces aria-pressed="false"', () => {
    render(<Button active={false}>Grid</Button>);
    expect(screen.getByRole('button', { name: 'Grid' }).getAttribute('aria-pressed')).toBe('false');
  });
  it('a plain action button (no `active` prop) is not a toggle', () => {
    render(<Button>Open</Button>);
    expect(screen.getByRole('button', { name: 'Open' }).getAttribute('aria-pressed')).toBeNull();
  });
  it('a disabled button LOOKS disabled (cursor + dimmed), matching steps/controls LabButton', () => {
    render(<Button disabled>Prev</Button>);
    const b = screen.getByRole('button', { name: 'Prev' }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.style.cursor).toBe('not-allowed');
    expect(b.style.opacity).toBe('0.55');
  });
  it('an enabled button keeps the pointer and full opacity', () => {
    render(<Button>Next</Button>);
    const b = screen.getByRole('button', { name: 'Next' });
    expect(b.style.cursor).toBe('pointer');
    expect(b.style.opacity).toBe('');
  });
  it('accent variant uses accent tokens', () => {
    render(<Button variant="accent">A</Button>);
    expect(screen.getByRole('button', { name: 'A' }).style.background).toContain('var(--lab-accent)');
  });
  it('`current` marks a single-select member via aria-current, not aria-pressed, with the accent fill', () => {
    render(<><Button current>One</Button><Button current={false}>Two</Button></>);
    const one = screen.getByRole('button', { name: 'One' });
    const two = screen.getByRole('button', { name: 'Two' });
    expect(one.getAttribute('aria-current')).toBe('true');
    expect(one.getAttribute('aria-pressed')).toBeNull();
    expect(one.style.background).toContain('var(--lab-accent)');
    expect(two.getAttribute('aria-current')).toBeNull();
    expect(two.getAttribute('aria-pressed')).toBeNull();
  });
});
