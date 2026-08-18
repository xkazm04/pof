/**
 * Wave-8 Lot AG — recursive `requestAnimationFrame` loops in hidden module panes.
 *
 * The browser throttles rAF only when the TAB is hidden. A module pane that is
 * merely `display:none` inside a visible tab (the module LRU keeps up to five
 * mounted) keeps its rAF loop at full frame rate. These tests prove the
 * converted loops STOP advancing under `SuspendContext={true}` and resume
 * LOSSLESSLY, with a visible-case control — and pin the audit inventory so a
 * new unbounded loop under `components/modules/**` cannot land unreviewed.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { SuspendContext } from '@/hooks/useSuspend';
import { useAnimationLoop } from '@/components/modules/content/ui-hud/HudThemeEditor/useAnimationLoop';
import { useDamageNumberPhysicsSimulator } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/useDamageNumberPhysicsSimulator';

// ── Deterministic rAF stub ───────────────────────────────────────────────────
// jsdom has no real frame cadence, so drive frames by hand and keep
// `performance.now()` locked to the same fake clock the frames are stamped with.

let pending = new Map<number, FrameRequestCallback>();
let nextRafId = 0;
let clock = 0;

const FRAME_MS = 16;

function installRafStub() {
  pending = new Map();
  nextRafId = 0;
  clock = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = ++nextRafId;
    pending.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pending.delete(id);
  });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
}

/** Run `n` frames. A suspended loop schedules nothing, so this is a no-op for it. */
function advanceFrames(n: number) {
  for (let i = 0; i < n; i++) {
    clock += FRAME_MS;
    const due = [...pending.values()];
    pending.clear();
    act(() => {
      for (const cb of due) cb(clock);
    });
  }
}

/** Frames that pass while the pane is hidden — nothing is scheduled to run them. */
function advanceHiddenTime(n: number) {
  clock += FRAME_MS * n;
}

const wrapper = (suspended: boolean) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(SuspendContext.Provider, { value: suspended }, children);
  };

beforeEach(() => {
  installRafStub();
});

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  pending.clear();
});

// ── HudThemeEditor: useAnimationLoop (unbounded 60fps clock) ─────────────────

describe('useAnimationLoop suspends in a hidden pane', () => {
  it('advances while visible (control)', () => {
    const { result } = renderHook(() => useAnimationLoop(true), { wrapper: wrapper(false) });

    expect(result.current).toBe(0);
    advanceFrames(5);
    expect(result.current).toBeCloseTo(5 * FRAME_MS / 1000, 5);
    // Still self-rescheduling: the loop is alive.
    expect(pending.size).toBe(1);
  });

  it('never schedules a frame when mounted already-suspended', () => {
    // A pane the LRU restored while still hidden: mounted, active, invisible.
    const { result } = renderHook(() => useAnimationLoop(true), { wrapper: wrapper(true) });

    expect(pending.size).toBe(0);
    advanceFrames(20);
    expect(result.current).toBe(0);
    expect(pending.size).toBe(0);
  });

  it('resumes from the banked elapsed time, not from zero and not from wall clock', () => {
    let suspended = false;
    const { result, rerender } = renderHook(() => useAnimationLoop(true), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(SuspendContext.Provider, { value: suspended }, children),
    });

    advanceFrames(5);
    const banked = result.current; // 0.080s

    suspended = true;
    act(() => { rerender(); });
    expect(pending.size).toBe(0);

    // A long spell hidden — 100 frames' worth of wall clock passes unspent.
    advanceHiddenTime(100);
    expect(result.current).toBeCloseTo(banked, 5);

    suspended = false;
    act(() => { rerender(); });
    advanceFrames(3);

    // Lossless: continues at banked + 3 frames. NOT 0 (restart) and NOT
    // banked + 103 frames (wall-clock jump through the hidden span).
    expect(result.current).toBeCloseTo(banked + 3 * FRAME_MS / 1000, 5);
    expect(result.current).toBeLessThan(banked + 10 * FRAME_MS / 1000);
  });
});

// ── DamageNumberPhysicsSimulator: unbounded particle sim ────────────────────

describe('useDamageNumberPhysicsSimulator suspends in a hidden pane', () => {
  it('spawns while visible (control), freezes while suspended, resumes with state intact', () => {
    let suspended = false;
    const { result, rerender } = renderHook(() => useDamageNumberPhysicsSimulator(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(SuspendContext.Provider, { value: suspended }, children),
    });

    act(() => { result.current.toggleRunning(); });
    expect(result.current.isRunning).toBe(true);

    // Control: the visible pane simulates.
    advanceFrames(60);
    const spawnedWhileVisible = result.current.totalSpawned;
    const particlesAtSuspend = result.current.particles;
    expect(spawnedWhileVisible).toBeGreaterThan(0);
    expect(pending.size).toBe(1);

    // Hide it: the loop must stop dead.
    suspended = true;
    act(() => { rerender(); });
    expect(pending.size).toBe(0);

    advanceHiddenTime(300);
    expect(result.current.totalSpawned).toBe(spawnedWhileVisible);
    // Simulation state is untouched — it lives in refs/state, not in the frame.
    expect(result.current.particles).toBe(particlesAtSuspend);
    // The run is still logically "running"; only the frame source paused.
    expect(result.current.isRunning).toBe(true);

    // Resume: picks the same particle set back up and keeps simulating.
    suspended = false;
    act(() => { rerender(); });
    expect(pending.size).toBe(1);

    advanceFrames(60);
    expect(result.current.totalSpawned).toBeGreaterThan(spawnedWhileVisible);
  });

  it('does not integrate the hidden span as one giant dt', () => {
    let suspended = false;
    const { result, rerender } = renderHook(() => useDamageNumberPhysicsSimulator(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(SuspendContext.Provider, { value: suspended }, children),
    });

    act(() => { result.current.toggleRunning(); });
    advanceFrames(30);
    const before = result.current.totalSpawned;

    suspended = true;
    act(() => { rerender(); });
    advanceHiddenTime(600); // ~10s of wall clock while hidden

    suspended = false;
    act(() => { rerender(); });
    advanceFrames(30);

    // The resumed run rebases its clock, so the second 30 frames spawn about as
    // much as the first 30 — not a 10-second burst of catch-up particles.
    const secondHalf = result.current.totalSpawned - before;
    expect(secondHalf).toBeGreaterThan(0);
    expect(secondHalf).toBeLessThanOrEqual(before + 2);
  });
});

// ── Audit inventory pin ──────────────────────────────────────────────────────

const MODULES_ROOT = path.join(process.cwd(), 'src', 'components', 'modules');

/**
 * Blank out comments and string/template-literal bodies (preserving offsets), so
 * an rAF named in a comment or a prompt string is never counted as a callsite.
 */
function stripCommentsAndStrings(src: string): string {
  const out = src.split('');
  const blank = (a: number, b: number) => {
    for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      let j = i;
      while (j < n && src[j] !== '\n') j++;
      blank(i, j); i = j; continue;
    }
    if (c === '/' && d === '*') {
      let j = src.indexOf('*/', i + 2);
      j = j === -1 ? n : j + 2;
      blank(i, j); i = j; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      blank(i + 1, Math.min(j, n)); i = Math.min(j + 1, n); continue;
    }
    if (c === '`') {
      let j = i + 1;
      let depth = 0;
      let chunkStart = j;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (depth === 0 && src[j] === '$' && src[j + 1] === '{') {
          blank(chunkStart, j); depth = 1; j += 2; continue;
        }
        if (depth > 0) {
          if (src[j] === '{') depth++;
          else if (src[j] === '}') { depth--; if (depth === 0) chunkStart = j + 1; }
          j++; continue;
        }
        if (src[j] === '`') break;
        j++;
      }
      if (depth === 0) blank(chunkStart, Math.min(j, n));
      i = Math.min(j + 1, n); continue;
    }
    i++;
  }
  return out.join('');
}

function walkSources(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkSources(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Files that own a genuinely self-rescheduling rAF loop, and whether it is gated. */
const RECURSIVE_LOOPS: { file: string; gated: boolean; why: string }[] = [
  { file: 'content/ui-hud/DamageNumberPhysicsSimulator/useDamageNumberPhysicsSimulator.ts', gated: true, why: 'unbounded 60fps particle sim' },
  { file: 'content/ui-hud/HudThemeEditor/useAnimationLoop.ts', gated: true, why: 'unbounded 60fps clock' },
  { file: 'content/ui-hud/LowHealthPulse/useLowHealthPulse.ts', gated: true, why: 'unbounded 60fps pulse clock' },
  { file: 'core-engine/sub_character/playground/StickFigurePreview.tsx', gated: true, why: 'unbounded 60fps canvas loop' },
  { file: 'core-engine/sub_combat/choreography/index.tsx', gated: true, why: 'playback for a whole encounter (tens of seconds)' },
  { file: 'core-engine/sub_ability/gas-balance/index.tsx', gated: false, why: 'finite chunked compute the user is waiting on' },
  { file: 'core-engine/sub_ability/index.tsx', gated: false, why: 'deadline-bounded (2s) scroll-into-view retry' },
  { file: 'core-engine/sub_combat/dodge-timeline/index.tsx', gated: false, why: 'sub-second self-terminating playback' },
];

describe('recursive rAF audit under components/modules', () => {
  const files = walkSources(MODULES_ROOT);
  const sites = files.flatMap((f) => {
    const stripped = stripCommentsAndStrings(fs.readFileSync(f, 'utf8'));
    const matches = stripped.match(/requestAnimationFrame\s*\(/g);
    return matches ? [{ f, count: matches.length }] : [];
  });

  it('holds the measured callsite inventory (comment- and string-safe)', () => {
    const total = sites.reduce((s, x) => s + x.count, 0);
    // 8 self-rescheduling loops (kickoff + re-entry = 2 sites each) + 12 one-shots.
    expect(RECURSIVE_LOOPS.length * 2 + 12).toBe(28);
    expect(total).toBe(28);
    expect(sites.length).toBe(17);
  });

  it('every file with a recursive loop is accounted for in the classification', () => {
    const recursiveFiles = new Set(
      RECURSIVE_LOOPS.map((l) => path.join(MODULES_ROOT, ...l.file.split('/'))),
    );
    for (const f of recursiveFiles) expect(fs.existsSync(f)).toBe(true);
  });

  it('gates every loop classified as long-running, and only those', () => {
    for (const loop of RECURSIVE_LOOPS) {
      const src = fs.readFileSync(path.join(MODULES_ROOT, ...loop.file.split('/')), 'utf8');
      expect(
        src.includes('useSuspendableEffect'),
        `${loop.file} (${loop.why})`,
      ).toBe(loop.gated);
      // A loop deliberately left running names its reason in code.
      if (!loop.gated) expect(src).toContain('NOT suspend-gated, deliberately');
    }
  });
});
