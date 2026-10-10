/**
 * The fields a step's checker GRADES, exposed so the produce prompt can name them.
 *
 * Measured 2026-09-22 (/diablo W02c): of 114 steps whose checker states required keys, 102 had produce
 * prompts that never named at least one of them — every producer, the app's own Claude CLI included,
 * was graded against a schema it was never shown. The same run then showed the other two shapes of the
 * same defect: a TEXT field graded by length (`lore` ≥ 200 chars) that the prompt never named, and a
 * `wiringContract` whose STRUCTURE (dependencies is an array) was never stated. The schema already lives
 * in the checkers; this reads it back out.
 */
import { allOfMembers } from './combinators';
import { SOURCED_FIELD } from './sourced';
import { TEMPLATE_FIELD } from './template';
import type { Checker } from './types';
import type { StepSpec } from '@/lib/catalog/stepSpec';

const REQUIRED_FIELDS = Symbol.for('pof.requiredFields');

export interface RequiredFields {
  /** The artifact field (top level, or a dot-path for a nested contract). */
  field: string;
  /** Keys the checker requires inside an object field. */
  keys?: string[];
  /** Keys that depend on the entity's canon profile (/diablo W03, D14) — replace `keys` for that profile. */
  keysByProfile?: Readonly<Record<string, readonly string[]>>;
  /** A text field graded by length. */
  minChars?: number;
  /** A LIST graded by item count. */
  minItems?: number;
  /** A structural shape, stated in prose, for a field whose FORMAT is graded. */
  shape?: string;
  /** Graded only when present (e.g. a wiring contract is optional, but must be well-formed). */
  optional?: boolean;
}

export function tagRequiredFields<T extends Checker>(checker: T, req: RequiredFields): T {
  Object.defineProperty(checker, REQUIRED_FIELDS, { value: req, enumerable: false });
  return checker;
}

/**
 * Every requirement a checker grades, through `allOf` compositions, merged per field. Pass the
 * entity's canon profile to resolve profile-dependent keys (a Diablo monster's resistances are
 * magic/fire/lightning, PoF's fire/ice/lightning/chaos); without one, the project's keys.
 */
export function requiredFieldsOf(checker: Checker, canonProfile?: string | null): RequiredFields[] {
  const byField = new Map<string, RequiredFields>();
  const visit = (c: Checker) => {
    const own = (c as unknown as Record<symbol, RequiredFields | undefined>)[REQUIRED_FIELDS];
    if (own) {
      const cur = byField.get(own.field) ?? { field: own.field };
      const keys = (canonProfile && own.keysByProfile?.[canonProfile]) || own.keys;
      if (keys) cur.keys = [...new Set([...(cur.keys ?? []), ...keys])];
      if (own.minChars != null) cur.minChars = Math.max(cur.minChars ?? 0, own.minChars);
      if (own.minItems != null) cur.minItems = Math.max(cur.minItems ?? 0, own.minItems);
      // Every shape rule on a field reaches the prompt: keeping only the first dropped the Stat Block's second rule
      // (its units, /diablo D30) — a producer graded on a rule it was never shown.
      if (own.shape && !(cur.shape ?? '').includes(own.shape)) cur.shape = cur.shape ? `${cur.shape}; ${own.shape}` : own.shape;
      cur.optional = (cur.optional ?? true) && !!own.optional;
      byField.set(own.field, cur);
    }
    for (const m of allOfMembers(c) ?? []) visit(m);
  };
  visit(checker);
  return [...byField.values()];
}

const READ_PROBE_ENTITY = { id: 'graded-fields-probe', name: 'Graded Fields Probe', lifecycle: 'planned' as const, data: {} };
const readCache = new WeakMap<object, GradedRead>();

/** The top-level keys a checker read, and whether its verdict on the stub was `deferred`. */
export interface GradedRead { fields: readonly string[]; deferred: boolean }

/**
 * Every TOP-LEVEL field a step's checker actually READS — the total the Required fields list is
 * a part of. Tags are opt-in, so `requiredFieldsOf` is only the checkers that state their keys:
 * measured 2026-10-10, 58 of 259 graded steps read a field their prompt never named as a key
 * (19 on value laws such as `pricePowerRatio` and `integratedLUFS`, the rest `links`), and the
 * reason-text guard could not see them because a value law's pending reason names no "missing:".
 *
 * Recorded by running `accept` over a Proxy of the step's own produce stub, the same recorder the
 * fleet spec linter uses (rule e). Only the KEYS the checker touches are kept — never a stub value,
 * so no entity's content reaches another's prompt (D12). The stub only gets the checker past its
 * early returns; a step whose produce or accept throws contributes nothing.
 */
export function gradedFieldsOf(spec: Pick<StepSpec, 'produce' | 'accept'>): GradedRead {
  const hit = readCache.get(spec);
  if (hit) return hit;
  const read = new Set<string>();
  let deferred = false;
  try {
    const out = spec.produce(READ_PROBE_ENTITY);
    const data = { ...((out.data ?? {}) as Record<string, unknown>) };
    const links = (out as { links?: unknown }).links;
    if (links != null && data.links == null) data.links = links;
    const graded = (k: string | symbol): k is string => typeof k === 'string' && k !== SOURCED_FIELD && k !== TEMPLATE_FIELD;
    const proxy = new Proxy(data, {
      get(t, k) { if (graded(k)) read.add(k); return Reflect.get(t, k); },
      has(t, k) { if (graded(k)) read.add(k); return Reflect.has(t, k); },
    });
    deferred = spec.accept(proxy).status === 'deferred';
  } catch {
    read.clear();
  }
  const result = { fields: [...read], deferred };
  readCache.set(spec, result);
  return result;
}

/**
 * The closure the prompt states: graded = described + named + settled later, every count derived.
 * `listed` are the top-level fields the tagged requirements describe. The other reads get a
 * disposition, never silence: on a step whose stub verdict is `deferred` they are `settledLater`
 * (an L3/L4 runner or the gallery selection writes them, so a producer must NOT be told to - the
 * same exemption the spec linter's rule e makes); otherwise they are `rest`, named in the prompt.
 */
export function gradedFieldClosure(
  spec: Pick<StepSpec, 'produce' | 'accept'>,
  required: readonly RequiredFields[],
): { total: number; listed: string[]; rest: string[]; settledLater: string[] } {
  const listed = [...new Set(required.map((r) => r.field.split('.')[0]))];
  const { fields, deferred } = gradedFieldsOf(spec);
  const unlisted = fields.filter((f) => !listed.includes(f));
  const rest = deferred ? [] : unlisted;
  const settledLater = deferred ? unlisted : [];
  return { total: listed.length + rest.length + settledLater.length, listed, rest, settledLater };
}

/** One prompt line per requirement — the exact field names and what the checker needs of them. */
export function requiredFieldLine(r: RequiredFields): string {
  const name = `\`${r.field}\``;
  const parts: string[] = [];
  if (r.keys?.length) parts.push(`an object with keys ${r.keys.map((k) => `\`${k}\``).join(', ')}`);
  if (r.minChars != null) parts.push(`text of at least ${r.minChars} characters`);
  if (r.minItems != null) parts.push(`a JSON array with at least ${r.minItems} item(s)`);
  if (r.shape) parts.push(r.shape);
  return `- ${name}${r.optional ? ' (only if you declare it)' : ''}: ${parts.join('; ')}`;
}
