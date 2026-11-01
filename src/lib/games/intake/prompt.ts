/**
 * The pitch-intake CLI prompt — pure (spark gtai-uprising-project, WP3).
 *
 * A model reads `games/<id>/pitch.md` and splits it into PROPOSED scoped canon rules and starter
 * entities, returned as ONE `@@CALLBACK` block whose body is an `IntakeCallbackBody`. The block is
 * addressed to `POST /api/games/<id>/intake` (`intakeCallbackDescriptor`): a terminal run declares
 * the descriptor and the server settles the POST; the lab's server-side run (`…/intake/run`) awaits
 * the same block and feeds it through the same parser. Either way nothing is written until the
 * operator accepts a proposal.
 *
 * Canon doctrine (registry: design-canon-as-executable-law): one statement per rule, the numbers in
 * the rule body, scoped to a catalog when it only governs one, never a second design bible.
 */
import type { TaskCallback } from '@/lib/cli-task';
import type { GameDef, ManifestEntry } from '@/lib/games/types';

export interface IntakePromptInputs {
  game: GameDef;
  /** The game's authoring profile (`authoringProfileOf(game.id)`). */
  authoringProfile: string;
  /** The pitch markdown, verbatim. */
  pitch: string;
  /** Registered catalogIds (the pipeline registry). Only manifest ∩ registered may receive entities. */
  registered: readonly string[];
  /** Mints the callback id; also merged into the body as a static field. */
  runId: string;
}

/** Callback marker id for one intake run. Echo target only (`@@CALLBACK:(\S+)`), so slug-safe. */
export function intakeCallbackId(gameId: string, runId: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'run';
  return `intake-${slug(gameId)}-${slug(runId)}`;
}

export const intakeCallbackUrl = (gameId: string) => `/api/games/${gameId}/intake`;

const SCHEMA_HINT = `  "proposals": [
    { "id": "p1", "kind": "rule", "sourceSection": "<pitch heading or sentence quoted>",
      "rule": { "id": "<gameId>-<slug>", "category": "art|game|project", "scope": "global|<manifest catalogId>",
                "title": "<short law>", "body": "<one statement, numbers included>", "profile": "<authoring profile>" } },
    { "id": "p2", "kind": "entity", "sourceSection": "<pitch heading or sentence quoted>",
      "entity": { "catalogId": "<manifest catalogId>", "entityId": "<gameId>-<slug>", "name": "<display name>",
                  "tags": ["<tag>"], "data": {} } }
  ]`;

/** The descriptor a terminal run declares; the server POSTs the merged body to the intake route. */
export function intakeCallbackDescriptor(gameId: string, runId: string): TaskCallback {
  return { id: intakeCallbackId(gameId, runId), url: intakeCallbackUrl(gameId), method: 'POST', staticFields: { runId }, schemaHint: SCHEMA_HINT };
}

function manifestLines(manifest: readonly ManifestEntry[], registered: ReadonlySet<string>): { usable: string[]; planned: string[] } {
  const usable: string[] = [];
  const planned: string[] = [];
  for (const e of manifest) {
    const line = `- \`${e.catalogId}\` (${e.fit})${e.note ? ` — ${e.note}` : ''}`;
    if (e.fit === 'planned') planned.push(line);
    else if (registered.has(e.catalogId)) usable.push(line);
  }
  return { usable, planned };
}

export function buildIntakePrompt({ game, authoringProfile, pitch, registered, runId }: IntakePromptInputs): string {
  const reg = new Set(registered);
  const manifest: readonly ManifestEntry[] = game.manifest === 'all'
    ? registered.map((catalogId) => ({ catalogId, fit: 'reuse' as const }))
    : game.manifest;
  const { usable, planned } = manifestLines(manifest, reg);
  const prefix = `${game.id}-`;
  const cb = intakeCallbackDescriptor(game.id, runId);

  return [
    `# Pitch intake — ${game.title} (game id \`${game.id}\`)`,
    'Split the pitch below into PROPOSED canon rules and starter catalog entities. An operator reviews every proposal; nothing you return is written until it is accepted, so propose only what the pitch actually states.',
    '## Canon rules',
    [
      `- Every rule carries \`"profile": "${authoringProfile}"\` (this game's authoring profile). A missing profile reads as PoF's own world and is refused.`,
      `- Rule ids start with \`${prefix}\`. Categories: \`art\` (visual/audio direction), \`game\` (design law), \`project\` (production convention).`,
      '- One statement per rule, with its numbers in the body (a range, a count, a ratio) when the pitch gives one. Do not restate the pitch as prose; a rule is a law a producer can be graded against.',
      '- `scope` is `global`, or one manifest catalogId below when the law governs only that catalog.',
    ].join('\n'),
    '## Starter entities',
    [
      `- \`entityId\` starts with \`${prefix}\` (entity keys are global across games), then a kebab-case slug.`,
      '- `catalogId` MUST be one of the usable manifest catalogs below. Propose an entity only where the pitch names one (a boss, a district, a weapon, a contract).',
      '- `data` holds only values the pitch states; leave it `{}` rather than invent numbers.',
    ].join('\n'),
    '## Usable manifest catalogs',
    usable.length ? usable.join('\n') : '(none — the manifest has no registered pipelines yet; propose rules only)',
    ...(planned.length ? ['## Planned pipelines (not built — propose NO entities for these)', planned.join('\n')] : []),
    '## Provenance',
    '- `sourceSection` quotes the pitch heading or sentence each proposal came from, so the reviewer can check it against the pitch.',
    '- Proposal `id`s are unique within this reply.',
    '## Pitch',
    '```markdown',
    pitch.trim(),
    '```',
    '## OUTPUT (required)',
    'Reply with exactly ONE callback block. Nothing outside the block is read.',
    `The field \`runId\` (\`${JSON.stringify(runId)}\`) is added automatically — do NOT include it.`,
    `@@CALLBACK:${cb.id}`,
    `{\n${SCHEMA_HINT}\n}`,
    '@@END_CALLBACK',
  ].join('\n\n');
}
