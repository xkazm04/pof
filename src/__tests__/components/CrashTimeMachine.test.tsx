import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});

import { CrashTimeMachine } from '@/components/modules/evaluator/CrashTimeMachine';
import type { CallstackFrame, CrashReport } from '@/types/crash-analyzer';

function frame(index: number, fn: string, isGame: boolean, isCrash = false): CallstackFrame {
  return {
    index,
    address: `0x000000000000${index}`,
    moduleName: isGame ? 'UnrealEditor-MyGame' : 'UnrealEditor-Engine',
    functionName: fn,
    sourceFile: isGame ? 'ARPGCharacterBase.cpp' : null,
    lineNumber: isGame ? 200 + index : null,
    isGameCode: isGame,
    isCrashOrigin: isCrash,
  };
}

// Ordered entry→crash this is: [HandleInput(3), ActivateAbility(2,culprit), TryActivate(1), AssertFailed(0)].
const REPORT: CrashReport = {
  id: 'CRASH-1',
  timestamp: '2026-06-01T12:00:00.000Z',
  crashType: 'nullptr_deref',
  severity: 'critical',
  errorMessage: 'EXCEPTION_ACCESS_VIOLATION',
  callstack: [
    frame(0, 'FDebug::AssertFailed', false),
    frame(1, 'UAbilitySystemComponent::TryActivateAbility', false),
    frame(2, 'AARPGCharacterBase::ActivateAbility', true, true),
    frame(3, 'AARPGCharacterBase::HandleInput', true),
  ],
  culpritFrame: null,
  machineState: {
    platform: 'Win64', cpuBrand: 'Ryzen', gpuBrand: 'RTX', ramMB: 32000,
    osVersion: 'Win11', engineVersion: '5.7', buildConfig: 'Development', isEditor: true,
  },
  crashDir: 'Saved/Crashes',
  mappedModule: 'arpg-character',
  rawLog: 'raw',
  analyzed: true,
};

describe('CrashTimeMachine', () => {
  it('renders one segment per frame and marks the crash-origin culprit', () => {
    render(<CrashTimeMachine report={REPORT} />);
    expect(screen.getByTestId('crash-time-machine')).toBeTruthy();

    const segments = screen.getAllByTestId('frame-segment');
    expect(segments.length).toBe(4);

    // Exactly one segment is labeled as the crash origin.
    const origins = segments.filter((s) => /crash origin/i.test(s.getAttribute('aria-label') ?? ''));
    expect(origins.length).toBe(1);
    expect(origins[0].getAttribute('aria-label')).toContain('ActivateAbility');
  });

  it('opens focused and stopped on the culprit frame', () => {
    render(<CrashTimeMachine report={REPORT} />);
    const detail = screen.getByTestId('time-machine-frame-detail');
    expect(detail.textContent).toContain('AARPGCharacterBase::ActivateAbility');
    expect(detail.textContent).toContain('crash origin');
    // Culprit sits at position 2 in the entry→crash ordering (of 4 frames).
    expect(screen.getByText('2 / 4')).toBeTruthy();
  });

  it('click-to-focus selects a frame and moves the playhead', () => {
    render(<CrashTimeMachine report={REPORT} />);
    const segments = screen.getAllByTestId('frame-segment');

    // Last segment (pos 3) is the deepest engine crash point: FDebug::AssertFailed.
    fireEvent.click(segments[3]);

    const detail = screen.getByTestId('time-machine-frame-detail');
    expect(detail.textContent).toContain('FDebug::AssertFailed');
    expect(detail.textContent).toContain('engine');
    expect(screen.getByText('4 / 4')).toBeTruthy();
  });

  it('scrubbing the range input updates the focused frame', () => {
    render(<CrashTimeMachine report={REPORT} />);
    const slider = screen.getByLabelText('Scrub crash replay') as HTMLInputElement;

    fireEvent.change(slider, { target: { value: '0' } });
    const detail = screen.getByTestId('time-machine-frame-detail');
    // pos 0 = entry frame = HandleInput (game code).
    expect(detail.textContent).toContain('HandleInput');
    expect(screen.getByText('1 / 4')).toBeTruthy();
  });

  it('step controls walk one frame at a time', () => {
    render(<CrashTimeMachine report={REPORT} />);
    // Default playhead = culprit at pos 2 (label "3 / 4" after +1).
    expect(screen.getByText('2 / 4')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Step forward'));
    expect(screen.getByText('3 / 4')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Step back'));
    fireEvent.click(screen.getByLabelText('Step back'));
    expect(screen.getByText('1 / 4')).toBeTruthy();
  });

  it('lights up the mapped-module ribbon when execution is in game code', () => {
    render(<CrashTimeMachine report={REPORT} />);
    // Default focus is the culprit (game code) — the module zone is active.
    const moduleZone = screen.getByText('arpg-character').closest('span');
    expect(moduleZone?.getAttribute('data-active')).toBe('true');

    // Scrub to the deepest engine frame — the Engine zone takes over.
    fireEvent.change(screen.getByLabelText('Scrub crash replay'), { target: { value: '3' } });
    const engineZone = screen.getByText('Engine').closest('span');
    expect(engineZone?.getAttribute('data-active')).toBe('true');
    expect(screen.getByText('arpg-character').closest('span')?.getAttribute('data-active')).toBe('false');
  });

  it('renders nothing for an empty callstack', () => {
    const { container } = render(<CrashTimeMachine report={{ ...REPORT, callstack: [] }} />);
    expect(within(container).queryByTestId('crash-time-machine')).toBeNull();
  });
});
