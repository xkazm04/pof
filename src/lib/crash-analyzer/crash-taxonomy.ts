/* ------------------------------------------------------------------ */
/*  UE5 Crash Analyzer — Crash Taxonomy                                */
/* ------------------------------------------------------------------ */

import type { CrashSeverity } from '@/types/crash-analyzer';

/** Plain-language rendering of one crash category. */
export interface TaxonomyPlain {
  /** Short human label (sentence case). */
  label: string;
  /** One line: what actually went wrong, in plain English. */
  what: string;
  /** One line: the general direction of the fix. */
  fix: string;
}

/**
 * The single authority for the crash vocabulary: one row per crash category.
 *
 * `CrashType`, the zero-count factory, the plain-English record and the log
 * parser's classifier are all derived from this table. Adding a category is one
 * row here.
 *
 * Row ORDER is the classification priority: the parser takes the first row
 * whose `markers` (case-sensitive substrings of the error message) match.
 * `access_violation` precedes `nullptr_deref`; the parser refines an access
 * violation to a null dereference when the faulting address is near zero.
 */
export const CRASH_TAXONOMY = [
  {
    id: 'access_violation',
    severity: 'high',
    markers: ['ACCESS_VIOLATION'],
    plain: {
      label: 'Forbidden memory access',
      what: 'The game tried to read or write memory it wasn’t allowed to, and crashed.',
      fix: 'Track down the invalid pointer or out-of-range index behind it and guard it before use.',
    },
  },
  {
    id: 'nullptr_deref',
    severity: 'critical',
    markers: ['null pointer', 'nullptr dereference'],
    plain: {
      label: 'Empty reference used',
      what: 'The game tried to use something that wasn’t there (an empty reference) and shut down.',
      fix: 'Add a safety check before using that object, and make sure it’s created before it’s used.',
    },
  },
  {
    id: 'assertion_failed',
    severity: 'high',
    markers: ['Assertion failed'],
    plain: {
      label: 'Safety assumption broke',
      what: 'A built-in assumption the code relies on turned out to be false, so it stopped on purpose.',
      fix: 'Look at the failed condition and make sure that assumption holds — or handle when it doesn’t.',
    },
  },
  {
    id: 'ensure_failed',
    severity: 'low',
    markers: ['Ensure condition failed'],
    plain: {
      label: 'Non-fatal warning',
      what: 'A safety check failed and flagged a problem, but the game kept running.',
      fix: 'It won’t crash the player, but fix the flagged condition so the warning stops.',
    },
  },
  {
    id: 'gc_reference',
    severity: 'high',
    markers: ['garbage collected'],
    plain: {
      label: 'Freed object reused',
      what: 'The game used an object that had already been cleaned up from memory.',
      fix: 'Hold the object with a tracked reference (or re-fetch it each time) instead of a raw pointer.',
    },
  },
  {
    id: 'stack_overflow',
    severity: 'critical',
    markers: ['STACK_OVERFLOW'],
    plain: {
      label: 'Endless loop',
      what: 'A piece of code kept calling itself without stopping until it ran out of room.',
      fix: 'Find the recursion or loop that never ends and add a stopping condition.',
    },
  },
  {
    id: 'gpu_crash',
    severity: 'high',
    markers: [
      'DXGI_ERROR_DEVICE_REMOVED',
      'DXGI_ERROR_DEVICE_HUNG',
      'DXGI_ERROR_DEVICE_RESET',
      'Out of video memory',
      'GPU crash',
    ],
    plain: {
      label: 'Graphics crash',
      what: 'The graphics card stopped responding and the game lost its display connection.',
      fix: 'Check for heavy or invalid rendering work and reduce GPU load; update drivers if needed.',
    },
  },
  {
    id: 'out_of_memory',
    severity: 'high',
    markers: ['Out of memory', 'out of memory', 'OutOfMemory', 'EXCEPTION_OUT_OF_MEMORY'],
    plain: {
      label: 'Out of memory',
      what: 'The game asked for more memory than the machine could give and had to quit.',
      fix: 'Load less at once, or free things you no longer need.',
    },
  },
  {
    id: 'fatal_error',
    severity: 'medium',
    markers: ['Fatal'],
    plain: {
      label: 'Fatal error',
      what: 'The game hit an error serious enough that it couldn’t safely continue.',
      fix: 'Read the error message for the specific cause and address it.',
    },
  },
  {
    id: 'unhandled_exception',
    severity: 'medium',
    markers: ['Unhandled Exception'],
    plain: {
      label: 'Uncaught error',
      what: 'An unexpected error happened that nothing was set up to catch, so the game closed.',
      fix: 'Find the failing operation and handle its error path gracefully.',
    },
  },
  {
    id: 'unknown',
    severity: 'medium',
    markers: [],
    plain: {
      label: 'Uncategorized crash',
      what: 'The cause of this crash couldn’t be categorized automatically.',
      fix: 'Open the technical details below and inspect the error message and callstack.',
    },
  },
] as const satisfies readonly {
  id: string;
  severity: CrashSeverity;
  markers: readonly string[];
  plain: TaxonomyPlain;
}[];

/** Every crash category id, in table order. */
export const CRASH_TAXONOMY_IDS = CRASH_TAXONOMY.map((row) => row.id);

/** The classification row for an id (always present for a valid `CrashType`). */
export function taxonomyRow(id: (typeof CRASH_TAXONOMY)[number]['id']) {
  return CRASH_TAXONOMY.find((row) => row.id === id)!;
}
