import type { AcceptanceStatus } from '@/lib/catalog/acceptance/types';
import type { LifecycleState } from '@/lib/catalog/types';
import type { LabTheme } from './theme';

/**
 * One status language for the catalog→UE pipeline UI.
 *
 * Status is encoded by a **glyph** (not color alone) so it survives grayscale
 * and color-vision deficiency (WCAG 1.4.1 Use of Color), and by a plain-language
 * **word** for screen readers / non-technical readers via an aria-label. The
 * COLOR token still reinforces meaning visually, but is never the only signal.
 *
 * U+23F8 (⏸) has default *text* presentation — it inherits `color`, so it stays
 * consistent with the theme rather than rendering as a fixed-color emoji.
 */
export type StatusKind = AcceptanceStatus; // 'pass' | 'pending' | 'fail' | 'deferred'

/** check = pass · x = fail · pause = deferred · ring = pending */
export const STATUS_GLYPH: Record<StatusKind, string> = {
  pass: '✓',
  fail: '✕',
  deferred: '⏸',
  pending: '○',
};

/** Plain-language status word, used in aria-labels. */
export const STATUS_WORD: Record<StatusKind, string> = {
  pass: 'passed',
  fail: 'failed',
  deferred: 'deferred',
  pending: 'pending',
};

/**
 * Theme color for a status. This *reinforces* the glyph + word — it is never the
 * only signal (WCAG 1.4.1). Single-sourced here so the step banner, rollup chips,
 * catalog matrix, and next-step coach can't drift. `pending` maps to the warn tone.
 */
export function statusColor(status: StatusKind, t: LabTheme): string {
  return status === 'pass' ? t.ok : status === 'fail' ? t.bad : status === 'deferred' ? t.muted : t.warn;
}

/** e.g. statusAriaLabel('Economy', 'fail', 'L2') → "Economy: failed, tier L2" */
export function statusAriaLabel(name: string, status: StatusKind, tier?: string | null): string {
  return `${name}: ${STATUS_WORD[status]}${tier ? `, tier ${tier}` : ''}`;
}

/**
 * Collapse an entity's LifecycleState onto the StatusKind axis so the catalog
 * tree, rollup chips, and step banner all speak one language. `verified` is
 * the only terminal-success state; `failed` is the only failure; everything
 * in between (`planned`/`scaffolded`/`generated`/`wired`) is in-progress and
 * announces as "pending" — there is no concept of "deferred" at the lifecycle level.
 */
export function lifecycleStatus(lifecycle: LifecycleState): StatusKind {
  if (lifecycle === 'verified') return 'pass';
  if (lifecycle === 'failed') return 'fail';
  return 'pending';
}
