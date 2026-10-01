import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Field, Input, Textarea } from '@/components/layout-lab/ui/Field';

afterEach(cleanup);

describe('Field', () => {
  it('associates the label with the input via htmlFor', () => {
    render(<Field label="Direction" htmlFor="dir"><Input id="dir" /></Field>);
    const input = screen.getByLabelText('Direction');
    expect(input).toBeTruthy();
    expect(input.id).toBe('dir');
  });

  // lab-ui-primitives/A: a themed adapter must be able to ride Input/Textarea, so the
  // caller's className is MERGED with the focus class, never discarded.
  it('Input merges the caller className with focus-ring-inset', () => {
    render(<Input data-testid="i" className="font-x" />);
    const cls = screen.getByTestId('i').className;
    expect(cls).toContain('font-x');
    expect(cls).toContain('focus-ring-inset');
  });

  it('Textarea merges the caller className with focus-ring-inset', () => {
    render(<Textarea data-testid="ta" className="font-y" />);
    const cls = screen.getByTestId('ta').className;
    expect(cls).toContain('font-y');
    expect(cls).toContain('focus-ring-inset');
  });
});
