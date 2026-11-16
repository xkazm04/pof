/**
 * Crash analyzer text inputs — the search box and the import textarea were
 * named only by their placeholder, which is not an accessible name.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

afterEach(cleanup);
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { CrashAnalyzerView } from '@/components/modules/evaluator/CrashAnalyzerView';
import { ImportPanel } from '@/components/modules/evaluator/CrashAnalyzerView/ImportPanel';
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

describe('CrashAnalyzerView — accessible names', () => {
  it('the search input has an aria-label', () => {
    seed();
    const view = render(<CrashAnalyzerView />);
    const search = view.container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(search.getAttribute('aria-label') ?? '').not.toBe('');
  });

  it('the import textarea has an aria-label', () => {
    const view = render(<ImportPanel />);
    const ta = view.container.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.getAttribute('aria-label') ?? '').not.toBe('');
  });
});
