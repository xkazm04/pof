import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => { const f = () => ({ className: 'm', variable: '--m' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { MatrixSkeleton } from '@/components/layout-lab/MatrixSkeleton';
import { LIGHT } from '@/components/layout-lab/theme';

afterEach(cleanup);

describe('MatrixSkeleton', () => {
  it('renders shimmer cells for a rows × cols grid (loading, not an all-pending flash)', () => {
    const { getByTestId, getAllByTestId } = render(<MatrixSkeleton t={LIGHT} rows={3} cols={4} reduce={false} />);
    expect(getByTestId('matrix-skeleton')).toBeTruthy();
    // 3 rows × (1 name cell + 4 step cells) = 15 shimmer blocks.
    const blocks = getAllByTestId('lab-skeleton');
    expect(blocks.length).toBe(3 * (1 + 4));
    expect(blocks[0].className).toContain('lab-shimmer');
  });

  it('drops the shimmer animation under reduced motion (static fill)', () => {
    const { getAllByTestId } = render(<MatrixSkeleton t={LIGHT} rows={1} cols={2} reduce />);
    for (const b of getAllByTestId('lab-skeleton')) {
      expect(b.className).not.toContain('lab-shimmer');
    }
  });
});
