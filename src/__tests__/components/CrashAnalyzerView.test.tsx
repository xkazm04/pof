import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Deterministic reduced-motion + avoid jsdom matchMedia gaps.
const motionState = vi.hoisted(() => ({ reduced: false as boolean | null }));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => motionState.reduced };
});
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { CrashAnalyzerView } from '@/components/modules/evaluator/CrashAnalyzerView';
import { useCrashAnalyzerStore } from '@/stores/crashAnalyzerStore';
import type { CallstackFrame, CrashReport } from '@/types/crash-analyzer';

const FRAME: CallstackFrame = {
  index: 0,
  address: '0x00007FF6A1234567',
  moduleName: 'UnrealEditor-PoF.dll',
  functionName: 'AARPGCharacterBase::HandleDeath',
  sourceFile: 'ARPGCharacterBase.cpp',
  lineNumber: 142,
  isGameCode: true,
  isCrashOrigin: true,
};

const REPORT: CrashReport = {
  id: 'CRASH-001',
  timestamp: '2026-06-01T12:00:00.000Z',
  crashType: 'nullptr_deref',
  severity: 'critical',
  errorMessage: 'Null pointer dereference in HandleDeath',
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

function seed(selectedCrashId: string | null) {
  useCrashAnalyzerStore.setState({
    reports: [REPORT],
    diagnoses: [],
    patterns: [],
    selectedCrashId,
    isLoading: false,
    error: null,
    // No-op so the on-mount effect doesn't clobber the seeded state with a fetch.
    fetchAnalysis: async () => {},
  });
}

describe('CrashAnalyzerView master-detail transition', () => {
  beforeEach(() => {
    motionState.reduced = false;
  });

  it('collapses the detail grid track and hides the panel when nothing is selected', () => {
    seed(null);
    render(<CrashAnalyzerView />);

    const split = screen.getByTestId('crashes-split');
    // The grid collapses to a single track when nothing is selected — the list
    // owns the full width with no phantom detail column / gutter.
    expect((split.style.gridTemplateColumns.match(/1fr/g) ?? []).length).toBe(1);
    // The crash id only renders inside the detail panel header.
    expect(screen.queryByText('CRASH-001')).toBeNull();
    expect(screen.queryByTestId('crash-detail-anim')).toBeNull();
  });

  it('opens a two-track split and slides the detail panel in on the compositor', () => {
    seed('CRASH-001');
    render(<CrashAnalyzerView />);

    const split = screen.getByTestId('crashes-split');
    // Two equal tracks — the structural split replaces the Framer width animation.
    expect(split.className).toContain('grid');
    const tracks = split.style.gridTemplateColumns.match(/1fr/g) ?? [];
    expect(tracks.length).toBe(2);

    // Detail panel is rendered…
    expect(screen.getByText('CRASH-001')).toBeTruthy();
    // …and animates via compositor-only properties (transform + opacity), never width.
    const anim = screen.getByTestId('crash-detail-anim');
    expect(anim.style.willChange).toBe('transform, opacity');
    expect(anim.style.width).toBe('');
  });

  it('drops the slide offset under prefers-reduced-motion', () => {
    motionState.reduced = true;
    seed('CRASH-001');
    render(<CrashAnalyzerView />);

    // Panel still renders; the compositor hint stays, only the slide distance is dropped.
    const anim = screen.getByTestId('crash-detail-anim');
    expect(anim).toBeTruthy();
    expect(anim.style.willChange).toBe('transform, opacity');
  });
});
