/**
 * scan-sweep --optimize (holistic-quality-overview, night 2026-11-08): hardening of the
 * Project Health dashboard — a failed crash read is reported, not shown as "Ready".
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

afterEach(cleanup);

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { HolisticHealthView } from '@/components/modules/evaluator/HolisticHealthView';
import { useProjectHealthStore } from '@/stores/projectHealthStore';
import { usePerformanceProfilingStore } from '@/stores/performanceProfilingStore';
import { useCrashAnalyzerStore } from '@/stores/crashAnalyzerStore';
import type { ProjectHealthSummary, SubsystemSignal } from '@/types/project-health';

const SIGNALS: SubsystemSignal[] = [
  { subsystem: 'crash-analyzer', label: 'Crash Analyzer', status: 'inactive', metric: 'Ready', detail: 'Import crash logs for AI analysis', linkTab: 'crashes' },
];

const SUMMARY: ProjectHealthSummary = {
  overallCompletion: 40,
  totalChecklistItems: 100,
  completedChecklistItems: 40,
  currentQualityScore: 55,
  performanceScore: null,
  qualityTrend: 'stable',
  avgVelocity: null,
  velocitySample: { datedCompletions: 0, undated: 0, weeks: 0 },
  moduleHealth: [],
  velocityHistory: [],
  qualityHistory: [],
  milestones: [],
  burnChart: [],
  subsystemSignals: SIGNALS,
};

const fetchHealth = vi.fn(async () => {});

beforeEach(() => {
  fetchHealth.mockClear();
  useProjectHealthStore.setState({
    summary: SUMMARY,
    moduleHealth: [],
    velocityHistory: [],
    qualityHistory: [],
    milestones: [],
    burnChart: [],
    subsystemSignals: SIGNALS,
    isLoading: false,
    error: null,
    fetchHealth,
  });
  usePerformanceProfilingStore.setState({ triage: null, activeSession: null });
  useCrashAnalyzerStore.setState({ error: null, fetchAnalysis: async () => {} });
});

async function settle() {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

describe('HolisticHealthView — hardening', () => {
  it('a failed crash read is reported instead of reading as a "Ready" crash signal', async () => {
    useCrashAnalyzerStore.setState({
      fetchAnalysis: async () => { useCrashAnalyzerStore.setState({ error: 'HTTP 503' }); },
    });
    const { container } = render(<HolisticHealthView />);
    await settle();
    const notice = container.querySelector('[data-testid="holistic-crash-read-error"]');
    expect(notice).not.toBeNull();
    expect(notice!.textContent).toContain('HTTP 503');
  });

  it('a successful crash read shows no crash-read notice', async () => {
    const { container } = render(<HolisticHealthView />);
    await settle();
    expect(container.querySelector('[data-testid="holistic-crash-read-error"]')).toBeNull();
  });
});
