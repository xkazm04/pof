import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type {
  TelemetryStats,
  TelemetrySnapshot,
  TelemetrySignals,
} from '@/types/telemetry';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Drive reduced-motion deterministically AND replace motion.* with plain
// elements that stamp their `transition` prop onto data-transition, so we can
// assert every transition collapses to duration 0 under reduced motion.
const motionState = vi.hoisted(() => ({ reduced: false as boolean | null }));
// framer-only props that must not leak onto real DOM elements.
const FRAMER_PROPS = new Set([
  'initial', 'animate', 'exit', 'transition', 'variants', 'layout', 'layoutId',
  'whileHover', 'whileTap', 'whileInView', 'whileFocus', 'whileDrag', 'drag',
]);
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  const React = await import('react');
  const motion = new Proxy({} as Record<string, unknown>, {
    get: (_t, tag: string) =>
      function MockMotion(props: Record<string, unknown> & { children?: React.ReactNode }) {
        const domProps: Record<string, unknown> = {
          'data-transition': JSON.stringify(props.transition ?? null),
        };
        for (const key of Object.keys(props)) {
          if (key !== 'children' && !FRAMER_PROPS.has(key)) domProps[key] = props[key];
        }
        return React.createElement(tag, domProps, props.children);
      },
  });
  return {
    ...actual,
    motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => motionState.reduced,
  };
});

// Feed deterministic telemetry data — patterns + suggestions + accepted + a
// 2-scan history so PatternsList / SuggestionsList / AcceptedGenres / ScanHistory
// / GenreDnaTimeline all mount and contribute their animations.
const dataRef = vi.hoisted(() => ({
  current: {
    stats: null as TelemetryStats | null,
    history: [] as TelemetrySnapshot[],
  },
}));
vi.mock('@/hooks/useGenreEvolution', () => ({
  useGenreEvolution: () => ({
    stats: dataRef.current.stats,
    history: dataRef.current.history,
    loading: false,
    scanning: false,
    refresh: vi.fn(),
    scanProject: vi.fn(),
    resolveSuggestion: vi.fn(),
  }),
}));

import { TelemetryEvolution } from '@/components/modules/core-engine/TelemetryEvolution';

function makeSignals(): TelemetrySignals {
  return {
    gasAbilityCount: 4, gameplayEffectCount: 6, behaviorTreeCount: 2, eqsQueryCount: 1,
    widgetClassCount: 3, saveGameFieldCount: 5, hasDodgeAbility: true, hasComboSystem: false,
    hasProjectileSystem: false, hasLootTables: true, hasDialogueSystem: false,
    hasCraftingSystem: false, hasMultiplayerReplication: false, hasProceduralGeneration: false,
    hasStealthMechanics: false, estimatedActorCount: 120, niagaraSystemCount: 8,
    totalSourceFiles: 40, totalHeaderFiles: 38, moduleCount: 2,
  };
}

function makeSnapshot(id: string, when: string, confidence: number): TelemetrySnapshot {
  return {
    id,
    scannedAt: when,
    projectPath: 'C:/fake/PoF',
    signals: makeSignals(),
    detectedPatterns: [
      { pattern: 'dodge-roll-heavy', confidence, evidence: ['frequent dodge'], detectedAt: when },
    ],
  };
}

function makeStats(): TelemetryStats {
  return {
    totalScans: 3,
    lastScanAt: '2026-06-02T00:00:00Z',
    detectedPatterns: [
      { pattern: 'dodge-roll-heavy', confidence: 80, evidence: ['frequent dodge'], detectedAt: '2026-06-02T00:00:00Z' },
    ],
    activeSuggestions: [
      {
        id: 'sug-1',
        subGenre: 'souls-like',
        label: 'Evolve toward Souls-like',
        description: 'Your project leans dodge-heavy.',
        confidence: 75,
        patterns: [
          { pattern: 'dodge-roll-heavy', confidence: 80, evidence: ['frequent dodge'], detectedAt: '2026-06-02T00:00:00Z' },
        ],
        status: 'pending',
        proposedChanges: { prioritize: [], deprioritize: [], add: [] },
        createdAt: '2026-06-02T00:00:00Z',
        resolvedAt: null,
      },
    ],
    acceptedSubGenres: ['diablo-like'],
  };
}

function transitionsIn(container: HTMLElement): Record<string, unknown>[] {
  return Array.from(container.querySelectorAll('[data-transition]'))
    .map((el) => JSON.parse(el.getAttribute('data-transition') || 'null'))
    .filter(Boolean);
}

describe('TelemetryEvolution honors prefers-reduced-motion', () => {
  beforeEach(() => {
    dataRef.current = {
      stats: makeStats(),
      history: [
        makeSnapshot('s2', '2026-06-02T00:00:00Z', 80),
        makeSnapshot('s1', '2026-06-01T00:00:00Z', 60),
      ],
    };
  });

  it('uses positive-duration entrance/draw transitions when motion is allowed', () => {
    motionState.reduced = false;
    const { container } = render(<TelemetryEvolution />);
    const ts = transitionsIn(container);
    expect(ts.length).toBeGreaterThan(0);
    // Some transition carries a real (non-zero) duration when motion is allowed.
    expect(ts.some((t) => typeof t.duration === 'number' && (t.duration as number) > 0)).toBe(true);
  });

  it('collapses every transition to duration 0 (no stagger delay) under reduced motion', () => {
    motionState.reduced = true;
    const { container } = render(<TelemetryEvolution />);
    const ts = transitionsIn(container);
    expect(ts.length).toBeGreaterThan(0);
    ts.forEach((t) => {
      expect(t.duration).toBe(0);
      // motionSafe drops delay/ease entirely, so stagger never fires.
      expect(t.delay ?? 0).toBe(0);
      expect(t.ease).toBeUndefined();
    });
  });

  it('still renders all telemetry content under reduced motion', () => {
    motionState.reduced = true;
    render(<TelemetryEvolution />);
    expect(screen.getByText('Genre Evolution')).toBeTruthy();
    expect(screen.getByText('Detected Patterns')).toBeTruthy();
    expect(screen.getByText('Evolution Suggestions')).toBeTruthy();
    expect(screen.getByText('Active Sub-Genres')).toBeTruthy();
    expect(screen.getByText('Scan History')).toBeTruthy();
    expect(screen.getByText('Genre DNA Timeline')).toBeTruthy();
  });

  it('keeps the AnimatePresence height reveal instant when a suggestion expands under reduced motion', () => {
    motionState.reduced = true;
    const { container } = render(<TelemetryEvolution />);
    fireEvent.click(screen.getByText('Evolve toward Souls-like'));
    // Expanded details are present...
    expect(screen.getByText('Accept Evolution')).toBeTruthy();
    // ...and no transition (including the height reveal) animates.
    transitionsIn(container).forEach((t) => expect(t.duration).toBe(0));
  });
});
