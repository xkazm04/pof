import { MAX_LOG_LINES } from './constants';
import type { CookLogSeverity, CookLogLine } from './types';

/**
 * Classify a raw cook log line by severity so the console can color it. RunUAT /
 * the UE cook commandlet print verbosity inline (`LogFoo: Error:`, `Warning:`),
 * so a word-boundary keyword match is enough — errors win over warnings, and
 * everything else is muted info. Pure + exported so the coloring is unit-tested.
 */
export function classifyCookLogLine(line: string): CookLogSeverity {
  if (/\b(error|errors|fail|failed|failure|fatal|exception|crash|crashed|abort|aborted)\b/i.test(line)) {
    return 'error';
  }
  if (/\b(warn|warning|warnings|deprecated|deprecation)\b/i.test(line)) {
    return 'warning';
  }
  return 'info';
}

/**
 * Append a parsed line, trimming to the newest `max` so the buffer never grows
 * without bound. Pure + exported so the cap behavior is unit-tested without
 * driving thousands of events through the component.
 */
export function appendCookLog(prev: CookLogLine[], entry: CookLogLine, max = MAX_LOG_LINES): CookLogLine[] {
  const next = [...prev, entry];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** The facet buckets a single line contributes to (used to add on append / subtract on trim). */
export function lineFacets(l: CookLogLine): { error: boolean; warning: boolean; cook: boolean; stage: boolean } {
  return {
    error: l.severity === 'error',
    warning: l.severity === 'warning',
    cook: l.phase === 'cook',
    stage: l.phase === 'stage',
  };
}

/**
 * Format an elapsed-ms timestamp as a zero-padded `MM:SS` prefix. Cooks can run
 * past an hour, so minutes simply keep counting (`125:30`) rather than wrapping.
 */
export function formatCookTimestamp(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
