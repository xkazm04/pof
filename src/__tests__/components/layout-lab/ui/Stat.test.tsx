import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Stat } from '@/components/layout-lab/ui/Stat';
import { VisuallyHidden } from '@/components/layout-lab/ui/VisuallyHidden';

afterEach(cleanup);

describe('Stat', () => {
  it('renders label + value', () => {
    render(<Stat label="lifecycle" value="verified" />);
    expect(screen.getByText('lifecycle')).toBeTruthy();
    expect(screen.getByText('verified')).toBeTruthy();
  });
});
describe('VisuallyHidden', () => {
  it('renders content offscreen but in the a11y tree', () => {
    render(<VisuallyHidden>skip</VisuallyHidden>);
    const el = screen.getByText('skip');
    expect(el.style.position).toBe('absolute');
  });
});
