/**
 * TelemetryEvolution hardening (scan-sweep night 2026-11-08, core-engine-scan-telemetry).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import type { TelemetryStats, GenreEvolutionSuggestion } from '@/types/telemetry';

afterEach(cleanup);

// Heavy children that fetch on their own — not what these tests are about.
vi.mock('@/components/modules/core-engine/GenreTemplateGallery', () => ({ GenreTemplateGallery: () => null }));
vi.mock('@/components/modules/core-engine/GenreDnaTimeline', () => ({ GenreDnaTimeline: () => null }));

const hook = vi.hoisted(() => ({
  stats: null as TelemetryStats | null,
  resolveSuggestion: (() => Promise.resolve()) as (id: string, a: 'accept' | 'dismiss') => Promise<void>,
  renders: 0,
}));
vi.mock('@/hooks/useGenreEvolution', () => ({
  useGenreEvolution: () => {
    hook.renders += 1;
    return {
      stats: hook.stats,
      history: [],
      loading: false,
      scanning: false,
      scanError: null,
      refresh: vi.fn(),
      scanProject: vi.fn(),
      resolveSuggestion: hook.resolveSuggestion,
    };
  },
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

function stats(over: Partial<TelemetryStats> = {}): TelemetryStats {
  return {
    totalScans: 1, lastScanAt: '2026-11-08T00:00:00Z',
    detectedPatterns: [], activeSuggestions: [suggestion()], acceptedSubGenres: [],
    ...over,
  } as TelemetryStats;
}

describe('TelemetryEvolution — suggestion resolution failure', () => {
  beforeEach(() => { hook.stats = stats(); hook.renders = 0; });

  it('a failed Accept is reported in the panel, not left as an unhandled rejection', async () => {
    hook.resolveSuggestion = vi.fn(() => Promise.reject(new Error('HTTP 500')));
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      render(<TelemetryEvolution />);
      fireEvent.click(screen.getByText('Lean souls-like'));
      await act(async () => { fireEvent.click(screen.getByText('Accept Evolution')); });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      const alert = document.querySelector('[data-testid="genre-resolve-error"]');
      expect(alert?.textContent ?? '').toContain('HTTP 500');
      expect(alert?.getAttribute('role')).toBe('alert');
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
