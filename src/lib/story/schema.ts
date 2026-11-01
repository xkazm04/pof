/**
 * `storyGraphSchema` — the runtime reference implementation of `pof.storygraph/1`.
 *
 * The normative text is `docs/architecture/storygraph-standard.md`; the type contract is
 * `./types.ts`. This schema is the only thing permitted to accept an untrusted document.
 *
 * What this schema checks, and what it deliberately does NOT:
 *   - It checks SHAPE: every field the standard names has the type the standard gives it, and the
 *     `variables` block (the keystone, §3) is checked strictly — a declaration that cannot be read
 *     refuses the whole document rather than degrading to "unconstrained".
 *   - It does NOT check cross-references (a dangling edge, an undeclared variable, a write outside
 *     a domain, a node absent from `writers`). Those are structural FINDINGS (§8) that a validator
 *     reports and attaches to a node; refusing the import would hide the very graph that needs
 *     them. A document that parses is a document that can be measured, not a document that passed.
 *   - `kind` (node, edge) and `coreKind` (profile) accept ANY non-empty string. The core set is
 *     closed, but §4 obliges a reader to keep an unknown kind as a labelled generic node and to
 *     report it — dropping or refusing it is the defect the rule exists to prevent. The importer
 *     reports them (`findUnknownKinds`).
 *   - Objects are LOOSE: unknown fields are ignored by validation and carried through untouched,
 *     because a producer emits storygraph as a lossless superset of its own format (§1).
 *
 * Absent-value convention: omit the key = not applicable. `null` is accepted ONLY where absence is
 * a claim — `variable.initial` (with `requiresWrite: true`) and `run.graphHash`.
 */

import { z } from 'zod';
import type { Cond } from '@/lib/story/types';

export const STORY_FORMAT = 'pof.storygraph/1' as const;

export const CORE_NODE_KINDS = ['entry', 'event', 'choice', 'gate', 'container', 'ending', 'template'] as const;
export const CORE_EDGE_KINDS = ['then', 'option', 'gate', 'contains', 'influences'] as const;

const id = z.string().min(1, 'must be a non-empty string');
const ids = z.array(id);
const finite = z.number().finite();
const condOp = z.enum(['==', '!=', '<', '<=', '>', '>=', 'in']);
/** An open string: the core set is closed, but an unknown kind is preserved and reported. */
const openKind = z.string().min(1, 'kind must be a non-empty string');

/* ------------------------------------------------------------------ Cond (§6) */

const hasValue = (o: object) => 'value' in o;

export const condSchema: z.ZodType<Cond> = z.lazy(() =>
  z.union([
    z.strictObject({ all: z.array(condSchema).min(1) }),
    z.strictObject({ any: z.array(condSchema).min(1) }),
    z.strictObject({ not: condSchema }),
    z
      .strictObject({ var: id, op: condOp, value: z.unknown() })
      .refine(hasValue, 'a var atom must carry `value`')
      .refine((a) => a.op !== 'in' || Array.isArray(a.value), 'op `in` needs an array `value`'),
    z.strictObject({ flag: id }),
    z.strictObject({ visited: id }),
    z.strictObject({ axis: z.strictObject({ op: condOp, value: finite }) }),
    z.strictObject({ ref: id }),
    z.strictObject({ chance: finite.min(0).max(1) }),
    z.strictObject({ expr: z.string() }),
  ]),
) as z.ZodType<Cond>;

/* ------------------------------------------------------------- variables (§3) */

const variableDomainSchema = z.looseObject({
  min: finite.optional(),
  max: finite.optional(),
  values: z.array(z.unknown()).min(1).optional(),
});

function inDomain(v: unknown, type: string, d: z.infer<typeof variableDomainSchema>): string | null {
  const numeric = type === 'int' || type === 'float';
  if (type === 'bool' && typeof v !== 'boolean') return 'must be a boolean';
  if (numeric && (typeof v !== 'number' || !Number.isFinite(v))) return 'must be a finite number';
  if (type === 'int' && !Number.isInteger(v)) return 'must be an integer';
  if ((type === 'enum' || type === 'string') && typeof v !== 'string') return 'must be a string';
  if (numeric && d.min !== undefined && (v as number) < d.min) return `is below domain.min ${d.min}`;
  if (numeric && d.max !== undefined && (v as number) > d.max) return `is above domain.max ${d.max}`;
  if (d.values && !d.values.some((x) => Object.is(x, v))) return 'is not one of domain.values';
  return null;
}

export const storyVariableSchema = z
  .looseObject({
    name: id,
    type: z.enum(['bool', 'enum', 'int', 'float', 'string']),
    domain: variableDomainSchema,
    initial: z.unknown(),
    requiresWrite: z.boolean().optional(),
    writers: ids,
    scope: z.enum(['conversation', 'quest', 'playthrough', 'persistent']),
    external: z.boolean(),
    doc: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const fail = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const d = v.domain;
    if (!('initial' in v) || v.initial === undefined) {
      fail(['initial'], 'is required: a value, or null with requiresWrite: true');
    } else if (v.initial === null && v.requiresWrite !== true) {
      fail(['initial'], 'null is only a claim together with requiresWrite: true');
    }
    if (v.type === 'enum' && !d.values) fail(['domain', 'values'], 'an enum must declare its values');
    if ((v.type === 'int' || v.type === 'float') && !d.values && (d.min === undefined || d.max === undefined)) {
      fail(['domain'], 'a numeric variable must declare min and max (or values)');
    }
    if (d.min !== undefined && d.max !== undefined && d.min > d.max) fail(['domain'], 'min exceeds max');
    for (const [i, x] of (d.values ?? []).entries()) {
      const why = inDomain(x, v.type, { values: undefined, min: d.min, max: d.max });
      if (why) fail(['domain', 'values', i], `${JSON.stringify(x)} ${why} for type ${v.type}`);
    }
    if (v.initial !== null && v.initial !== undefined) {
      const why = inDomain(v.initial, v.type, d);
      if (why) fail(['initial'], `${JSON.stringify(v.initial)} ${why}`);
    }
  });

export const storyVariablesSchema = z.array(storyVariableSchema).superRefine((vars, ctx) => {
  const seen = new Set<string>();
  vars.forEach((v, i) => {
    if (seen.has(v.name)) {
      ctx.addIssue({ code: 'custom', path: [i, 'name'], message: `duplicate declaration of "${v.name}"` });
    }
    seen.add(v.name);
  });
});

/* ------------------------------------------------------------ nodes and edges */

export const storyNodeSchema = z.looseObject({
  id,
  kind: openKind,
  class: z.string().optional(),
  title: z.string().optional(),
  axis: finite.optional(),
  lanes: z.array(z.string()).optional(),
  parent: id.optional(),
  text: z.string().optional(),
  options: z.array(z.looseObject({ id, label: z.string().optional() })).optional(),
  realises: z
    .array(z.looseObject({ catalogId: id, entityId: id, role: z.string().optional() }))
    .optional(),
  status: z.string().optional(),
  authoring: z.string().optional(),
  source: z.string().optional(),
});

const writeSchema = z
  .looseObject({ var: id, op: z.enum(['set', 'add', 'sub', 'min', 'max', 'push']), value: z.unknown() })
  .refine(hasValue, 'a write must carry `value`');

export const storyEdgeSchema = z.looseObject({
  id,
  from: id,
  to: id,
  kind: openKind,
  optionId: z.string().optional(),
  label: z.string().optional(),
  when: condSchema.optional(),
  writes: z.array(writeSchema).optional(),
  chance: finite.min(0).max(1).optional(),
});

export const storyEndingSchema = z.looseObject({
  node: id,
  precedence: finite.optional(),
  label: z.string().optional(),
  when: condSchema.optional(),
  witness: ids.optional(),
});

/* --------------------------------------------------- profile, budgets, evidence */

export const storyProfileSchema = z.looseObject({
  axis: z
    .looseObject({ name: id, unit: id, min: finite, max: finite })
    .refine((a) => a.min <= a.max, 'axis.min exceeds axis.max')
    .optional(),
  lanes: z.array(z.looseObject({ id, label: z.string() })).optional(),
  nodeClasses: z.array(z.looseObject({ id, coreKind: openKind, label: z.string() })).optional(),
  languages: z.array(id).optional(),
  voicedFraction: finite.min(0).max(1).optional(),
});

export const storyBudgetsSchema = z.looseObject({
  unit: z.enum(['words', 'characters']),
  basis: z.string().min(1, 'a budget figure carries its basis'),
  perClass: z.record(z.string(), finite.min(0)),
});

export const storyEvidenceSchema = z.looseObject({
  runs: z.array(
    z.looseObject({
      runId: id,
      engine: id,
      config: z.string().optional(),
      seeds: z.string().optional(),
      n: z.number().int().min(0),
      graphHash: z.string().nullable(),
      capturedAt: z.string().optional(),
      cohorts: z.array(z.string()),
      provisional: z.boolean().optional(),
    }),
  ),
  /** nodeId -> cohort -> percent. A node ABSENT here is unmeasured — never 0. */
  reach: z.record(z.string(), z.record(z.string(), finite.min(0).max(100))),
  unit: z.string().optional(),
});

/* -------------------------------------------------------------- the envelope */

export const storyGraphSchema = z.looseObject({
  format: z.literal(STORY_FORMAT),
  project: id,
  graphId: id,
  revision: z.number().int().min(0),
  contentHash: z.string().optional(),
  producer: z.looseObject({ tool: z.string(), version: z.string(), generatedAt: z.string() }).optional(),
  source: z.record(z.string(), z.unknown()).optional(),
  /**
   * §11 does not list `profile` among a conformant producer's required fields, while `types.ts`
   * types it as present. A document without one is accepted and read as `{}` (no axis, no lanes,
   * no classes) — the only reading that honours both.
   */
  profile: storyProfileSchema.default({}),
  variables: storyVariablesSchema,
  entries: ids.min(1, 'entries must declare at least one entry point'),
  nodes: z.array(storyNodeSchema),
  edges: z.array(storyEdgeSchema),
  endings: z.array(storyEndingSchema),
  budgets: storyBudgetsSchema,
  definitions: z.record(z.string(), condSchema).optional(),
  evidence: storyEvidenceSchema.optional(),
});

export type ParsedStoryGraph = z.infer<typeof storyGraphSchema>;
