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

/** Outcome of an LRU touch: the new list plus what (if anything) it cost. */
export interface LruTouch {
  /** The new list, most-recently-used first. `list` itself is never mutated. */
  next: string[];
  /**
   * The id pushed off the tail by `cap`, or `null` when nothing was evicted.
   * An evicted pane is UNMOUNTED (it leaves the render map entirely), so this is
   * the teardown signal — see `describeEviction`.
   */
  evicted: string | null;
}

/**
 * Promote `id` to the front of `list` (most-recently-used). If the list would
 * exceed `cap`, the tail (least-recently-used) entry is evicted.
 *
 * PURE: `list` is not mutated — a new array is returned. Returns `null` when the
 * list is already up to date (the common per-render path), so callers pay nothing
 * when nothing changed.
 */
export function lruTouched(list: string[], id: string, cap: number): LruTouch | null {
  if (list[0] === id) return null; // already MRU — no change
  const next = list.filter(x => x !== id);
  next.unshift(id);
  const evicted = next.length > cap ? next.pop() ?? null : null;
  return { next, evicted };
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
export function lruTouchedAll(list: string[], ids: string[], cap: number): LruTouchAll | null {
  let next = list;
  const evicted: string[] = [];
  for (const id of ids) {
    const touch = lruTouched(next, id, cap);
    if (!touch) continue;
    next = touch.next;
    if (touch.evicted) evicted.push(touch.evicted);
  }
  if (next.length === list.length && next.every((x, i) => x === list[i])) return null;
  return { next, evicted: evicted.filter(id => !next.includes(id)) };
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
}

/**
 * Describe an eviction for reporting.
 *
 * The `liveWork` verdict is deliberately narrow and never guesses: the shell can
 * only see CLI sessions (`sessions`), so it reports `cli-session-running` when a
 * running session is attributable to the evicted pane and `none-observed`
 * otherwise. `none-observed` means "this shell detected nothing", NOT "nothing was
 * lost" — a module's own SSE streams, polls and subscriptions are invisible here.
 */
export function describeEviction(
  evictedId: string,
  scope: 'module' | 'session',
  cap: number,
  sessions: Record<string, EvictionSessionInfo>,
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
  };
}

/**
 * Report an eviction: typed event bus (so a surface can react) + a debug log line.
 * Call from an effect — never from the render body.
 */
export function reportEviction(signal: EvictionSignal): void {
  eventBus.emit('nav.module.evicted', signal, 'ModuleRenderer');
  logger.debug(
    `[ModuleRenderer] evicted ${signal.scope} "${signal.label}" (${signal.evictedId}) — LRU cap ${signal.cap}; ` +
      (signal.liveWork === 'cli-session-running'
        ? 'a RUNNING CLI session was torn down'
        : 'no running CLI session observed (module-internal streams/polls are not visible here)'),
  );
}
