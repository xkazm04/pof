/**
 * CrashAnalyzerView — a search/filter that matches nothing used to leave an
 * empty listbox and no words, indistinguishable from "still loading" or
 * "no crashes at all".
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { CrashAnalyzerView } from '@/components/modules/evaluator/CrashAnalyzerView';
import { useCrashAnalyzerStore } from '@/stores/crashAnalyzerStore';
import type { CrashReport } from '@/types/crash-analyzer';

const REPORT = {
  id: 'CRASH-001',
  timestamp: '2026-06-01T12:00:00.000Z',
  crashType: 'nullptr_deref',
  severity: 'critical',
  errorMessage: 'Null pointer dereference in HandleDeath',
  callstack: [],
  culpritFrame: null,
  machineState: { platform: 'Win64', cpuBrand: '', gpuBrand: '', ramMB: 0, osVersion: '', engineVersion: '5.7', buildConfig: 'Development', isEditor: true },
  crashDir: '',
  mappedModule: 'arpg-character',
  rawLog: '',
  analyzed: true,
  source: 'sample',
} as unknown as CrashReport;

function seed() {
  useCrashAnalyzerStore.setState({
    reports: [REPORT], diagnoses: [], patterns: [], selectedCrashId: null,
    isLoading: false, error: null, fetchAnalysis: async () => {},
  });
}

describe('CrashAnalyzerView — search', () => {
  it('says so when the query matches no crash', () => {
    seed();
    const view = render(<CrashAnalyzerView />);
    const search = view.container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'zzz-no-such-crash' } });
    expect(view.container.querySelectorAll('[role="option"]').length).toBe(0);
    expect(view.container.textContent).toMatch(/No crashes match/i);
  });

  it('shows no no-match message while results exist', () => {
    seed();
    const view = render(<CrashAnalyzerView />);
    expect(view.container.textContent).not.toMatch(/No crashes match/i);
  });
});

describe('CrashAnalyzerView — empty state copy', () => {
  it('does not offer an import affordance the empty state cannot reach', () => {
    useCrashAnalyzerStore.setState({
      reports: [], diagnoses: [], patterns: [], selectedCrashId: null,
      isLoading: false, error: 'Crash analysis failed: boom', fetchAnalysis: async () => {},
    });
    const view = render(<CrashAnalyzerView />);
    const text = view.container.textContent ?? '';
    // The Import tab only renders when crash data exists.
    expect(view.container.querySelector('textarea')).toBeNull();
    expect(text).not.toMatch(/import a crash log/i);
    expect(text).toMatch(/Analyze Crashes/);
  });
});
