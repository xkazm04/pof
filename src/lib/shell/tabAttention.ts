/**
 * Tab attention — what the browser tab says about work the operator is not watching.
 *
 * Long CLI runs, one-shot jobs and drains take minutes while the operator works in another
 * window; the tab title + favicon are the only ambient signal. Two honesty rules:
 *  1. An ending is reported by its OUTCOME: a failed run is "(Failed)", a run whose asked-for
 *     callback never reached the app is "(Not landed)", a job waiting on the operator is
 *     "(Needs you)". Only a real success is "(Done)".
 *  2. An outcome is HELD until the tab is actually seen: while `document.visibilityState` is
 *     hidden it latches; the `UI_TIMEOUTS.tabOutcomeLinger` countdown starts once visible.
 *
 * Pure: the reducer takes (prev, signal, visible, now) and returns the next title/tone. Two
 * adapters turn a source's consecutive snapshots into a signal — `fromCliSessions`
 * (cliPanelStore, legacy shell) and `fromLabActivity` (activityModel, lab shell). The DOM
 * side (document.title, favicon, timers) lives in `useDynamicTitle`.
 */

import type { CLISessionState } from '@/components/cli/store/cliPanelStore';
import type { ActivitySummary, LaneState } from '@/components/layout-lab/activityModel';
import { callbackIdsIn } from '@/components/cli/suggestionIntents';
import { UI_TIMEOUTS } from '@/lib/constants';

export type TabTone = 'none' | 'running' | 'success' | 'attention' | 'error';
export type TabOutcome = 'failed' | 'notLanded' | 'needsYou' | 'done';

/** One tick of a source: how many units run now, which ended since the last tick, and how. */
export interface TabSignal {
  running: number;
  ended: TabOutcome[];
  /** Resting label when nothing runs and nothing is held (e.g. '3 sessions'); null = the bare base. */
  rest: string | null;
}

export interface TabAttentionState {
  base: string;
  /** Outcomes not yet seen + lingered. */
  held: TabOutcome[];
  /** When the held outcomes were first visible; null while latched (or nothing held). */
  seenAt: number | null;
  title: string;
  tone: TabTone;
  /** True while an outcome is held on a tab nobody has looked at yet. */
  latched: boolean;
  /** When the held outcomes clear (seenAt + linger); null = nothing to schedule. */
  expiresAt: number | null;
}

export function initialTabAttention(base: string): TabAttentionState {
  return { base, held: [], seenAt: null, title: base, tone: 'none', latched: false, expiresAt: null };
}

const count = (held: TabOutcome[], o: TabOutcome) => held.filter((h) => h === o).length;

function worstTone(held: TabOutcome[]): TabTone | null {
  if (held.includes('failed')) return 'error';
  if (held.includes('notLanded') || held.includes('needsYou')) return 'attention';
  return held.includes('done') ? 'success' : null;
}

function render(base: string, held: TabOutcome[], signal: TabSignal): { title: string; tone: TabTone } {
  const failed = count(held, 'failed');
  const notLanded = count(held, 'notLanded');
  const needsYou = count(held, 'needsYou');
  if (signal.running > 0) {
    const head = signal.running === 1 ? 'Running' : `${signal.running} running`;
    const parts = [head];
    if (failed) parts.push(`${failed} failed`);
    if (notLanded) parts.push(`${notLanded} not landed`);
    if (needsYou) parts.push(`${needsYou} needs you`);
    const tone = worstTone(held.filter((h) => h !== 'done')) ?? 'running';
    return { title: `(${parts.join(' · ')}) ${base}`, tone };
  }
  if (failed) return { title: `(${failed === 1 ? 'Failed' : `${failed} failed`}) ${base}`, tone: 'error' };
  if (notLanded) return { title: `(${notLanded === 1 ? 'Not landed' : `${notLanded} not landed`}) ${base}`, tone: 'attention' };
  if (needsYou) return { title: `(Needs you) ${base}`, tone: 'attention' };
  if (held.length) return { title: `(Done) ${base}`, tone: 'success' };
  return { title: signal.rest ? `(${signal.rest}) ${base}` : base, tone: 'none' };
}

export function reduceTabAttention(
  prev: TabAttentionState,
  signal: TabSignal,
  visible: boolean,
  now: number,
  lingerMs: number = UI_TIMEOUTS.tabOutcomeLinger,
): TabAttentionState {
  let { held, seenAt } = prev;
  // Seen and lingered long enough: the operator has had the outcome.
  if (seenAt !== null && now - seenAt >= lingerMs) { held = []; seenAt = null; }
  if (signal.ended.length > 0) {
    held = [...held, ...signal.ended];
    // Every new outcome restarts the "seen" clock — and only a visible tab starts it.
    seenAt = visible ? now : null;
  } else if (held.length > 0 && seenAt === null && visible) {
    seenAt = now;
  }
  const { title, tone } = render(prev.base, held, signal);
  return {
    base: prev.base,
    held,
    seenAt,
    title,
    tone,
    latched: held.length > 0 && seenAt === null,
    expiresAt: held.length > 0 && seenAt !== null ? seenAt + lingerMs : null,
  };
}

/** The outcome of a session whose run just ended; null = never observed (nothing to announce). */
function cliOutcome(s: CLISessionState): TabOutcome | null {
  if (s.lastTaskSuccess === false) return 'failed';
  if (s.lastTaskSuccess !== true) return null;
  // The suggestionIntents rule: 'missing' only means "not landed" when the prompt asked for a callback.
  const cb = s.lastCallbackStatus ?? null;
  const asked = callbackIdsIn(s.lastDispatch?.prompt).length > 0;
  return asked && (cb === 'failed' || cb === 'missing') ? 'notLanded' : 'done';
}

/** Per-session isRunning edges. A first snapshot (prev null) is never an edge. */
export function fromCliSessions(
  prev: Record<string, CLISessionState> | null,
  next: Record<string, CLISessionState>,
): TabSignal {
  const list = Object.values(next);
  const ended: TabOutcome[] = [];
  if (prev) {
    for (const s of list) {
      if (!prev[s.id]?.isRunning || s.isRunning) continue;
      const o = cliOutcome(s);
      if (o) ended.push(o);
    }
  }
  return {
    running: list.filter((s) => s.isRunning).length,
    ended,
    rest: list.length > 1 ? `${list.length} sessions` : null,
  };
}

/** One-shot 'failed' is the lab's only failure-flavoured attention (activityModel.oneShotLane). */
const isFailedLane = (label: string) => /· failed$/.test(label);

/** Per-lane running-here edges: -> attention is failed / needs-you, -> idle is done. */
export function fromLabActivity(prev: ActivitySummary | null, next: ActivitySummary): TabSignal {
  const ended: TabOutcome[] = [];
  if (prev) {
    const before = new Map<string, LaneState>(prev.lanes.map((l) => [l.id, l.state]));
    for (const lane of next.lanes) {
      if (before.get(lane.id) !== 'running-here') continue;
      if (lane.state === 'attention') ended.push(isFailedLane(lane.label) ? 'failed' : 'needsYou');
      else if (lane.state === 'idle') ended.push('done');
    }
  }
  return { running: next.lanes.filter((l) => l.state === 'running-here').length, ended, rest: null };
}
