import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ProgressRing } from '@/components/ui/ProgressRing';

afterEach(cleanup);

function arc(container: HTMLElement) {
  const c = container.querySelectorAll('circle')[1];
  return {
    offset: Number(c.getAttribute('stroke-dashoffset')),
    full: Number(c.getAttribute('stroke-dasharray')),
  };
}

describe('ProgressRing out-of-range values', () => {
  it('stops the arc at full and reports a valid aria-valuenow above 100', () => {
    const { container, getByRole } = render(<ProgressRing value={150} />);
    expect(arc(container).offset).toBe(0);
    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('draws an empty arc below 0', () => {
    const { container } = render(<ProgressRing value={-20} />);
    const { offset, full } = arc(container);
    expect(offset).toBe(full);
  });

  it('never renders NaN', () => {
    const { container, getByRole } = render(<ProgressRing value={Number.NaN} />);
    expect(container.textContent).not.toContain('NaN');
    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(getByRole('progressbar').getAttribute('aria-label')).not.toContain('NaN');
  });
});
