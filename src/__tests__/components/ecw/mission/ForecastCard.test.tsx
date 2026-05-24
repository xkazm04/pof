import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ForecastCard } from '@/components/ecw/mission/ForecastCard';

describe('ForecastCard', () => {
  afterEach(cleanup);

  it('renders the card title', () => {
    render(<ForecastCard />);
    expect(screen.getByRole('heading', { level: 2, name: /Forecast/ })).toBeTruthy();
  });

  it('lists Phase 10 enhancement anchors', () => {
    render(<ForecastCard />);
    expect(screen.getByText(/playable-by ETA/i)).toBeTruthy();
    expect(screen.getByText(/NBA queue/i)).toBeTruthy();
  });
});
