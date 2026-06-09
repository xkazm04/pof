import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { CrashTerm, DecoratedCrashText } from '@/components/ui/CrashTerm';

// The shared setup does not auto-cleanup; renders share document.body otherwise.
afterEach(cleanup);

describe('CrashTerm', () => {
  it('renders the term label', () => {
    const { getByText } = render(<CrashTerm term="GAS" />);
    expect(getByText('GAS')).toBeTruthy();
  });

  it('exposes the plain-English explanation as an aria-label', () => {
    const { getByRole } = render(<CrashTerm term="GAS" />);
    expect(getByRole('button').getAttribute('aria-label')).toMatch(/GAS:.*gameplay ability system/i);
  });

  it('reveals the tooltip text on focus', () => {
    const { getByRole, queryByRole } = render(<CrashTerm term="GC" />);
    expect(queryByRole('tooltip')).toBeNull();
    fireEvent.focus(getByRole('button'));
    expect(getByRole('tooltip').textContent).toMatch(/garbage collection/i);
  });

  it('drops the dotted underline when underline=false', () => {
    const { getByRole, rerender } = render(<CrashTerm term="GAS" />);
    expect(getByRole('button').className).toContain('decoration-dotted');
    rerender(<CrashTerm term="GAS" underline={false} />);
    expect(getByRole('button').className).not.toContain('decoration-dotted');
  });

  it('renders an unknown term as plain text with no tooltip trigger (fail-soft)', () => {
    const { queryByRole, getByText } = render(<CrashTerm term="NopeNotReal" />);
    expect(getByText('NopeNotReal')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });
});

describe('DecoratedCrashText', () => {
  it('wraps raw engine tokens in a tooltip trigger', () => {
    const { getByRole } = render(
      <DecoratedCrashText text="Null AbilitySystemComponent accessed during activation" />,
    );
    expect(getByRole('button').textContent).toBe('AbilitySystemComponent');
  });

  it('leaves everyday prose words undecorated', () => {
    const { queryAllByRole, container } = render(
      <DecoratedCrashText text="The game ran out of memory and had to quit" />,
    );
    expect(queryAllByRole('button')).toHaveLength(0);
    expect(container.textContent).toBe('The game ran out of memory and had to quit');
  });

  it('preserves the full original message text', () => {
    const msg = 'Use TWeakObjectPtr instead of a raw pointer.';
    const { container } = render(<DecoratedCrashText text={msg} />);
    expect(container.textContent).toBe(msg);
  });
});
