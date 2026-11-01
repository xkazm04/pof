/**
 * Validate a pitch-intake callback body into proposals — pure (spark gtai-uprising-project, WP3).
 *
 * The WHOLE body is refused on the first malformed proposal, with a reason that names it: the
 * intake is a review queue, and a half-accepted body would hide which part the model got wrong.
 * Nothing here writes; the operator's accept is the only door to the canon and the catalogs.
 */
import { authoringProfileOf, catalogsForGame } from '@/lib/games/registry';
import type { GameId } from '@/lib/games/types';
import { validateRuleDraft } from '@/lib/catalog/canon/validation';
import type { ProjectRule } from '@/lib/catalog/canon/types';
import type { Result } from '@/types/result';
import type { IntakeCallbackBody, IntakeEntityProposal, IntakeProposal } from './types';

/** Upper bound on proposals one run may submit (a pitch yields dozens, not thousands). */
export const MAX_INTAKE_PROPOSALS = 200;

/** Everything the parser checks against. Injected, so a test never depends on the live manifest. */
export interface IntakeParseContext {
  gameId: GameId;
  /** The profile every proposed rule must carry (`authoringProfileOf(gameId)`). */
  authoringProfile: string;
  /** Registered catalogIds in the game's manifest — the only catalogs an entity may land in. */
  manifestCatalogs: readonly string[];
}

/** The context for a real game: its authoring profile + its manifest ∩ the registered pipelines. */
export function intakeContextFor(gameId: GameId, registered: readonly string[]): IntakeParseContext {
  return { gameId, authoringProfile: authoringProfileOf(gameId), manifestCatalogs: catalogsForGame(gameId, registered).inManifest };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const fail = (error: string): Result<never, string> => ({ ok: false, error });

function parseRule(raw: unknown, where: string, ctx: IntakeParseContext): Result<ProjectRule, string> {
  if (!isObj(raw)) return fail(`${where}: kind "rule" needs a "rule" object`);
  for (const f of ['id', 'category', 'title', 'body'] as const) {
    if (!nonEmpty(raw[f])) return fail(`${where}: rule is missing "${f}"`);
  }
  // Absent reads as `pof` (the canon convention), so a missing profile is a wrong profile.
  if (raw.profile !== ctx.authoringProfile) {
    const got = raw.profile === undefined ? 'absent (reads as "pof")' : `"${String(raw.profile)}"`;
    return fail(`${where}: rule "${String(raw.id)}" profile is ${got} — expected the game's authoring profile "${ctx.authoringProfile}"`);
  }
  const checked = validateRuleDraft(
    { ...raw, scope: raw.scope ?? 'global' },
    ctx.manifestCatalogs.map((catalogId) => ({ catalogId })),
  );
  if (!checked.ok) return fail(`${where}: ${checked.error}`);
  const r = checked.data;
  return { ok: true, data: { id: r.id, category: r.category, scope: r.scope, title: r.title, body: r.body, refs: r.refs, profile: ctx.authoringProfile } };
}

function parseEntity(raw: unknown, where: string, ctx: IntakeParseContext): Result<IntakeEntityProposal, string> {
  if (!isObj(raw)) return fail(`${where}: kind "entity" needs an "entity" object`);
  const prefix = `${ctx.gameId}-`;
  if (!nonEmpty(raw.entityId) || !raw.entityId.startsWith(prefix) || raw.entityId.length === prefix.length) {
    return fail(`${where}: entityId "${String(raw.entityId ?? '')}" must start with "${prefix}" (the entity key is global across games)`);
  }
  if (!nonEmpty(raw.catalogId) || !ctx.manifestCatalogs.includes(raw.catalogId)) {
    return fail(`${where}: catalogId "${String(raw.catalogId ?? '')}" is not a registered pipeline in ${ctx.gameId}'s manifest`
      + ` (${ctx.manifestCatalogs.length ? ctx.manifestCatalogs.join(', ') : 'the manifest is empty'})`);
  }
  if (!nonEmpty(raw.name)) return fail(`${where}: entity "${raw.entityId}" is missing "name"`);
  const tags = raw.tags ?? [];
  if (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string')) return fail(`${where}: entity "${raw.entityId}" tags must be string[]`);
  return { ok: true, data: { catalogId: raw.catalogId, entityId: raw.entityId, name: raw.name.trim(), tags, data: raw.data ?? {} } };
}

/** Body → `{ runId, proposals }`, or the first reason it cannot be reviewed. */
export function parseIntakeCallback(body: unknown, ctx: IntakeParseContext): Result<IntakeCallbackBody, string> {
  if (!isObj(body)) return fail('body must be a JSON object { runId, proposals }');
  if (!nonEmpty(body.runId) || body.runId.length > 120) return fail('runId is required (a non-empty string of at most 120 chars)');
  if (!Array.isArray(body.proposals)) return fail('proposals must be an array');
  if (body.proposals.length > MAX_INTAKE_PROPOSALS) return fail(`too many proposals (${body.proposals.length} > ${MAX_INTAKE_PROPOSALS})`);

  const proposals: IntakeProposal[] = [];
  const seen = { proposal: new Set<string>(), rule: new Set<string>(), entity: new Set<string>() };
  for (const [i, raw] of body.proposals.entries()) {
    const where = `proposals[${i}]`;
    if (!isObj(raw)) return fail(`${where}: not an object`);
    if (!nonEmpty(raw.id)) return fail(`${where}: missing "id"`);
    if (seen.proposal.has(raw.id)) return fail(`${where}: duplicate proposal id "${raw.id}"`);
    seen.proposal.add(raw.id);
    if (!nonEmpty(raw.sourceSection)) return fail(`${where}: missing "sourceSection" (the pitch quote the reviewer is shown)`);
    const base = { id: raw.id, sourceSection: raw.sourceSection.trim() };

    if (raw.kind === 'rule') {
      const rule = parseRule(raw.rule, where, ctx);
      if (!rule.ok) return rule;
      if (seen.rule.has(rule.data.id)) return fail(`${where}: duplicate rule id "${rule.data.id}"`);
      seen.rule.add(rule.data.id);
      proposals.push({ ...base, kind: 'rule', rule: rule.data });
    } else if (raw.kind === 'entity') {
      const entity = parseEntity(raw.entity, where, ctx);
      if (!entity.ok) return entity;
      const key = `${entity.data.catalogId}/${entity.data.entityId}`;
      if (seen.entity.has(key)) return fail(`${where}: duplicate entity id "${key}"`);
      seen.entity.add(key);
      proposals.push({ ...base, kind: 'entity', entity: entity.data });
    } else {
      return fail(`${where}: kind must be "rule" or "entity", got ${JSON.stringify(raw.kind)}`);
    }
  }
  return { ok: true, data: { runId: body.runId.trim(), proposals } };
}
