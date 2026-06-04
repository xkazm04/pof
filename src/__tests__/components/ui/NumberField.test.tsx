import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NumberField } from '@/components/ui/NumberField';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const base = { min: 1, max: 50, fallback: 1, ariaLabel: 'Player level' } as const;

describe('NumberField', () => {
  it('edits raw text without clamping per keystroke (no commit until blur)', () => {
    const onChange = vi.fn();
    render(<NumberField value={5} {...base} onChange={onChange} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '999' } });
    expect(input.value).toBe('999'); // raw text preserved mid-edit
    expect(onChange).not.toHaveBeenCalled(); // not clamped yet
  });

  it('validates and clamps to the max on blur', () => {
    const onChange = vi.fn();
    render(<NumberField value={5} {...base} onChange={onChange} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(50);
    expect(input.value).toBe('50'); // normalized display
  });

  it('allows clearing while editing and commits the fallback on blur (no NaN, no mid-edit snap)', () => {
    const onChange = vi.fn();
    render(<NumberField value={5} {...base} onChange={onChange} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe(''); // empty allowed mid-edit
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(1); // fallback on commit
  });

  it('exposes aria value bounds for assistive tech', () => {
    render(<NumberField value={5} {...base} onChange={() => {}} />);
    const input = screen.getByRole('spinbutton');
    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('50');
    expect(input.getAttribute('aria-valuenow')).toBe('5');
  });

  it('re-syncs displayed text when the committed value changes externally (e.g. Reset)', () => {
    const { rerender } = render(<NumberField value={5} {...base} onChange={() => {}} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '7' } }); // dirty, uncommitted
    rerender(<NumberField value={20} {...base} onChange={() => {}} />);
    expect(input.value).toBe('20'); // external value wins
  });
});
