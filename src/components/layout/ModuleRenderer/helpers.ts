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
