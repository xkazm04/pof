import type { CookPhase } from '@/lib/packaging/cook-executor';
import { SEVERITY_TOKENS } from '@/lib/chart-colors';
import type { CookLogSeverity, CookLogFilter, CookLogCounts } from './types';

export const PHASE_LABELS: Record<CookPhase, string> = {
  cook: 'Cooking',
  stage: 'Staging',
  package: 'Packaging',
  done: 'Finished',
};

/**
 * Keep a generous tail of the cook stream. RunUAT emits thousands of lines, so
 * the viewer is virtualized (react-window) and only the freshest window is
 * retained — the line that kills a cook is always near the end, and warnings are
 * scattered throughout, so the most-recent {@link MAX_LOG_LINES} cover the hunt.
 */
export const MAX_LOG_LINES = 2000;

/** Fixed row height (px) — single-line rows keep virtualization cheap + exact. */
export const LOG_ROW_HEIGHT = 18;
/** Log viewport height (px). */
export const LOG_VIEWPORT_HEIGHT = 192;
/** Distance from the bottom (px) still treated as "pinned" for auto-scroll. */
export const PIN_THRESHOLD_PX = 24;

export const ZERO_COUNTS: CookLogCounts = { all: 0, error: 0, warning: 0, cook: 0, stage: 0 };

/** Left-border accent per severity — red / amber / blue, per chart-colors tokens. */
export const LOG_SEVERITY_BORDER: Record<CookLogSeverity, string> = {
  error: SEVERITY_TOKENS.critical.color, // red
  warning: SEVERITY_TOKENS.warning.color, // amber
  info: SEVERITY_TOKENS.info.color, // blue
};

/** Text tint: errors/warnings pop; info inherits the muted container color. */
export const LOG_SEVERITY_TEXT: Record<CookLogSeverity, string | undefined> = {
  error: SEVERITY_TOKENS.critical.color,
  warning: SEVERITY_TOKENS.warning.color,
  info: undefined,
};

export const FILTERS: ReadonlyArray<{ id: CookLogFilter; label: string; dot?: string }> = [
  { id: 'all', label: 'All' },
  { id: 'error', label: 'Errors', dot: SEVERITY_TOKENS.critical.color },
  { id: 'warning', label: 'Warnings', dot: SEVERITY_TOKENS.warning.color },
  { id: 'cook', label: 'Cook' },
  { id: 'stage', label: 'Stage' },
];
