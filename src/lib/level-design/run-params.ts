/**
 * Shared input validation for the UE generation panels.
 *
 * `validateSeed` was duplicated byte-for-byte in ProcGenDungeonPanel and
 * BiomeScatterPanel; two copies of a rule is one copy that will drift. Both
 * panels re-export from here so their existing named imports keep working.
 */

/** Upper bound for a rolled seed — small enough to stay readable in a history row. */
export const SEED_ROLL_MAX = 100000;

/**
 * The room-count range the UE dungeon panel accepts. Lives here rather than in
 * the panel because `procgen-spec` has to clamp a handed-off spec to the same
 * bounds, and a second copy of a bound is a bound that will drift.
 */
export const UE_ROOMS_MIN = 2;
export const UE_ROOMS_MAX = 20;

/**
 * Largest seed the UE generators can represent: `RandomSeed` is an int32 and the
 * spec handoff sends the seed as uint32 (`seedValue >>> 0`), so 2^32 - 1 is the
 * ceiling. A larger value would reach PROCGEN_SEED and the run ledger unchanged
 * while UE used some other number.
 */
export const SEED_MAX = 4294967295;

/**
 * Pure validator for a seed field. Returns an error string when the raw input is
 * empty, non-numeric (NaN), non-integer, negative, or above {@link SEED_MAX};
 * null when acceptable.
 */
export function validateSeed(raw: string): string | null {
  if (raw.trim() === '') return 'Enter a seed';
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'Seed must be a number';
  if (!Number.isInteger(n)) return 'Seed must be a whole number';
  if (n < 0) return 'Seed must be 0 or greater';
  if (n > SEED_MAX) return `Seed must be at most ${SEED_MAX}`;
  return null;
}
