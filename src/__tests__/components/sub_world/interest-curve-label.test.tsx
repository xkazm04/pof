import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { InterestCurveChart } from '@/components/modules/core-engine/sub_world/playtime/InterestCurveChart';
import { STATIC_WORLD } from '@/components/modules/core-engine/sub_world/_shared/data';

afterEach(cleanup);

describe('InterestCurveChart accessible name', () => {
  it('names the path it actually draws', () => {
    render(<InterestCurveChart mode="all" world={STATIC_WORLD} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Interest curve across all paths');
  });
  it('[control] critical mode still reads critical path', () => {
    render(<InterestCurveChart mode="critical" world={STATIC_WORLD} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Interest curve across critical path');
  });
});
