import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SparklineBar } from '@/components/modules/evaluator/WeeklyDigestView/SparklineBar';

afterEach(cleanup);

describe('SparklineBar accessible name', () => {
  it('an empty day has no success rate to announce', () => {
    render(<SparklineBar height={2} isEmpty color="red" dayName="Monday" total={0} success={0} pct={0} />);
    expect(screen.getByRole('img', { name: 'Monday: no sessions' })).toBeTruthy();
  });
  it('a measured day announces its figures', () => {
    render(<SparklineBar height={9} isEmpty={false} color="red" dayName="Monday" total={4} success={3} pct={75} />);
    expect(screen.getByRole('img', { name: 'Monday: 4 sessions, 3 successful, 75% success rate' })).toBeTruthy();
  });
});
