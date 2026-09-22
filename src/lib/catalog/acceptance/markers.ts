/**
 * Fixed, greppable prefixes for verdicts that are NOT verified passes (registry:
 * acceptance-verdict-spine · ungraded-marker-doctrine). Each starts a result's `reason`, uppercase,
 * so a plain text search over `pipeline_artifacts` counts every such row.
 *
 * A leaf module on purpose: it is imported by the checkers themselves, so it may import nothing.
 */

/** No checker could grade this row — or, under a canon profile, no LAW exists to grade it against. */
export const UNGRADED_MARKER = 'UNGRADED';

/** The row was SEEDED from a reference source, not produced; never graded `pass` (/diablo D3). */
export const SOURCED_MARKER = 'SOURCED';
