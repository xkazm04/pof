/**
 * Suggestion Accept/Dismiss pending guard (scan-sweep night 2026-11-08, core-engine-scan-telemetry).
 * While one resolve POST is in flight, a second click must not send another.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import type { TelemetryStats, GenreEvolutionSuggestion } from '@/types/telemetry';

afterEach(cleanup);

vi.mock('@/components/modules/core-engine/GenreTemplateGallery', () => ({ GenreTemplateGallery: () => null }));
vi.mock('@/components/modules/core-engine/GenreDnaTimeline', () => ({ GenreDnaTimeline: () => null }));

const hook = vi.hoisted(() => ({
  stats: null as TelemetryStats | null,
  resolveSuggestion: (() => Promise.resolve()) as (id: string, a: 'accept' | 'dismiss') => Promise<void>,
}));
vi.mock('@/hooks/useGenreEvolution', () => ({
  useGenreEvolution: () => ({
    stats: hook.stats, history: [], loading: false, loadError: null, scanning: false, scanError: null,
    refresh: vi.fn(), scanProject: vi.fn(), resolveSuggestion: hook.resolveSuggestion,
  }),
}));

import { TelemetryEvolution } from '@/components/modules/core-engine/TelemetryEvolution';

function suggestion(): GenreEvolutionSuggestion {
  return {
    id: 'sug-1', subGenre: 'souls-like', label: 'Lean souls-like', description: 'Dodge-heavy.',
    confidence: 72, patterns: [], status: 'pending',
    proposedChanges: { prioritize: [], deprioritize: [], add: [] },
    createdAt: '2026-11-08T00:00:00Z', resolvedAt: null,
  };
}

describe('TelemetryEvolution - suggestion pending guard', () => {
  beforeEach(() => {
    hook.stats = {
      totalScans: 1, lastScanAt: '2026-11-08T00:00:00Z', detectedPatterns: [],
      activeSuggestions: [suggestion()], acceptedSubGenres: [],
    } as unknown as TelemetryStats;
  });

  it('Accept then Dismiss while the first POST is pending sends exactly one', async () => {
    const spy = vi.fn(() => new Promise<void>(() => {}));
    hook.resolveSuggestion = spy;
    render(<TelemetryEvolution />);
    fireEvent.click(screen.getByText('Lean souls-like'));
    await act(async () => { fireEvent.click(screen.getByText('Accept Evolution')); });
    await act(async () => { fireEvent.click(screen.getByText('Dismiss')); });
    await act(async () => { fireEvent.click(screen.getByText('Accept Evolution')); });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('buttons re-enable after a failed resolve', async () => {
    const spy = vi.fn(() => Promise.reject(new Error('HTTP 500')));
    hook.resolveSuggestion = spy;
    render(<TelemetryEvolution />);
    fireEvent.click(screen.getByText('Lean souls-like'));
    await act(async () => { fireEvent.click(screen.getByText('Accept Evolution')); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    await act(async () => { fireEvent.click(screen.getByText('Dismiss')); });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
