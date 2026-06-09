import { describe, it, expect, afterEach, beforeEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

// Drive the dashboard data per test without any network round-trip.
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
        successRate: 0.75, // → "Good"
        avgDurationMs: 50_000,
        avgSuccessDurationMs: 45_000,
        avgFailDurationMs: 60_000,
        contextInjectedCount: 5,
        contextInjectedSuccessRate: 0.9,
        noContextCount: 3,
        noContextSuccessRate: 0.5,
      },
    ],
    insights: [
      {
        type: 'context-injection',
        moduleId: mid('arpg-combat'),
        message: 'Context injection helps here',
        factor: 3,
        confidence: 0.82, // → "82% confidence"
        suggestion: 'Keep injecting project context.',
      },
    ],
    qualityScores: [
      { moduleId: mid('arpg-combat'), score: 85, trend: 'improving', recentSuccessRate: 0.9, overallSuccessRate: 0.8, sessionsRecorded: 8 }, // Good
      { moduleId: mid('arpg-loot'), score: 55, trend: 'stable', recentSuccessRate: 0.5, overallSuccessRate: 0.5, sessionsRecorded: 4 }, // Fair
      { moduleId: mid('arpg-ui'), score: 20, trend: 'declining', recentSuccessRate: 0.2, overallSuccessRate: 0.2, sessionsRecorded: 2 }, // Low
    ],
    recentSessions: [
      {
        id: 1,
        moduleId: mid('arpg-combat'),
        sessionKey: 'k1',
        prompt: 'Implement a dash ability with cooldown and i-frames',
        promptPreview: 'Implement a dash ability with cooldown and i-frames',
        hadProjectContext: true,
        promptLength: 50,
        success: true,
        durationMs: 45_000,
        startedAt: '2026-06-01T00:00:00Z',
        completedAt: '2026-06-01T00:01:00Z',
      },
    ],
  };
}

describe('SessionAnalyticsDashboard — accessibility + plain language', () => {
  beforeEach(() => {
    dashboardRef.current = makeDashboard();
  });

  // ── Phase 1: color-blind-safe status + responsive KPI grid ──

  it('renders the overview KPI grid as 2 columns, expanding to 4 at the sm breakpoint', () => {
    const { container } = render(<SessionAnalyticsDashboard />);
    const grid = container.querySelector('.grid');
    expect(grid?.className).toContain('grid-cols-2');
    expect(grid?.className).toContain('sm:grid-cols-4');
  });

  it('encodes status with a word (Good/Fair/Low), not hue alone', () => {
    render(<SessionAnalyticsDashboard />);
    // Both the quality row (85) and the module row (75%) read "Good".
    expect(screen.getAllByText('Good').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Fair')).toBeTruthy(); // quality 55
    expect(screen.getByText('Low')).toBeTruthy(); // quality 20
  });

  it('relabels the context-impact legend in plain language when a module expands', () => {
    render(<SessionAnalyticsDashboard />);
    const moduleRow = screen.getByRole('button', { expanded: false });
    fireEvent.click(moduleRow);
    expect(screen.getByText(/With context:/)).toBeTruthy();
    expect(screen.getByText(/Without context:/)).toBeTruthy();
  });

  // ── Phase 2: plain-language labels + tooltips ──

  it('spells out abbreviations: "confidence" not "conf", "context" not "ctx"', () => {
    render(<SessionAnalyticsDashboard />);
    expect(screen.getByText(/82% confidence/)).toBeTruthy();
    expect(screen.queryByText(/% conf$/)).toBeNull();
    expect(screen.getByText('context')).toBeTruthy();
    expect(screen.queryByText('ctx')).toBeNull();
  });

  it('reveals the full phrase for the context badge via the Tooltip primitive on focus', () => {
    render(<SessionAnalyticsDashboard />);
    fireEvent.focus(screen.getByText('context'));
    expect(screen.getByRole('tooltip').textContent).toContain('Used project context');
  });

  it('adds a one-line plain-language helper under each section header', () => {
    render(<SessionAnalyticsDashboard />);
    expect(screen.getByText(/Patterns the assistant noticed/)).toBeTruthy();
    expect(screen.getByText(/scored 0–100/)).toBeTruthy();
    expect(screen.getByText(/share of CLI tasks/)).toBeTruthy();
    expect(screen.getByText(/most recent CLI task runs/)).toBeTruthy();
  });
});
