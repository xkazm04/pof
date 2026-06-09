import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Deterministic reduced-motion + avoid jsdom matchMedia / font gaps.
const motionState = vi.hoisted(() => ({ reduced: false as boolean | null }));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => motionState.reduced };
});
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { HolisticHealthView } from '@/components/modules/evaluator/HolisticHealthView';
import { useProjectHealthStore } from '@/stores/projectHealthStore';
import { usePerformanceProfilingStore } from '@/stores/performanceProfilingStore';
import { useCrashAnalyzerStore } from '@/stores/crashAnalyzerStore';
import type { ProjectHealthSummary, SubsystemSignal } from '@/types/project-health';
import type { TriageResult } from '@/types/performance-profiling';

const SIGNALS: SubsystemSignal[] = [
  { subsystem: 'checklist', label: 'Checklist Engine', status: 'healthy', metric: '4/12 modules started', detail: 'x' },
  { subsystem: 'evaluator', label: 'Quality Evaluator', status: 'warning', metric: 'Score 55/100', detail: 'x', linkTab: 'scanner' },
  { subsystem: 'crash-analyzer', label: 'Crash Analyzer', status: 'critical', metric: '7 crashes', detail: 'Most in arpg-combat · 2 in 24h', linkTab: 'crashes' },
  { subsystem: 'performance', label: 'Performance Profiling', status: 'healthy', metric: 'Score 82/100', detail: '58 FPS · game-thread-bound', linkTab: 'perf' },
];

const SUMMARY: ProjectHealthSummary = {
  overallCompletion: 40,
  totalChecklistItems: 100,
  completedChecklistItems: 40,
  currentQualityScore: 55,
  performanceScore: 82,
  qualityTrend: 'improving',
  avgVelocity: 3,
  moduleHealth: [],
  velocityHistory: [],
  qualityHistory: [],
  milestones: [],
  burnChart: [],
  subsystemSignals: SIGNALS,
};

const TRIAGE: TriageResult = {
  sessionId: 'sess-1',
  findings: [],
  overallScore: 82,
  bottleneck: 'game-thread',
  generatedAt: '2026-06-01T00:00:00.000Z',
};

function seed() {
  // No-op fetchHealth so the on-mount refresh doesn't overwrite the seeded summary.
  useProjectHealthStore.setState({
    summary: SUMMARY,
    moduleHealth: SUMMARY.moduleHealth,
    velocityHistory: SUMMARY.velocityHistory,
    qualityHistory: SUMMARY.qualityHistory,
    milestones: SUMMARY.milestones,
    burnChart: SUMMARY.burnChart,
    subsystemSignals: SUMMARY.subsystemSignals,
    isLoading: false,
    error: null,
    fetchHealth: async () => {},
  });
  usePerformanceProfilingStore.setState({ triage: TRIAGE, activeSession: null });
  // No-op so the on-mount crash fetch doesn't clobber seeded state / hit the network.
  useCrashAnalyzerStore.setState({ fetchAnalysis: async () => {} });
}

describe('HolisticHealthView — fused performance + crash signals', () => {
  beforeEach(() => {
    motionState.reduced = false;
    seed();
  });

  it('renders the real Performance dimension score from the fused summary', () => {
    render(<HolisticHealthView />);
    // The Performance dimension card surfaces the triage score (82) and its label.
    expect(screen.getByText('Performance')).toBeTruthy();
    expect(screen.getAllByText('82').length).toBeGreaterThan(0);
  });

  it('drills into the performance profiling tab when its subsystem signal is clicked', () => {
    const onNavigateTab = vi.fn();
    render(<HolisticHealthView onNavigateTab={onNavigateTab} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Performance Profiling' }));
    expect(onNavigateTab).toHaveBeenCalledWith('perf');
  });

  it('drills into the crash analyzer tab when its subsystem signal is clicked', () => {
    const onNavigateTab = vi.fn();
    render(<HolisticHealthView onNavigateTab={onNavigateTab} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Crash Analyzer' }));
    expect(onNavigateTab).toHaveBeenCalledWith('crashes');
  });

  it('renders subsystem signals statically (not as buttons) when no navigation handler is provided', () => {
    render(<HolisticHealthView />);
    // Without onNavigateTab, the drillable signals fall back to non-interactive cards.
    expect(screen.queryByRole('button', { name: 'Open Performance Profiling' })).toBeNull();
    // The signal content still renders.
    expect(screen.getByText('Performance Profiling')).toBeTruthy();
  });
});
