import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { TermChip, DecoratedJargon } from '@/components/ui/TermChip';

// The shared setup does not auto-cleanup; renders share document.body otherwise.
afterEach(cleanup);

describe('TermChip', () => {
  it('renders the term label', () => {
    const { getByText } = render(<TermChip term="CPF_Edit" />);
    expect(getByText('CPF_Edit')).toBeTruthy();
  });

  it('exposes the plain-English explanation as an aria-label', () => {
    const { getByRole } = render(<TermChip term="CPF_Edit" />);
    expect(getByRole('button').getAttribute('aria-label')).toMatch(/CPF_Edit:.*details panel/i);
  });

  it('reveals the tooltip text on focus', () => {
    const { getByRole, queryByRole } = render(<TermChip term="EGPD_Output" />);
    expect(queryByRole('tooltip')).toBeNull();
    fireEvent.focus(getByRole('button'));
    expect(getByRole('tooltip').textContent).toMatch(/output pin/i);
  });

  it('carries the dotted-underline affordance by default and drops it for solid badges', () => {
    const { getByRole, rerender } = render(<TermChip term="MOD" />);
    expect(getByRole('button').className).toContain('decoration-dotted');
    rerender(<TermChip term="MOD" underline={false} />);
    expect(getByRole('button').className).not.toContain('decoration-dotted');
  });

  it('renders an unknown term as plain text with no tooltip trigger (fail-soft)', () => {
    const { queryByRole, getByText } = render(<TermChip term="NopeNotReal" />);
    expect(getByText('NopeNotReal')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });
});

describe('DecoratedJargon', () => {
  it('wraps raw engine tokens in a tooltip trigger', () => {
    const { getByRole } = render(
      <DecoratedJargon text={'Node type "K2Node_Timeline" needs manual translation'} />,
    );
    expect(getByRole('button').textContent).toBe('K2Node_Timeline');
  });

  it('leaves everyday prose words undecorated', () => {
    const { queryAllByRole, container } = render(
      <DecoratedJargon text="Unknown event: BeginPlay" />,
    );
    expect(queryAllByRole('button')).toHaveLength(0);
    expect(container.textContent).toBe('Unknown event: BeginPlay');
  });

  it('preserves the full original message text', () => {
    const msg = 'Node type "K2Node_Timeline" needs manual translation';
    const { container } = render(<DecoratedJargon text={msg} />);
    expect(container.textContent).toBe(msg);
  });
});
