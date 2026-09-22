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
  /** Keep only the capture group of `pattern`; a value that does not match produces nothing. */
  | { op: 'unwrap'; pattern: string };

export const split = (sep: string): DecodeStep => ({ op: 'split', sep });
export const dropValues = (...values: string[]): DecodeStep => ({ op: 'drop', values });
export const unwrap = (pattern: string): DecodeStep => ({ op: 'unwrap', pattern });

/**
 * Apply `steps` in order to one raw cell. Always returns a list: zero values means "write
 * nothing", which is how a blank cell has always been treated.
 */
export function applyDecode(raw: string, steps: readonly DecodeStep[] = []): string[] {
  let values = raw.trim() === '' ? [] : [raw.trim()];
  for (const step of steps) {
    if (step.op === 'split') {
      values = values.flatMap((v) => v.split(step.sep).map((p) => p.trim()).filter((p) => p !== ''));
    } else if (step.op === 'drop') {
      values = values.filter((v) => !step.values.includes(v));
    } else {
      const re = new RegExp(step.pattern);
      values = values.flatMap((v) => {
        const m = re.exec(v);
        return m && m[1] !== undefined ? [m[1]] : [];
      });
    }
  }
  return values;
}
