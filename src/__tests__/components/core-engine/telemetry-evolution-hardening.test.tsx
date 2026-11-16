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
import { useProjectStore } from '@/stores/projectStore';

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

describe('TelemetryEvolution — project store subscription', () => {
  beforeEach(() => { hook.stats = stats(); hook.renders = 0; });

  it('does not re-render when an unrelated project-store field changes', () => {
    render(<TelemetryEvolution />);
    const before = hook.renders;
    act(() => { useProjectStore.setState({ isScanning: true, setupStep: 3 }); });
    act(() => { useProjectStore.setState({ isScanning: false, scanError: 'x' }); });
    expect(hook.renders - before).toBe(0);
  });
});

describe('TelemetryEvolution — empty state after scans have run', () => {
  beforeEach(() => { hook.renders = 0; useProjectStore.setState({ projectPath: 'C:/fake/PoF' }); });

  it('says the scans found nothing, not that no scan ever ran', () => {
    hook.stats = stats({ totalScans: 3, activeSuggestions: [] });
    const { container } = render(<TelemetryEvolution />);
    const text = container.textContent ?? '';
    expect(text).not.toContain('No telemetry data yet');
    expect(text).not.toContain('Run First Scan');
    expect(text).toContain('No gameplay patterns detected');
  });

  it('control: with zero scans the first-scan invitation stays', () => {
    hook.stats = stats({ totalScans: 0, lastScanAt: null, activeSuggestions: [] } as Partial<TelemetryStats>);
    const { container } = render(<TelemetryEvolution />);
    expect(container.textContent ?? '').toContain('Run First Scan');
  });
});

import { AcceptedGenres } from '@/components/modules/core-engine/TelemetryEvolution/AcceptedGenres';
import { SuggestionsList } from '@/components/modules/core-engine/TelemetryEvolution/SuggestionsList';
import type { SubGenreId } from '@/types/telemetry';

describe('TelemetryEvolution — unknown sub-genre fallback style', () => {
  const legacy = 'legacy-genre' as SubGenreId;
  // jsdom accepts any value containing var(), so the check is on the authored
  // string: a CSS variable with a hex-alpha suffix glued on ("var(--x)10") is
  // invalid at computed-value time in a browser and paints nothing.
  const VAR_WITH_ALPHA = /var\([^)]*\)[0-9a-fA-F]{2}/;
  const styleOf = (el: Element | null) => el?.getAttribute('style') ?? '';

  it('AcceptedGenres paints a valid tint for a sub-genre with no style entry', () => {
    const { container } = render(<AcceptedGenres genres={[legacy]} />);
    const btn = container.querySelector('button[aria-pressed]');
    expect(styleOf(btn)).not.toBe('');
    expect(styleOf(btn)).not.toMatch(VAR_WITH_ALPHA);
  });

  it('SuggestionsList paints a valid icon tile for a sub-genre with no style entry', () => {
    const sug = { ...suggestion(), subGenre: legacy };
    const { container } = render(
      <SuggestionsList suggestions={[sug]} expandedId={null} onToggle={() => {}} onResolve={() => {}} />,
    );
    const tile = container.querySelector('button div');
    expect(styleOf(tile)).not.toBe('');
    expect(styleOf(tile)).not.toMatch(VAR_WITH_ALPHA);
  });

  it('control: the matcher bites on the broken shape', () => {
    expect('background-color: var(--text-muted)10;').toMatch(VAR_WITH_ALPHA);
    const { container } = render(<AcceptedGenres genres={['souls-like']} />);
    expect(styleOf(container.querySelector('button[aria-pressed]'))).not.toMatch(VAR_WITH_ALPHA);
  });
});

describe('TelemetryEvolution — suggestions state their (global) scope', () => {
  beforeEach(() => { hook.renders = 0; useProjectStore.setState({ projectPath: 'C:/fake/PoF' }); });

  it('the suggestion list says it is not project-scoped, like the accepted sub-genres do', () => {
    hook.stats = stats();
    const { container } = render(<TelemetryEvolution />);
    const note = container.querySelector('[data-testid="suggestions-scope"]');
    expect(note?.textContent ?? '').toMatch(/not project-scoped/);
  });

  it('the foreign-scan note no longer claims the WHOLE panel uses only this project', () => {
    hook.stats = stats({ scope: { foreignRows: 2 } } as Partial<TelemetryStats>);
    const { container } = render(<TelemetryEvolution />);
    const note = container.querySelector('[data-testid="telemetry-scope-note"]')?.textContent ?? '';
    expect(note).toContain('2 scans');
    expect(note).not.toContain('this panel');
  });
});
