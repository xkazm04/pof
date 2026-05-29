import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Panel } from '@/components/layout-lab/ui/Panel';

afterEach(cleanup);

describe('Panel', () => {
  it('renders children inside a token-styled surface', () => {
    render(<Panel data-testid="p">hi</Panel>);
    const el = screen.getByTestId('p');
    expect(el.textContent).toBe('hi');
    expect(el.style.background).toContain('var(--lab-panel)');
    expect(el.style.border).toContain('var(--lab-line)');
  });
  it('applies elevation level via token', () => {
    render(<Panel data-testid="p" elevation={2}>x</Panel>);
    expect(screen.getByTestId('p').style.boxShadow).toContain('var(--lab-elev-2)');
  });
});
