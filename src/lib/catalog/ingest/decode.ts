/**
 * Value decoders for mapped source columns — DATA, not functions.
 *
 * A raw cell is rarely the value PoF wants. The Diablo tables alone carry three shapes the
 * first mapping got wrong on real data:
 *  - a comma-separated flag list (`abilityFlags` = `SEARCH,CAN_OPEN_DOOR`) that must become
 *    several values, not one string;
 *  - a SENTINEL (`treasure` = `None`) that means "nothing" and must not become a link to an
 *    entity literally called "None";
 *  - a WRAPPED reference (`treasure` = `Uniq(CLEAVER)`) whose payload is the part inside.
 *
 * Decoders are plain objects so a `FieldMap` stays JSON-serializable. That is load-bearing:
 * the mapping VERSION is a hash of the map (`mappingVersion`), and a decoder written as a
 * closure would stringify to nothing — the version would not move when the decoder changed,
 * and a re-projection would be skipped silently. (The same hollow-value trap as a React
 * component in a persisted payload, one layer up.)
 */

export type DecodeStep =
  /** One cell → several values. Empty parts are dropped. */
  | { op: 'split'; sep: string }
  /** Values that mean "none" in the source vocabulary; they produce nothing. */
  | { op: 'drop'; values: string[] }
  /** Add a stable namespace to a source identifier. */
  | { op: 'prefix'; value: string }
  /** Convert a human label to the lower-kebab identity used by catalog ids. */
  | { op: 'slug' }
  /** Parse every value as a base-10 integer, refusing malformed numeric cells. */
  | { op: 'integer' }
  /** Decode one delimited cell as a fixed-length integer array. */
  | { op: 'integer-list'; sep: string; length: number }
  /** Decode a delimited enum set into semantic boolean flags. */
  | { op: 'boolean-flags'; sep: string; values: Record<string, { key: string; value: boolean }> }
  /** Keep only the capture group of `pattern`; a value that does not match produces nothing. */
  | { op: 'unwrap'; pattern: string };

export type StringDecodeStep = Exclude<DecodeStep,
  { op: 'integer' } | { op: 'integer-list' } | { op: 'boolean-flags' }>;

export const split = (sep: string): Extract<DecodeStep, { op: 'split' }> => ({ op: 'split', sep });
export const dropValues = (...values: string[]): Extract<DecodeStep, { op: 'drop' }> => ({ op: 'drop', values });
export const prefix = (value: string): Extract<DecodeStep, { op: 'prefix' }> => ({ op: 'prefix', value });
export const slug = (): Extract<DecodeStep, { op: 'slug' }> => ({ op: 'slug' });
export const integer = (): Extract<DecodeStep, { op: 'integer' }> => ({ op: 'integer' });
export const integerList = (length: number, sep = ','): Extract<DecodeStep, { op: 'integer-list' }> => ({ op: 'integer-list', sep, length });
export const booleanFlags = (
  values: Record<string, { key: string; value: boolean }>,
  sep = ',',
): Extract<DecodeStep, { op: 'boolean-flags' }> => ({ op: 'boolean-flags', sep, values });
export const unwrap = (pattern: string): Extract<DecodeStep, { op: 'unwrap' }> => ({ op: 'unwrap', pattern });

export type DecodedValue = string | number | boolean | readonly number[] | Record<string, boolean>;

/**
 * Apply `steps` in order to one raw cell. Always returns a list: zero values means "write
 * nothing", which is how a blank cell has always been treated.
 */
export function applyDecode(raw: string, steps?: readonly StringDecodeStep[]): string[];
export function applyDecode(raw: string, steps?: readonly DecodeStep[]): DecodedValue[];
export function applyDecode(raw: string, steps: readonly DecodeStep[] = []): DecodedValue[] {
  let values: DecodedValue[] = raw.trim() === '' ? [] : [raw.trim()];
  for (const step of steps) {
    if (step.op === 'split') {
      values = values.flatMap((value) => {
        if (typeof value !== 'string') throw new Error(`split decoder requires a string, got ${typeof value}`);
        return value.split(step.sep).map((part) => part.trim()).filter((part) => part !== '');
      });
    } else if (step.op === 'drop') {
      values = values.filter((value) => typeof value !== 'string' || !step.values.includes(value));
    } else if (step.op === 'prefix') {
      values = values.map((value) => `${step.value}${String(value)}`);
    } else if (step.op === 'slug') {
      values = values
        .map((value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
        .filter(Boolean);
    } else if (step.op === 'integer') {
      values = values.map((value) => {
        const text = String(value);
        if (!/^-?\d+$/.test(text)) throw new Error(`integer decoder received "${text}"`);
        return Number(text);
      });
    } else if (step.op === 'integer-list') {
      values = values.map((value) => {
        if (typeof value !== 'string') throw new Error(`integer-list decoder requires a string, got ${typeof value}`);
        const parts = value.split(step.sep).map((part) => part.trim());
        if (parts.length !== step.length) {
          throw new Error(`integer-list decoder expected ${step.length} entries, got ${parts.length}`);
        }
        return parts.map((part) => {
          if (!/^-?\d+$/.test(part)) throw new Error(`integer-list decoder received "${part}"`);
          return Number(part);
        });
      });
    } else if (step.op === 'boolean-flags') {
      values = values.map((value) => {
        if (typeof value !== 'string') throw new Error(`boolean-flags decoder requires a string, got ${typeof value}`);
        const result: Record<string, boolean> = {};
        for (const token of value.split(step.sep).map((part) => part.trim()).filter(Boolean)) {
          const flag = step.values[token];
          if (!flag) throw new Error(`boolean-flags decoder received unknown flag "${token}"`);
          result[flag.key] = flag.value;
        }
        return result;
      });
    } else {
      const re = new RegExp(step.pattern);
      values = values.flatMap((value) => {
        const m = re.exec(String(value));
        return m && m[1] !== undefined ? [m[1]] : [];
      });
    }
  }
  return values;
}
