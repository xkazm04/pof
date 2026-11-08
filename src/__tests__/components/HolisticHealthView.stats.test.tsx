/**
 * scan-sweep Lane B (holistic-quality-overview): Project Health stat card wording,
 * tablist keyboard behaviour, and the stale-summary cue under a refresh error.
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
import type { ModuleHealthSummary, ProjectHealthSummary } from '@/types/project-health';

function mod(id: string, status: ModuleHealthSummary['status']): ModuleHealthSummary {
  return {
    moduleId: id, label: id, status, checklistCompletion: 0, qualityScore: null,
    issueCount: 0, healthScore: 0,
  } as unknown as ModuleHealthSummary;
}

function makeSummary(moduleHealth: ModuleHealthSummary[]): ProjectHealthSummary {
  return {
    overallCompletion: 40, totalChecklistItems: 100, completedChecklistItems: 40,
    currentQualityScore: 55, performanceScore: null, qualityTrend: 'stable', avgVelocity: null,
    velocitySample: { datedCompletions: 0, undated: 0, weeks: 0 },
    moduleHealth, velocityHistory: [], qualityHistory: [], milestones: [], burnChart: [],
    subsystemSignals: [],
  };
}

function setStore(moduleHealth: ModuleHealthSummary[], error: string | null = null) {
  useProjectHealthStore.setState({
    summary: makeSummary(moduleHealth), moduleHealth, velocityHistory: [], qualityHistory: [],
    milestones: [], burnChart: [], subsystemSignals: [], isLoading: false, error,
    fetchHealth: vi.fn(async () => {}),
  });
}

beforeEach(() => {
  usePerformanceProfilingStore.setState({ triage: null, activeSession: null });
  useCrashAnalyzerStore.setState({ error: null, fetchAnalysis: async () => {} });
});

async function settle() {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

function moduleHealthCard(container: HTMLElement): string {
  const label = [...container.querySelectorAll('p')].find((p) => p.textContent === 'Module Health');
  return label?.parentElement?.textContent ?? '';
}

describe('Project Health — Module Health card', () => {
  it('with every module not started the card says so beyond its label', async () => {
    setStore([mod('a', 'not-started'), mod('b', 'not-started')]);
    const { container } = render(<HolisticHealthView />);
    await settle();
    const text = moduleHealthCard(container).replace('Module Health', '').trim();
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('2 not started');
  });

  it('counts carry words, not just a hue', async () => {
    setStore([mod('a', 'healthy'), mod('b', 'healthy'), mod('c', 'critical')]);
    const { container } = render(<HolisticHealthView />);
    await settle();
    const text = moduleHealthCard(container);
    expect(text).toContain('2 healthy');
    expect(text).toContain('1 critical');
  });
});
