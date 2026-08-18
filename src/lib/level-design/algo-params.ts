/**
 * Which procgen parameter each algorithm actually reads — the single source the
 * generators and the wizard's sliders both answer to.
 *
 * Three of the four algorithms ignored the parameters the wizard offered:
 * `cellularGrid` and `perlinGrid` discarded `AlgoParams` outright, `wfcGrid`
 * never dereferenced it, and `roomCountMin` was read by NOTHING. So dragging
 * "Min Rooms", "Max Rooms" and "Corridor Width" visibly did nothing for three of
 * them, with no hint that it wouldn't.
 *
 * The rule now: a parameter either affects every algorithm it is shown for, or
 * it is disabled for that algorithm WITH the reason on screen. `null` here means
 * "the generator reads it"; a string is the reason it is inert — and it is the
 * text the slider shows. A test walks this table against the real generators, so
 * the table cannot drift from what the code does.
 */

export type PreviewAlgorithm = 'bsp' | 'wfc' | 'cellular' | 'perlin';
export type AlgoParamKey = 'roomCountMin' | 'roomCountMax' | 'corridorWidth';

const CELLULAR_REASON =
  'Cellular automata carves organic caves from a random fill — it has no room list and no corridors to size. Grid size and seed shape the result.';
const PERLIN_REASON =
  'Perlin noise thresholds a continuous height field into terrain — it produces regions, not discrete rooms or corridors.';

export const ALGO_PARAM_SUPPORT: Record<PreviewAlgorithm, Record<AlgoParamKey, string | null>> = {
  // Split depth is driven by the room band; corridors are carved between leaves.
  bsp: { roomCountMin: null, roomCountMax: null, corridorWidth: null },
  // The room band sets the tile collapse probability; doors are widened to the
  // corridor width.
  wfc: { roomCountMin: null, roomCountMax: null, corridorWidth: null },
  cellular: { roomCountMin: CELLULAR_REASON, roomCountMax: CELLULAR_REASON, corridorWidth: CELLULAR_REASON },
  perlin: { roomCountMin: PERLIN_REASON, roomCountMax: PERLIN_REASON, corridorWidth: PERLIN_REASON },
};

/** The reason `key` is inert for `algorithm`, or null when the generator reads it. */
export function paramDisabledReason(algorithm: PreviewAlgorithm, key: AlgoParamKey): string | null {
  return ALGO_PARAM_SUPPORT[algorithm]?.[key] ?? null;
}

/** True when the algorithm reads none of the room/corridor parameters. */
export function ignoresRoomParams(algorithm: PreviewAlgorithm): boolean {
  const support = ALGO_PARAM_SUPPORT[algorithm];
  return !!support && (['roomCountMin', 'roomCountMax', 'corridorWidth'] as AlgoParamKey[])
    .every((k) => support[k] !== null);
}

/**
 * The room band as the generators read it. An inverted band (min > max) is
 * FLAGGED in the UI and read swapped here, so a mis-dragged pair produces a
 * sensible layout instead of a silently empty one.
 */
export function normalizeRoomBand(roomCountMin: number, roomCountMax: number): { min: number; max: number } {
  const a = Number.isFinite(roomCountMin) ? Math.max(1, Math.floor(roomCountMin)) : 1;
  const b = Number.isFinite(roomCountMax) ? Math.max(1, Math.floor(roomCountMax)) : 1;
  return a <= b ? { min: a, max: b } : { min: b, max: a };
}

/** The message shown when the room band is inverted, or null when it is fine. */
export function roomBandError(roomCountMin: number, roomCountMax: number): string | null {
  if (roomCountMin <= roomCountMax) return null;
  return `Min Rooms (${roomCountMin}) is above Max Rooms (${roomCountMax}) — the generator reads the pair swapped.`;
}
