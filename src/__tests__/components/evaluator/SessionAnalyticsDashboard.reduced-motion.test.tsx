import { describe, it, expect, afterEach, beforeEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { AnalyticsDashboard } from '@/types/session-analytics';
import type { SubModuleId } from '@/types/modules';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// TruncateWithTooltip observes overflow via ResizeObserver, which jsdom lacks.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

// Drive reduced-motion deterministically; keep real motion/StatBar so the
// instant-fill behavior is exercised end-to-end.
const motionState = vi.hoisted(() => ({ reduced: false as boolean | null }));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => motionState.reduced };
});

const dashboardRef = { current: {} as AnalyticsDashboard };
vi.mock('@/hooks/useSessionAnalytics', () => ({
  useSessionDashboard: () => ({
    dashboard: dashboardRef.current,
    isLoading: false,
    error: null,
    retry: vi.fn(),
    refetch: vi.fn(),
  }),
}));

import { SessionAnalyticsDashboard } from '@/components/modules/evaluator/SessionAnalyticsDashboard';

const mid = (s: string): SubModuleId => s as SubModuleId;

function makeDashboard(): AnalyticsDashboard {
  return {
    totalSessions: 12,
    overallSuccessRate: 0.75,
    totalDurationMs: 600_000,
    moduleStats: [
      {
        moduleId: mid('arpg-combat'),
        totalSessions: 8,
        successCount: 6,
        failCount: 2,
        successRate: 0.75, // → 75% bar
        avgDurationMs: 50_000,
        avgSuccessDurationMs: 45_000,
        avgFailDurationMs: 60_000,
        contextInjectedCount: 5,
        contextInjectedSuccessRate: 0.9,
        noContextCount: 3,
        noContextSuccessRate: 0.5,
      },
    ],
    insights: [],
    qualityScores: [
      { moduleId: mid('arpg-combat'), score: 85, trend: 'improving', recentSuccessRate: 0.9, overallSuccessRate: 0.8, sessionsRecorded: 8 },
    ],
    recentSessions: [],
  };
}

describe('SessionAnalyticsDashboard honors prefers-reduced-motion', () => {
  beforeEach(() => {
    dashboardRef.current = makeDashboard();
  });

  it('renders the module success bar at full width with no fill transition under reduced motion', () => {
    motionState.reduced = true;
    render(<SessionAnalyticsDashboard />);

    // ModuleStatsRow passes an ariaLabel → the bar exposes a progressbar role.
    const bar = screen.getByRole('progressbar', { name: /success rate/i });
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('75%');
    expect(fill.style.transitionDuration).toBe('0ms');
    expect(fill.style.transitionProperty).toBe('none');
    expect(bar.getAttribute('aria-valuenow')).toBe('75');
  });

  it('still renders the dashboard content under reduced motion', () => {
    motionState.reduced = true;
    render(<SessionAnalyticsDashboard />);
    expect(screen.getByText('Prompt Quality by Module')).toBeTruthy();
    expect(screen.getByText('Module Performance')).toBeTruthy();
  });
});
