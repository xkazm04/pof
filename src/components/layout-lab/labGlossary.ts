/**
 * Plain-language glossary for the catalog→UE pipeline UI.
 *
 * The lab speaks engineer (L0–L4 tiers, deferred, drain, config-complete) — fine
 * for power users, opaque for the artists/writers/designers who actually drive
 * content. This module turns each jargon term into:
 *   - `short`: a one-word/short-phrase label (chip-sized)
 *   - `plain`: a one-sentence human definition (tooltip / coach copy)
 *
 * It is read-only and pure — no React, no truth source — so the same glossary
 * powers tooltips, the NextStepCoach banner, and any future help text.
 */

import type { AcceptanceTier, AcceptanceStatus } from '@/lib/catalog/acceptance/types';

export interface GlossaryEntry {
  /** Chip-sized label (1–3 words). */
  short: string;
  /** One-sentence plain-language definition. */
  plain: string;
}

/** Acceptance tiers, lightest → heaviest proof. */
export const TIER_GLOSSARY: Record<AcceptanceTier, GlossaryEntry> = {
  L0: { short: 'data check', plain: 'A quick check that the row is filled in.' },
  L1: { short: 'human pick', plain: 'A human has chosen one of the options the step produced.' },
  L2: { short: 'rules check', plain: 'The numbers follow the rules (budgets, ranges, constraints).' },
  L3: { short: 'live test', plain: 'A live Unreal test confirmed this works at runtime.' },
  L4: { short: 'looks-good test', plain: 'A live Unreal render was compared to the reference and looks right.' },
};

/** Status words used everywhere in the lab. */
export const STATUS_GLOSSARY: Record<AcceptanceStatus, GlossaryEntry> = {
  pass: { short: 'done', plain: 'This step is finished and meets its acceptance check.' },
  fail: { short: 'needs a fix', plain: 'This step ran but did not meet its acceptance check — open it to see why.' },
  deferred: { short: 'waiting on Unreal', plain: 'This step is waiting on a live Unreal run; queue it with “Run deferred gates”.' },
  pending: { short: 'not started', plain: 'This step has not been produced yet.' },
};

/** Other lab jargon that surfaces in the UI. */
export const TERM_GLOSSARY: Record<string, GlossaryEntry> = {
  deferred: STATUS_GLOSSARY.deferred,
  drain: {
    short: 'run waiting tests',
    plain: 'Send every step that is waiting on Unreal through the live runner so they get a real verdict.',
  },
  'config-complete': {
    short: 'all set up',
    plain: 'Every step is finished or only waiting on a live Unreal test — nothing is missing or broken.',
  },
  tier: {
    short: 'proof level',
    plain: 'How strong the proof is: data check → human pick → rules → live test → looks-good test.',
  },
  acceptance: {
    short: 'acceptance',
    plain: 'The automatic check this step has to pass before it is considered done.',
  },
};

/** Lookup helper — case-insensitive — returns null if the term isn’t glossed. */
export function lookupTerm(term: string): GlossaryEntry | null {
  return TERM_GLOSSARY[term.toLowerCase()] ?? null;
}

/** Compose a one-line plain summary for an EntityRollup-shaped object. */
export interface PlainSummaryInput {
  done: number;
  total: number;
  deferred: number;
  pending: number;
  failed: number;
  highestTier: AcceptanceTier | null;
  configComplete: boolean;
}

export function plainEntitySummary(s: PlainSummaryInput): string {
  if (s.total === 0) return 'No steps yet.';
  if (s.configComplete && s.deferred === 0) return 'All steps are done.';
  if (s.configComplete) {
    return `Everything is set up — ${s.deferred} step${s.deferred === 1 ? '' : 's'} still waiting on a live Unreal test.`;
  }
  const parts: string[] = [];
  parts.push(`${s.done} of ${s.total} done`);
  if (s.failed > 0) parts.push(`${s.failed} need${s.failed === 1 ? 's' : ''} a fix`);
  if (s.deferred > 0) parts.push(`${s.deferred} waiting on Unreal`);
  if (s.pending > 0) parts.push(`${s.pending} not started`);
  return parts.join(' · ') + '.';
}
