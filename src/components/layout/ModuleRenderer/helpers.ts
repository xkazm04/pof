import { MODULE_LABELS } from '@/lib/module-registry';
import { eventBus } from '@/lib/event-bus';
import { logger } from '@/lib/logger';

/** Labels for special categories (not sub-modules — not in MODULE_LABELS) */
const SPECIAL_CATEGORY_LABELS: Record<string, string> = {
  'project-setup': 'Project Setup',
  'evaluator': 'Evaluator',
  'game-director': 'Game Director',
};

/** Human-readable label for a module/special-category id, falling back to the id. */
export function moduleLabel(id: string): string {
  return MODULE_LABELS[id] ?? SPECIAL_CATEGORY_LABELS[id] ?? id;
}

/**
 * THE VISIBILITY RULE: a set `activeSubModule` wins over its owning special
 * category. Returns the ONE module id the user should see, or `null` for the
 * welcome state.
 *
 * Why the sub-module wins — it is what every path that can produce the dual-set
 * state actually asked for:
 * - `setActiveCategory(id)` (the L1 rail) sets `activeSubModule: null`, so a
 *   category selection can never be the state we are disambiguating here.
 * - `setActiveSubModule(id)` (the L2 list) keeps `activeCategory`, so a set
 *   sub-module is always the LATER, more specific request.
 * - `navigateToModule('game-design-doc')` names the SUB-MODULE and merely
 *   derives its parent category (`getCategoryForSubModule`) — the category is
 *   context for the rails, not the requested destination.
 * So `activeCategory` alone means "show the category"; both set always means
 * "show the sub-module".
 *
 * This is the single source for BOTH `currentActiveId` (which drives the
 * crossfade veil) and each pane's `isVisible` — one predicate, so exactly one
 * pane can be visible and the veil always covers the pane the user sees. Panes
 * for other ids stay MOUNTED (the LRU's job) and are suspended, as any hidden
 * pane is.
 *
 * `isSpecialCategory` is passed in so this stays free of the lazy component
 * registry; the caller already resolved it.
 */
export function resolveVisibleModule(
  activeCategory: string | null | undefined,
  activeSubModule: string | null | undefined,
  isSpecialCategory: boolean,
): string | null {
  if (activeSubModule) return activeSubModule;
  return isSpecialCategory ? activeCategory ?? null : null;
}

/**
 * A **positive-evidence** liveness probe: `isLive(id)` is `true` only when the
 * caller has actually OBSERVED live work attributable to `id`.
 *
 * `false` is deliberately NOT "idle". It means "no live work observed", which
 * this shell cannot distinguish from "this pane's work is invisible to me" — it
 * can see CLI sessions and nothing else, so a module's own SSE streams, polls
 * and subscriptions read as `false` while running. The LRU therefore uses the
 * probe as an eviction PREFERENCE (prefer a pane with no observed live work over
 * one with observed live work), never as a safety claim that the chosen victim
 * was doing nothing. `EvictionBasis` below carries that distinction outward so
 * no downstream report can quietly upgrade it into "nothing was lost".
 */
export type ObservedLiveProbe = (id: string) => boolean;

/**
 * How an eviction victim was chosen — the honesty record of the decision.
 *
 * - `unprobed` — no probe was supplied, so the classic least-recently-used tail
 *   was popped with **nothing observed either way**.
 * - `no-observed-live-work` — the victim is the least-recently-used entry the
 *   probe did NOT flag. Again: "not flagged", not "idle" (see `ObservedLiveProbe`).
 * - `forced-over-live-work` — EVERY candidate was flagged live, and the cap
 *   evicted one anyway to keep memory bounded. This is the loud case: work the
 *   shell could actually see was torn down.
 */
export type EvictionBasis = 'unprobed' | 'no-observed-live-work' | 'forced-over-live-work';

/** Outcome of an LRU touch: the new list plus what (if anything) it cost. */
export interface LruTouch {
  /** The new list, most-recently-used first. `list` itself is never mutated. */
  next: string[];
  /**
   * The id pushed out of the list by `cap`, or `null` when nothing was evicted.
   * An evicted pane is UNMOUNTED (it leaves the render map entirely), so this is
   * the teardown signal — see `describeEviction`.
   */
  evicted: string | null;
  /** How `evicted` was chosen. `'unprobed'` whenever nothing was evicted. */
  basis: EvictionBasis;
}

/**
 * Promote `id` to the front of `list` (most-recently-used). If the list would
 * exceed `cap`, ONE entry is evicted.
 *
 * Which one is the point of `isLive`. Without a probe this pops the tail, exactly
 * as it always did. With a probe it evicts the least-recently-used entry with **no
 * observed live work**, scanning tail-first, and only falls back to the tail when
 * every candidate is flagged live — the cap still holds (bounded memory), but the
 * result says `forced-over-live-work` so the caller can report a real teardown
 * instead of logging it at debug level.
 *
 * The just-touched head (index 0) is never a candidate: it is what the user asked
 * for, and evicting it would unmount the pane being navigated to.
 *
 * PURE: `list` is not mutated — a new array is returned. Returns `null` when the
 * list is already up to date (the common per-render path), so callers pay nothing
 * when nothing changed.
 */
export function lruTouched(
  list: string[],
  id: string,
  cap: number,
  isLive?: ObservedLiveProbe,
): LruTouch | null {
  if (list[0] === id) return null; // already MRU — no change
  const next = list.filter(x => x !== id);
  next.unshift(id);
  if (next.length <= cap) return { next, evicted: null, basis: 'unprobed' };

  // Candidates are everything except the just-touched head, unless the cap is so
  // small that the head is all there is (cap 0 — degenerate, but never silently
  // mis-labelled below).
  const floor = next.length > 1 ? 1 : 0;
  let victim = next.length - 1; // classic least-recently-used tail
  let basis: EvictionBasis = 'unprobed';

  if (isLive) {
    basis = 'forced-over-live-work';
    for (let i = next.length - 1; i >= floor; i--) {
      if (!isLive(next[i])) {
        victim = i;
        basis = 'no-observed-live-work';
        break;
      }
    }
  }

  const [evicted] = next.splice(victim, 1);
  return { next, evicted: evicted ?? null, basis };
}

/** Outcome of folding several touches through ONE list — see `lruTouchedAll`. */
export interface LruTouchAll {
  /** The new list, most-recently-used first. `list` itself is never mutated. */
  next: string[];
  /**
   * Every id that actually fell off the tail, in eviction order. An id evicted by
   * one touch and re-added by a later one is NOT listed — it is still mounted, so
   * reporting it would be a phantom teardown.
   */
  evicted: string[];
  /**
   * The subset of `evicted` that was evicted DESPITE observed live work (basis
   * `forced-over-live-work`). Same phantom-teardown filter as `evicted`: an id
   * re-added by a later touch is still mounted and is not listed.
   */
  forced: string[];
}

/**
 * Apply several touches to ONE list in a single pass, in order (most-recent LAST,
 * so the last id ends up MRU).
 *
 * Folding is the only correct composition: each touch must see the list the
 * previous one produced. Calling `lruTouched` twice against the same binding and
 * setting state from each result silently DISCARDS the first touch — the caller's
 * second `setState` wins — which can drop a just-visited module out of the list.
 *
 * Returns `null` when the fold leaves the list unchanged BY CONTENT. The content
 * comparison is load-bearing, not an optimisation: two ids that are both already
 * in the list swap places on every pass, so an identity-only check would set state
 * every render and never converge.
 */
export function lruTouchedAll(
  list: string[],
  ids: string[],
  cap: number,
  isLive?: ObservedLiveProbe,
): LruTouchAll | null {
  let next = list;
  const evicted: string[] = [];
  const forced: string[] = [];
  for (const id of ids) {
    const touch = lruTouched(next, id, cap, isLive);
    if (!touch) continue;
    next = touch.next;
    if (touch.evicted) {
      evicted.push(touch.evicted);
      if (touch.basis === 'forced-over-live-work') forced.push(touch.evicted);
    }
  }
  if (next.length === list.length && next.every((x, i) => x === list[i])) return null;
  const stillGone = (id: string) => !next.includes(id);
  return { next, evicted: evicted.filter(stillGone), forced: forced.filter(stillGone) };
}

/**
 * Fold the shell's ONE observation source — the CLI session store — into an
 * order-stable key naming every id with live work, prefixed by scope
 * (`s:` session id, `m:` module id).
 *
 * A string, not a Set, on purpose: this is read through a zustand selector on
 * every render, and a fresh object identity per render would re-subscribe (and,
 * feeding a state-adjusting LRU, loop). Compare by value, derive the probe once
 * per changed key with `observedLiveProbe`.
 *
 * What it can see is exactly what `describeEviction` can see, and no more.
 */
export function observedLiveKey(sessions: Record<string, EvictionSessionInfo>): string {
  const ids: string[] = [];
  for (const [sessionId, s] of Object.entries(sessions)) {
    if (!s?.isRunning) continue;
    ids.push(`s:${sessionId}`);
    if (s.moduleId) ids.push(`m:${s.moduleId}`);
  }
  return ids.sort().join('|');
}

/**
 * Build the `ObservedLiveProbe` for one scope from an `observedLiveKey`.
 *
 * Read the contract on `ObservedLiveProbe` before using the `false` branch for
 * anything: it means "not observed", never "idle".
 */
export function observedLiveProbe(key: string, scope: 'module' | 'session'): ObservedLiveProbe {
  const flagged = new Set(key ? key.split('|') : []);
  const prefix = scope === 'session' ? 's:' : 'm:';
  return (id: string) => flagged.has(prefix + id);
}

/** Minimal shape of a CLI session the shell needs to judge "was work live?". */
export interface EvictionSessionInfo {
  moduleId?: string;
  isRunning: boolean;
}

/** An eviction, described well enough to be reported without guessing. */
export interface EvictionSignal {
  evictedId: string;
  label: string;
  scope: 'module' | 'session';
  cap: number;
  liveWork: 'cli-session-running' | 'none-observed';
  /**
   * How this victim was chosen. `forced-over-live-work` is the case the LRU could
   * not avoid — every candidate had observed live work — and is what promotes the
   * report from a debug line to a user-visible one.
   */
  basis: EvictionBasis;
}

/**
 * Describe an eviction for reporting.
 *
 * The `liveWork` verdict is deliberately narrow and never guesses: the shell can
 * only see CLI sessions (`sessions`), so it reports `cli-session-running` when a
 * running session is attributable to the evicted pane and `none-observed`
 * otherwise. `none-observed` means "this shell detected nothing", NOT "nothing was
 * lost" — a module's own SSE streams, polls and subscriptions are invisible here.
 *
 * `basis` is the same distinction seen from the DECISION side (see `EvictionBasis`):
 * `no-observed-live-work` says the LRU preferred this victim because nothing was
 * flagged for it, which is not a claim that it was idle. The two are reported
 * side by side precisely so neither can be read as the stronger statement.
 */
export function describeEviction(
  evictedId: string,
  scope: 'module' | 'session',
  cap: number,
  sessions: Record<string, EvictionSessionInfo>,
  basis: EvictionBasis = 'unprobed',
): EvictionSignal {
  const running = Object.entries(sessions).some(([sessionId, s]) =>
    s?.isRunning && (scope === 'session' ? sessionId === evictedId : s.moduleId === evictedId),
  );
  return {
    evictedId,
    label: scope === 'session' ? evictedId : moduleLabel(evictedId),
    scope,
    cap,
    liveWork: running ? 'cli-session-running' : 'none-observed',
    basis,
  };
}

/**
 * True when an eviction destroyed work this shell could actually SEE — either the
 * LRU was forced over every live candidate, or a session attributable to the pane
 * was still running when the report was written (the probe and the report read the
 * store at different moments, so the second check is not redundant).
 *
 * The negative is never "nothing was lost"; it is "nothing observable was lost",
 * which is why the un-flagged case stays a debug line rather than a user-facing
 * claim of safety.
 */
export function tearsDownObservedWork(signal: EvictionSignal): boolean {
  return signal.basis === 'forced-over-live-work' || signal.liveWork === 'cli-session-running';
}

/**
 * Report an eviction: typed event bus (so a surface can react) + a debug log line.
 * Call from an effect — never from the render body.
 *
 * The bus is the only output here on purpose — `useActivityFeedBridge` is the
 * registered consumer that decides what reaches the user, so the shell keeps one
 * reporting path instead of two.
 */
export function reportEviction(signal: EvictionSignal): void {
  eventBus.emit('nav.module.evicted', signal, 'ModuleRenderer');
  logger.debug(
    `[ModuleRenderer] evicted ${signal.scope} "${signal.label}" (${signal.evictedId}) — LRU cap ${signal.cap}, ` +
      `basis ${signal.basis}; ` +
      (signal.liveWork === 'cli-session-running'
        ? 'a RUNNING CLI session was torn down'
        : 'no running CLI session observed (module-internal streams/polls are not visible here)'),
  );
}
