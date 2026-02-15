/**
 * Signals Module — CLI self-improvement feedback loop.
 *
 * Re-exports all signal-related types and functions.
 */

export type {
  SignalType,
  Severity,
  Category,
  Signal,
  Pattern,
  ImprovementRecord,
} from './signal-types';

export { SEVERITY_WEIGHT, SIGNAL_CATEGORY_MAP, SIGNAL_SEVERITY_MAP } from './signal-types';

export { analyzeEvent } from './signal-analyzer';

export {
  appendSignal,
  getSignals,
  getPatterns,
  savePatterns,
  markPatternsResolved,
  appendImprovement,
  getImprovements,
} from './signal-store';

export { detectPatterns } from './pattern-detector';

export { buildImprovementPrompt } from './improvement-prompt';
