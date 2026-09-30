/**
 * Style application — the ONE server resolver of "which Style DNA reaches this prompt, and why not".
 *
 * It used to live inline in /api/leonardo, was absent from the app's 2D front
 * (/api/visual-gen/generate-2d) and the catalog contact sheet (which hard-coded its own medium),
 * and a client copy in the 3D submit is canon-blind. Every server 2D route now hands this module
 * TYPED inputs (apply / canonProfile / catalogId) — never pre-rendered style text — and reports the
 * same applied / withheld pair.
 *
 * It restates nothing: WHICH profile is `styleDnaForProfile`'s rule (a canon-bound style never
 * leaves its canon, the project style never reaches another canon), the fragment is
 * `styleDnaToPromptFragment`'s, the length cap is `applyStyleFragment`'s, and what the per-dim and
 * char caps drop is `styleFragmentPreview`'s `dropped` — the same sentences the Style DNA editor shows.
 *
 * Absent `apply`, the database is never opened and the prompt is returned byte-identical.
 */
import type Database from 'better-sqlite3';
import { STYLE_PROMPT_MAX_LENGTH, applyStyleFragment, styleDnaToPromptFragment } from '@/lib/visual-gen/style-dna';
import { styleFragmentPreview } from '@/lib/visual-gen/style-dna-edit';
import { styleDnaForProfile, type StyleDnaProfile } from '@/lib/visual-gen/style-dna-db';
import { subjectClassOf } from '@/lib/catalog/canon/subjectClass';

/** The typed inputs a call site hands over. */
export interface StyleRequest {
  apply: boolean;
  /** The entity's canon profile; absent / 'pof' = the project's active style. */
  canonProfile?: string | null;
  /** Picks the canon's per-subject-class variant (creature / environment / item). */
  catalogId?: string | null;
}

export interface StyleResolution {
  fragment: string | null;
  applied: { id: string; name: string } | null;
  /** Why no style was applied when one was asked for a canon that holds none. */
  withheld: string | null;
}

/** What a route reports beside its result. */
export interface StyleOutcome {
  styleDnaApplied: string | null;
  styleDnaWithheld: string | null;
  /** styleFragmentPreview's `dropped`: every chip the caps keep out of the prompt, with why. */
  styleDnaDropped: string[];
}

/** A connection, or a thunk that opens one only when a style is actually asked for. */
export type StyleDbSource = Database.Database | (() => Database.Database);

const NONE: StyleResolution = { fragment: null, applied: null, withheld: null };

/** Read the three optional fields off an untrusted request body. Anything malformed = absent. */
export function styleRequestOf(body: unknown): StyleRequest {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return {
    apply: b.applyStyleDna === true,
    canonProfile: typeof b.canonProfile === 'string' ? b.canonProfile : null,
    catalogId: typeof b.catalogId === 'string' ? b.catalogId : null,
  };
}

function resolveProfile(src: StyleDbSource, req: StyleRequest): { profile: StyleDnaProfile | null; res: StyleResolution } {
  if (!req.apply) return { profile: null, res: NONE };
  const db = typeof src === 'function' ? src() : src;
  const canon = req.canonProfile ?? null;
  const profile = styleDnaForProfile(db, canon, subjectClassOf(req.catalogId ?? null));
  if (profile) {
    return {
      profile,
      res: { fragment: styleDnaToPromptFragment(profile.dna), applied: { id: profile.id, name: profile.name }, withheld: null },
    };
  }
  const withheld = canon
    ? `no Style DNA is bound to canon profile "${canon}" — the project's style is never applied to another canon`
    : null;
  return { profile: null, res: { ...NONE, withheld } };
}

/** Which Style DNA reaches a prompt for this request, and why not. */
export function resolveStyle(db: StyleDbSource, req: StyleRequest): StyleResolution {
  return resolveProfile(db, req).res;
}

/** The resolved fragment appended through the one capped helper. No fragment = the prompt, untouched. */
export function styledPrompt(prompt: string, res: StyleResolution, maxLength: number = STYLE_PROMPT_MAX_LENGTH): string {
  return applyStyleFragment(prompt, res.fragment, maxLength);
}

const outcome = (res: StyleResolution, dropped: string[]): StyleOutcome => ({
  styleDnaApplied: res.applied?.name ?? null,
  styleDnaWithheld: res.withheld,
  styleDnaDropped: dropped,
});

/** A prompt route's whole style step: resolve, append under `maxLength`, report what was dropped. */
export function applyStyle(
  db: StyleDbSource,
  prompt: string,
  req: StyleRequest,
  maxLength: number = STYLE_PROMPT_MAX_LENGTH,
): StyleOutcome & { prompt: string } {
  const { profile, res } = resolveProfile(db, req);
  const styled = styledPrompt(prompt, res, maxLength);
  const dropped = profile && styled !== prompt
    ? styleFragmentPreview(profile.dna, { promptChars: prompt.trim().length, maxLength }).dropped
    : [];
  return { prompt: styled, ...outcome(res, dropped) };
}

/**
 * The resolved style as a sentence CLAUSE (no trailing period) for a prompt that embeds a style
 * slot of its own — the contact sheet's "Style/medium: <clause>." line. No length budget applies
 * there, so only the per-dim cap can drop a chip.
 */
export function styleClause(db: StyleDbSource, req: StyleRequest): { clause: string | null; outcome: StyleOutcome } {
  const { profile, res } = resolveProfile(db, req);
  return {
    clause: res.fragment ? res.fragment.replace(/\.$/, '') : null,
    outcome: outcome(res, profile ? styleFragmentPreview(profile.dna).dropped : []),
  };
}
