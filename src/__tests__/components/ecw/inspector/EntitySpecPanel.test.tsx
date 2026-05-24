import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EntitySpecPanel } from '@/components/ecw/inspector/EntitySpecPanel';

describe('EntitySpecPanel', () => {
  afterEach(cleanup);

  it('renders the Spec title', () => {
    render(<EntitySpecPanel data={{ a: 1 }} />);
    expect(screen.getByText('Spec')).toBeTruthy();
  });

  it('renders the data as JSON by default (open)', () => {
    render(<EntitySpecPanel data={{ damage: 25, radius: 300 }} />);
    expect(screen.getByText(/"damage"/)).toBeTruthy();
    expect(screen.getByText(/25/)).toBeTruthy();
  });

  it('clicking the title collapses the panel', () => {
    render(<EntitySpecPanel data={{ damage: 25 }} />);
    expect(screen.getByText(/"damage"/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /toggle Spec/i }));
    expect(screen.queryByText(/"damage"/)).toBeNull();
  });

  it('handles missing data gracefully', () => {
    render(<EntitySpecPanel data={undefined} />);
    expect(screen.getByText(/no spec data/i)).toBeTruthy();
  });
});
