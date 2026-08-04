/**
 * Sibling-context projection for the canon-aware judge (Quality Program).
 *
 * The strict judge scores one step's config in isolation, so before this it flagged a value that
 * was actually consistent with a sibling step as an "invented reference", and it could not catch a
 * genuine cross-step contradiction at all. This builds a COMPACT, bounded projection of the
 * entity's OTHER steps — the load-bearing cross-reference surface (statHooks / crossReferences /
 * top-level scalars), not the full configs — so the judge can verify consistency without being
 * flooded by tens of thousands of characters of sibling JSON.
 *
 * Pure and bounded (exported for unit test): total output is capped so a many-step entity can
 * never blow the judge prompt.
 */

import { NON_CONTENT_KEYS } from './payload';

export interface SiblingStep {
  step: string;
  data: Record<string, unknown>;
}

/** Keys whose nested content is the highest-signal cross-reference surface. */
const PRIORITY_KEYS = ['statHooks', 'crossReferences', 'crossReferenceValues'];

function isScalar(v: unknown): boolean {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v);
}

/** A compact projection of one step's config: priority blocks, then top-level scalars, then —
 *  unless `includeNested` is explicitly set to `false` — the remaining nested objects/arrays,
 *  each capped so one fat step cannot eat the whole budget. Truncated to `perStepChars`. Pure.
 *  v4: nested projection defaults ON — a nested-only step (e.g. `rules: {...}`) used to project
 *  EMPTY, so the judge saw no cross-reference surface for it at all. Pass `{ includeNested:
 *  false }` for the old, scalars-only behaviour. */
export function projectStep(
  data: Record<string, unknown>,
  perStepChars: number,
  opts: { includeNested?: boolean } = { includeNested: true },
): string {
  const parts: string[] = [];
  for (const k of PRIORITY_KEYS) {
    if (data[k] && typeof data[k] === 'object') parts.push(`${k}=${JSON.stringify(data[k])}`);
  }
  const scalars: Record<string, unknown> = {};
  const nested: string[] = [];
  // Per-key cap so a 400-field object cannot crowd out its siblings before truncation.
  const perKey = Math.max(40, Math.floor(perStepChars / 3));
  for (const [k, v] of Object.entries(data)) {
    if (NON_CONTENT_KEYS.has(k) || PRIORITY_KEYS.includes(k)) continue;
    if (isScalar(v)) scalars[k] = v;
    else if (Array.isArray(v) && v.length <= 8 && v.every(isScalar)) scalars[k] = v;
    else if (opts.includeNested && v && typeof v === 'object') {
      const j = JSON.stringify(v);
      nested.push(`${k}=${j.length > perKey ? j.slice(0, perKey - 1) + '…' : j}`);
    }
  }
  if (Object.keys(scalars).length) parts.push(JSON.stringify(scalars));
  parts.push(...nested);
  const s = parts.join(' ');
  return s.length > perStepChars ? s.slice(0, perStepChars - 1) + '…' : s;
}

/** Build the sibling-context block for `currentStep` from all of the entity's steps. Excludes the
 *  step under judgment. Returns '' when there are no other steps. Pure. */
export function buildSiblingContext(
  steps: SiblingStep[],
  currentStep: string,
  opts: { perStepChars?: number; totalChars?: number; includeNested?: boolean } = {},
): string {
  const perStepChars = opts.perStepChars ?? 600;
  const totalChars = opts.totalChars ?? 6000;
  const includeNested = opts.includeNested ?? true;
  const others = steps
    .filter((s) => s.step !== currentStep)
    .slice()
    .sort((a, b) => a.step.localeCompare(b.step));
  const lines: string[] = [];
  let used = 0;
  for (const s of others) {
    const proj = projectStep(s.data ?? {}, perStepChars, { includeNested });
    if (!proj) continue;
    const line = `- ${s.step}: ${proj}`;
    if (used + line.length > totalChars) {
      lines.push(`- …(${others.length - lines.length} more sibling step(s) omitted for length)`);
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join('\n');
}
