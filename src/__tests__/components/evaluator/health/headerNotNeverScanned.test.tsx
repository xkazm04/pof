/** The header may only say "No scans yet" once the history has loaded and is empty. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { HealthHeader } from '@/components/modules/evaluator/ProjectHealthDashboard/HealthHeader';

afterEach(cleanup);

const base = { lastScan: null, scanHistory: [], showHistoryOverlay: false, setShowHistoryOverlay: vi.fn() };

describe('HealthHeader without a scan', () => {
  it('a failed load does not claim the project was never scanned', () => {
    render(<HealthHeader {...base} isLoading={false} loadFailed />);
    expect(screen.queryByText('No scans yet')).toBeNull();
    expect(screen.getByText('Scan history unavailable')).toBeTruthy();
  });

  it('a pending load does not claim it either', () => {
    render(<HealthHeader {...base} isLoading loadFailed={false} />);
    expect(screen.queryByText('No scans yet')).toBeNull();
  });

  it('a loaded empty history does', () => {
    render(<HealthHeader {...base} isLoading={false} loadFailed={false} />);
    expect(screen.getByText('No scans yet')).toBeTruthy();
  });
});
