import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { createElement } from 'react';
import { SuspendContext } from '@/hooks/useSuspend';
import { UI_TIMEOUTS } from '@/lib/constants';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Reduced motion must be FALSE here: CrashTimeMachine's play button jumps
// straight to the culprit under reduced motion, which would bypass the very
// interval these tests are about.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});

import { CrashTimeMachine } from '@/components/modules/evaluator/CrashTimeMachine';
import { useCookProgress } from '@/components/modules/game-systems/CookProgress/useCookProgress';
import { ScriptRunner } from '@/components/modules/visual-gen/blender-pipeline/ScriptRunner';
import { useBlenderStore } from '@/components/modules/visual-gen/blender-pipeline/useBlenderStore';
import { FrameScrubberPanel } from '@/components/modules/core-engine/sub_animation/combos-montages/FrameScrubberPanel';
import type { CallstackFrame, CrashReport } from '@/types/crash-analyzer';

// ── CrashTimeMachine: replay playback ────────────────────────────────────────

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

const REPORT: CrashReport = {
  id: 'CRASH-SUSPEND-1',
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
  source: 'sample',
};

/** Rewind to the entry frame and start playback. */
function startPlayback() {
  fireEvent.change(screen.getByLabelText('Scrub crash replay'), { target: { value: '0' } });
  expect(screen.getByText('1 / 4')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Play replay'));
}

describe('CrashTimeMachine playback suspends with the module', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('advances the playhead while visible', () => {
    render(createElement(SuspendContext.Provider, { value: false }, createElement(CrashTimeMachine, { report: REPORT })));
    startPlayback();
    act(() => { vi.advanceTimersByTime(UI_TIMEOUTS.crashReplayStep * 2); });
    expect(screen.queryByText('1 / 4')).toBeNull();
  });

  it('does not advance while suspended', () => {
    render(createElement(SuspendContext.Provider, { value: true }, createElement(CrashTimeMachine, { report: REPORT })));
    startPlayback();
    // 20 steps' worth of wall clock: a hidden replay must not run to the culprit.
    act(() => { vi.advanceTimersByTime(UI_TIMEOUTS.crashReplayStep * 20); });
    expect(screen.getByText('1 / 4')).toBeTruthy();
  });
});

// ── CookProgress: elapsed-time ticker ────────────────────────────────────────

const COOK_REQUEST = { profileId: 'p1', projectPath: 'C:\\PoF', projectName: 'PoF', ueVersion: '5.7.0' };

function CookProbe() {
  const { elapsedMs } = useCookProgress({ request: COOK_REQUEST });
  return <span data-testid="cook-elapsed">{elapsedMs}</span>;
}

function renderCook(suspended: boolean) {
  return render(
    <SuspendContext.Provider value={suspended}>
      <CookProbe />
    </SuspendContext.Provider>,
  );
}

const elapsed = () => Number(screen.getByTestId('cook-elapsed').textContent);

describe('CookProgress elapsed ticker suspends with the module', () => {
  beforeEach(() => {
    // A cook that never settles: the ticker's only stop condition is a result.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    vi.useFakeTimers();
  });

  it('ticks once a second while visible', () => {
    renderCook(false);
    expect(elapsed()).toBe(0);
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(elapsed()).toBeGreaterThan(0);
  });

  it('stops ticking while suspended, and re-derives the true elapsed on resume', () => {
    const { rerender } = renderCook(true);

    act(() => { vi.advanceTimersByTime(10_000); });
    expect(elapsed()).toBe(0); // hidden: no interval burned

    // Resume: the ticker restarts and reports the REAL elapsed measured from
    // startedAt, so suspending costs nothing but the invisible re-renders.
    rerender(
      <SuspendContext.Provider value={false}>
        <CookProbe />
      </SuspendContext.Provider>,
    );
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(elapsed()).toBeGreaterThanOrEqual(10_000);
  });
});

// ── ScriptRunner: elapsed-time clock ─────────────────────────────────────────

describe('ScriptRunner elapsed clock suspends with the module', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useBlenderStore.setState({
      scripts: [{
        id: 's1', scriptName: 'lod.py', args: [], status: 'running', output: '',
        startedAt: Date.now(),
      }],
    });
  });

  const secs = () => screen.getByText(/^\d+s$/).textContent;

  it('advances while visible', () => {
    render(<SuspendContext.Provider value={false}><ScriptRunner /></SuspendContext.Provider>);
    const before = secs();
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(secs()).not.toBe(before);
  });

  it('freezes while suspended', () => {
    render(<SuspendContext.Provider value={true}><ScriptRunner /></SuspendContext.Provider>);
    const before = secs();
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(secs()).toBe(before);
  });
});

// ── FrameScrubberPanel: montage playback ─────────────────────────────────────

describe('FrameScrubberPanel playback suspends with the module', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  const frameNo = () => screen.getByText('Frame').textContent;

  it('advances the scrubber while visible', () => {
    render(<SuspendContext.Provider value={false}><FrameScrubberPanel /></SuspendContext.Provider>);
    const before = frameNo();
    fireEvent.click(screen.getByText('Play'));
    act(() => { vi.advanceTimersByTime(800); });
    expect(frameNo()).not.toBe(before);
  });

  it('does not advance while suspended', () => {
    render(<SuspendContext.Provider value={true}><FrameScrubberPanel /></SuspendContext.Provider>);
    const before = frameNo();
    fireEvent.click(screen.getByText('Play'));
    act(() => { vi.advanceTimersByTime(8_000); });
    expect(frameNo()).toBe(before);
  });
});
