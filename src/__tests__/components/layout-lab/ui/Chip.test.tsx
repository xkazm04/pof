import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Chip } from '@/components/layout-lab/ui/Chip';

afterEach(cleanup);

describe('Chip', () => {
  it('maps each tone to its --lab-* color token', () => {
    const cases: Array<[Parameters<typeof Chip>[0]['tone'], string]> = [
      ['neutral', 'var(--lab-muted)'], ['accent', 'var(--lab-accent)'],
      ['ok', 'var(--lab-ok)'], ['warn', 'var(--lab-warn)'], ['bad', 'var(--lab-bad)'],
    ];
    for (const [tone, token] of cases) {
      const { unmount } = render(<Chip tone={tone} data-testid="c">x</Chip>);
      expect(screen.getByTestId('c').style.color).toContain(token);
      unmount();
    }
  });
  it('forwards arbitrary span attributes (role, aria-label)', () => {
    render(<Chip role="status" aria-label="job status" data-testid="c">x</Chip>);
    const el = screen.getByTestId('c');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-label')).toBe('job status');
  });
});
