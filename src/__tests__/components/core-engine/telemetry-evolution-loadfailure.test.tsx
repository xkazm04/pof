/**
 * A failed telemetry read must surface as a failure with Retry, not as the
 * "0 scans - run your first scan" empty state (feature-design-state-hooks).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { mockFetchRoutes } from '../../setup';

afterEach(cleanup);

vi.mock('@/components/modules/core-engine/GenreTemplateGallery', () => ({ GenreTemplateGallery: () => null }));
vi.mock('@/components/modules/core-engine/GenreDnaTimeline', () => ({ GenreDnaTimeline: () => null }));

import { TelemetryEvolution } from '@/components/modules/core-engine/TelemetryEvolution';

describe('TelemetryEvolution - load failure', () => {
  it('shows an error with Retry instead of the 0-scans empty state when /api/telemetry fails', async () => {
    mockFetchRoutes([
      { match: '/api/telemetry', response: { status: 500, body: { success: false, error: 'db locked' } } },
    ]);
    render(<TelemetryEvolution />);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="genre-load-error"]')).not.toBeNull();
    });
    const alert = document.querySelector('[data-testid="genre-load-error"]');
    expect(alert?.textContent ?? '').toContain('db locked');
    expect(alert?.textContent ?? '').toContain('Retry');
    expect(document.body.textContent ?? '').not.toContain('first scan');
  });
});
