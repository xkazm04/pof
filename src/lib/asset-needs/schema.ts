/**
 * The `asset-needs/1` wire contract: what a game project still needs from an asset maker, read from the
 * project's own files by an adapter (src/lib/asset-needs/bp.ts) and written by scripts/asset-needs.ts to the
 * tracked file asset-needs/<project>.json. Gravitone's scout night reads that file (spark scout-vision S4).
 *
 * Absent values are OMITTED, never null - the validator refuses a null anywhere. `gravitoneClass` absent means
 * the row or need is not briefable by gravitone (materials, backdrops, hand captures, shaders, data-built
 * elements). Docs: docs/asset-needs.md.
 */
import { z } from 'zod';
import { ok, err, type Result } from '@/types/result';

export const ASSET_NEEDS_SCHEMA = 'asset-needs/1' as const;

export const GRAVITONE_CLASSES = ['character', 'weapon', 'prop'] as const;
export type GravitoneClass = (typeof GRAVITONE_CLASSES)[number];

const text = z.string().min(1);
const tris = z.number().int().nonnegative();
const sha = z.string().regex(/^[0-9a-f]{40}$/, 'a full 40-hex commit sha');

const inventoryRowSchema = z.strictObject({
  id: text,
  name: text,
  class: text,
  gravitoneClass: z.enum(GRAVITONE_CLASSES).optional(),
  tris: tris.optional(),
  budgetTris: tris.optional(),
  gates: z.record(z.string(), z.boolean()),
  score: z
    .strictObject({ value: z.number().int().min(0).max(3), of: z.literal(3), source: text })
    .optional(),
});

const needSchema = z.strictObject({
  id: z.string().regex(/^need-[a-z0-9]+(?:-[a-z0-9]+)*$/, 'need-<kebab>'),
  kind: z.enum(['missing', 'scored-low']),
  subject: text,
  class: text,
  gravitoneClass: z.enum(GRAVITONE_CLASSES).optional(),
  why: text,
  evidence: text,
  budgetTris: tris.optional(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  assetId: text.optional(),
});

export const assetNeedsSchema = z
  .strictObject({
    schema: z.literal(ASSET_NEEDS_SCHEMA),
    project: text,
    generatedAt: z.iso.datetime(),
    source: z.strictObject({ repo: text, commit: sha, pofCommit: sha }),
    rules: z.strictObject({ budgets: z.record(z.string(), tris).optional(), notes: z.array(text) }),
    inventory: z.array(inventoryRowSchema),
    needs: z.array(needSchema),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    for (const row of doc.inventory) {
      if (ids.has(row.id)) ctx.addIssue({ code: 'custom', message: `inventory id "${row.id}" repeats` });
      ids.add(row.id);
    }
    const needIds = new Set<string>();
    for (const need of doc.needs) {
      if (needIds.has(need.id)) ctx.addIssue({ code: 'custom', message: `need id "${need.id}" repeats` });
      needIds.add(need.id);
      if (need.assetId !== undefined && !ids.has(need.assetId)) {
        ctx.addIssue({ code: 'custom', message: `need "${need.id}" names assetId "${need.assetId}", not in the inventory` });
      }
      if (need.kind === 'missing' && need.assetId !== undefined) {
        ctx.addIssue({ code: 'custom', message: `need "${need.id}" is missing yet names an inventory asset` });
      }
    }
  });

export type AssetNeeds = z.infer<typeof assetNeedsSchema>;
export type InventoryRow = AssetNeeds['inventory'][number];
export type AssetNeed = AssetNeeds['needs'][number];

/** Validate an unknown value (a parsed file) against `asset-needs/1`; the error lists every issue, one per line. */
export function validateAssetNeeds(value: unknown): Result<AssetNeeds, string[]> {
  const parsed = assetNeedsSchema.safeParse(value);
  if (parsed.success) return ok(parsed.data);
  return err(parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`));
}

/** Rebuild an object with its keys in `order` (contract order), dropping undefined. */
function ordered<T extends object>(obj: T, order: readonly (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of order) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

const sortedRecord = <V>(r: Record<string, V>): Record<string, V> =>
  Object.fromEntries(Object.keys(r).sort().map((k) => [k, r[k]]));

/** The file's bytes: contract key order, 2-space JSON, a newline at the end - so a re-run diffs only what changed. */
export function serializeAssetNeeds(doc: AssetNeeds): string {
  const stable = {
    schema: doc.schema,
    project: doc.project,
    generatedAt: doc.generatedAt,
    source: ordered(doc.source, ['repo', 'commit', 'pofCommit']),
    rules: ordered(
      { budgets: doc.rules.budgets && sortedRecord(doc.rules.budgets), notes: doc.rules.notes },
      ['budgets', 'notes'],
    ),
    inventory: doc.inventory.map((row) =>
      ordered(
        { ...row, gates: sortedRecord(row.gates), score: row.score && ordered(row.score, ['value', 'of', 'source']) },
        ['id', 'name', 'class', 'gravitoneClass', 'tris', 'budgetTris', 'gates', 'score'],
      ),
    ),
    needs: doc.needs.map((need) =>
      ordered(need, ['id', 'kind', 'subject', 'class', 'gravitoneClass', 'why', 'evidence', 'budgetTris', 'priority', 'assetId']),
    ),
  };
  return `${JSON.stringify(stable, null, 2)}\n`;
}
