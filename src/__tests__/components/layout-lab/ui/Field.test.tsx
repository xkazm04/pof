import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Field, Input } from '@/components/layout-lab/ui/Field';

afterEach(cleanup);

describe('Field', () => {
  it('associates the label with the input via htmlFor', () => {
    render(<Field label="Direction" htmlFor="dir"><Input id="dir" /></Field>);
    const input = screen.getByLabelText('Direction');
    expect(input).toBeTruthy();
    expect(input.id).toBe('dir');
  });
});
