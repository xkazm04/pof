import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { CrashAnalyzerView } from '@/components/modules/evaluator/CrashAnalyzerView';
import { useCrashAnalyzerStore } from '@/stores/crashAnalyzerStore';
import type { CallstackFrame, CrashReport, CrashDiagnosis } from '@/types/crash-analyzer';

const FRAME: CallstackFrame = {
  index: 0,
  address: '0x00007FF6A1234567',
  moduleName: 'UnrealEditor-PoF.dll',
  functionName: 'AARPGCharacterBase::ActivateAbility',
  sourceFile: 'ARPGCharacterBase.cpp',
  lineNumber: 234,
  isGameCode: true,
  isCrashOrigin: true,
};

const REPORT: CrashReport = {
  id: 'CRASH-001',
  timestamp: '2026-06-01T12:00:00.000Z',
  crashType: 'nullptr_deref',
  severity: 'critical',
  errorMessage: 'Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0',
  callstack: [FRAME],
  culpritFrame: FRAME,
  machineState: {
    platform: 'Win64', cpuBrand: 'Ryzen', gpuBrand: 'RTX', ramMB: 32000,
    osVersion: 'Win11', engineVersion: '5.7', buildConfig: 'Development', isEditor: true,
  },
  crashDir: 'Saved/Crashes',
  mappedModule: 'arpg-character',
  rawLog: 'raw crash log text',
  analyzed: true,
};

const DIAGNOSIS: CrashDiagnosis = {
  crashId: 'CRASH-001',
  summary: 'Null AbilitySystemComponent accessed during ability activation',
  rootCause: 'The ASC is used before InitAbilityActorInfo runs.',
  uePattern: 'GAS Initialization Race',
  confidence: 0.95,
  fixDescription: 'Add a null check before using the AbilitySystemComponent.',
  fixPrompt: 'Add guard...',
  relatedChecklist: [],
  tags: ['gas', 'nullptr'],
};

function seed(diagnoses: CrashDiagnosis[] = []) {
  useCrashAnalyzerStore.setState({
    reports: [REPORT],
    diagnoses,
    patterns: [],
    selectedCrashId: 'CRASH-001',
    isLoading: false,
    error: null,
    fetchAnalysis: async () => {},
  });
}

describe('CrashAnalyzerView — Plain English mode', () => {
  it('defaults to plain mode: leads with a humanized summary and hides the callstack', () => {
    seed();
    render(<CrashAnalyzerView />);

    // Humanized "what happened / what to do" block leads.
    const summary = screen.getByTestId('plain-crash-summary');
    expect(summary).toBeTruthy();
    expect(screen.getByText('What happened')).toBeTruthy();
    expect(screen.getByText('What to do')).toBeTruthy();
    // The plain crashType translation is shown (from the glossary).
    expect(summary.textContent).toMatch(/empty reference/i);

    // The dense callstack is tucked away behind a disclosure.
    expect(screen.queryByText(/^Callstack/)).toBeNull();
    expect(screen.getByTestId('show-tech-toggle')).toBeTruthy();
  });

  it('reveals callstack + raw log when the technical-details disclosure is opened', () => {
    seed();
    render(<CrashAnalyzerView />);

    fireEvent.click(screen.getByTestId('show-tech-toggle'));
    expect(screen.getByText(/^Callstack/)).toBeTruthy();
    expect(screen.getByText('raw crash log text')).toBeTruthy();
  });

  it('leads with the AI diagnosis summary + fix when a diagnosis exists', () => {
    seed([DIAGNOSIS]);
    render(<CrashAnalyzerView />);

    const summary = screen.getByTestId('plain-crash-summary');
    expect(summary.textContent).toContain('Null');
    expect(summary.textContent).toContain('Add a null check');
    // Known jargon inside the summary gets a hover-glossary trigger.
    expect(screen.getAllByRole('button').some((b) => b.textContent === 'AbilitySystemComponent')).toBe(true);
  });

  it('Technical mode shows the callstack directly with no plain summary', () => {
    seed();
    render(<CrashAnalyzerView />);

    fireEvent.click(screen.getByRole('button', { name: 'Technical' }));

    expect(screen.queryByTestId('plain-crash-summary')).toBeNull();
    expect(screen.queryByTestId('show-tech-toggle')).toBeNull();
    expect(screen.getByText(/^Callstack/)).toBeTruthy();
  });
});
