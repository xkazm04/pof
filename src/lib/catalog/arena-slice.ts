/**
 * Arena Slice — the data-driven definition of a tactical encounter arena, and
 * the `combat-map` catalog's bridge to the existing UE encounter actors.
 *
 * The `combat-map` catalog was registered as "tactical encounter arenas with
 * rules and spawn logic" but seeded only with weapon combos (`ComboSequence`).
 * Meanwhile the runtime arena systems already exist in the UE project:
 *   - `AARPGEncounterArena`   (LevelDesign) — tactical points, elevation tiers, cover discovery
 *   - `ASpawnVolume`          (Spawning)    — wave config + difficulty scaling
 *   - `AARPGEncounterVolume`  (World)       — zone-aware difficulty arc position
 *   - `AARPGCoverPoint`       (LevelDesign) — cover & LoS markers
 *   - `AARPGEnvironmentalHazard` (World)    — periodic/one-shot damage volumes
 * …gated by the `VSArenaSetupTest` / `VSArenaBoundsTest` / `VSArenaCollisionTest`
 * functional tests against the `build_arena.py`-produced arena geometry.
 *
 * `ArenaSliceSpec` is the missing design layer: a persisted, validatable spec
 * whose every field maps 1:1 onto one of those UE structs/enums, so a catalog
 * Arena Slice can be driven idea → placement → test gate. See `## Session
 * Findings` in docs/catalog/core-existing/combat-map/plan.md.
 */

// ── UE-mapped vocabularies (each mirrors a real UENUM) ──────────────────────

/** Elevation tier — mirrors UE `EArenaTier` (AARPGEncounterArena.h). */
export type ArenaTier = 'ground' | 'elevated' | 'high';

/** Cover kind — mirrors UE `ECoverType` (AARPGCoverPoint.h). */
export type CoverKind = 'half' | 'full' | 'pillar';

/** Hazard kind — mirrors UE `EHazardType` (AARPGEnvironmentalHazard.h). */
export type HazardKind = 'fire-floor' | 'poison-cloud' | 'spike-trap' | 'ice-field';

/** Difficulty-arc position — mirrors UE `EEncounterPosition` (AARPGEncounterVolume.h). */
export type EncounterPosition = 'entrance' | 'middle' | 'deep' | 'boss';

/** What ends the encounter in / against the player's favour. */
export type WinCondition = 'clear-all-waves' | 'survive-duration' | 'defeat-boss';
export type LossCondition = 'player-death' | 'timer-expired';

/** Arena-local position in centimetres (UE works in cm). */
export type Vec3Cm = [number, number, number];

// ── Composite shapes (each mirrors a real USTRUCT / actor) ──────────────────

/** A designer-placed tactical position. Mirrors UE `FArenaTacticalPoint`. */
export interface ArenaTacticalPoint {
  location: Vec3Cm;
  tier: ArenaTier;
  goodForRanged: boolean;
  hasNearbyCover: boolean;
  flanking: boolean;
}

/** A cover marker. Mirrors a placed `AARPGCoverPoint`. */
export interface ArenaCoverPoint {
  location: Vec3Cm;
  kind: CoverKind;
  /** Cover surface width in cm (UE `CoverWidth`, ClampMin 50). */
  widthCm: number;
}

/** One spawn wave. Mirrors UE `FSpawnWaveConfig`. */
export interface ArenaWave {
  /** Bestiary archetype id this wave spawns (cross-catalog link → `bestiary`). */
  enemyArchetype: string;
  /** Enemy count (UE `Count`, ClampMin 1). */
  count: number;
  /** Seconds between each spawn in the wave (UE `SpawnInterval`, ClampMin 0). */
  spawnIntervalSec: number;
  /** Seconds before this wave begins after the previous clears (UE `DelayBeforeWave`, ClampMin 0). */
  delayBeforeWaveSec: number;
  /** Extra difficulty stacked on the volume base (UE `WaveDifficultyMultiplier`, ClampMin 1.0). */
  difficultyMultiplier: number;
}

/** An environmental hazard. Mirrors a placed `AARPGEnvironmentalHazard`. */
export interface ArenaHazard {
  kind: HazardKind;
  location: Vec3Cm;
  /** Damage per tick while a character stands in it (UE `DamagePerTick`, ClampMin 0). */
  damagePerTick: number;
  /** Seconds between damage ticks (UE `DamageInterval`, ClampMin 0.1). */
  damageIntervalSec: number;
}

/**
 * A complete, data-driven tactical encounter. The `kind` discriminator
 * distinguishes it from a `ComboSequence` in the shared `combat-map` `data`.
 */
export interface ArenaSliceSpec {
  kind: 'arena-slice';
  id: string;
  name: string;
  theme: string;

  /** Where in a zone's difficulty arc this slice sits (UE `EEncounterPosition`). */
  position: EncounterPosition;

  /** Half-extent of the square play space in cm (the `build_arena.py` arena is 20 m → extent 1000). */
  extentCm: number;
  /** Height above arena floor that counts as "elevated" (UE `ElevatedThreshold`, ClampMin 50). */
  elevatedThresholdCm: number;
  /** Height above arena floor that counts as "high ground" (UE `HighGroundThreshold`, ClampMin 100). */
  highGroundThresholdCm: number;

  tacticalPoints: ArenaTacticalPoint[];
  cover: ArenaCoverPoint[];
  waves: ArenaWave[];
  hazards: ArenaHazard[];

  winCondition: WinCondition;
  lossCondition: LossCondition;
  /** Required only for the `survive-duration` win: seconds the player must last. */
  survivalSeconds?: number;

  // SpawnVolume difficulty knobs (UE `ASpawnVolume`).
  /** Base enemy level (UE `BaseDifficultyLevel`, ClampMin 1). */
  baseDifficultyLevel: number;
  /** Multiplier added per player level above base (UE `DifficultyScalePerLevel`, ClampMin 0). */
  difficultyScalePerLevel: number;
  /** Difficulty multiplier cap (UE `MaxDifficultyMultiplier`, ClampMin 1.0). */
  maxDifficultyMultiplier: number;
  /** If true, the next wave waits for all current enemies dead (UE `bWaitForKillsBeforeNextWave`). */
  waitForKillsBeforeNextWave: boolean;
}

// ── Validation (the design / balance gate, runnable in vitest) ──────────────

/**
 * Validate an Arena Slice spec against the UE structs' invariants (ClampMins)
 * and internal consistency. Returns a list of human-readable problems; an
 * empty array means the spec is well-formed.
 *
 * Pass `knownArchetypeIds` (the seeded bestiary archetype ids, *without* the
 * `bestiary-` prefix) to additionally assert every wave references a real
 * creature — the cross-catalog integrity check.
 */
export function validateArenaSlice(spec: ArenaSliceSpec, knownArchetypeIds?: readonly string[]): string[] {
  const problems: string[] = [];
  const inBounds = (v: Vec3Cm) => Math.abs(v[0]) <= spec.extentCm && Math.abs(v[1]) <= spec.extentCm;

  if (spec.kind !== 'arena-slice') problems.push(`kind must be 'arena-slice' (got '${spec.kind}')`);
  if (spec.extentCm <= 0) problems.push(`extentCm must be > 0 (got ${spec.extentCm})`);
  if (spec.elevatedThresholdCm < 50) problems.push(`elevatedThresholdCm must be >= 50 (got ${spec.elevatedThresholdCm})`);
  if (spec.highGroundThresholdCm <= spec.elevatedThresholdCm) {
    problems.push(`highGroundThresholdCm (${spec.highGroundThresholdCm}) must exceed elevatedThresholdCm (${spec.elevatedThresholdCm})`);
  }

  // Waves — the spine of the encounter.
  if (spec.waves.length === 0) problems.push('an arena slice needs at least one wave');
  spec.waves.forEach((w, i) => {
    if (w.count < 1) problems.push(`wave ${i} count must be >= 1 (got ${w.count})`);
    if (w.spawnIntervalSec < 0) problems.push(`wave ${i} spawnIntervalSec must be >= 0 (got ${w.spawnIntervalSec})`);
    if (w.delayBeforeWaveSec < 0) problems.push(`wave ${i} delayBeforeWaveSec must be >= 0 (got ${w.delayBeforeWaveSec})`);
    if (w.difficultyMultiplier < 1) problems.push(`wave ${i} difficultyMultiplier must be >= 1.0 (got ${w.difficultyMultiplier})`);
    if (knownArchetypeIds && !knownArchetypeIds.includes(w.enemyArchetype)) {
      problems.push(`wave ${i} references unknown bestiary archetype '${w.enemyArchetype}'`);
    }
  });

  // Win/loss coherence.
  if (spec.winCondition === 'survive-duration' && !(typeof spec.survivalSeconds === 'number' && spec.survivalSeconds > 0)) {
    problems.push("winCondition 'survive-duration' requires a positive survivalSeconds");
  }
  if (spec.winCondition === 'defeat-boss' && spec.position !== 'boss') {
    problems.push("winCondition 'defeat-boss' should sit at a 'boss' encounter position");
  }

  // Placement bounds.
  spec.tacticalPoints.forEach((p, i) => { if (!inBounds(p.location)) problems.push(`tactical point ${i} is outside the arena bounds (±${spec.extentCm}cm)`); });
  spec.cover.forEach((c, i) => {
    if (!inBounds(c.location)) problems.push(`cover point ${i} is outside the arena bounds (±${spec.extentCm}cm)`);
    if (c.widthCm < 50) problems.push(`cover point ${i} widthCm must be >= 50 (got ${c.widthCm})`);
  });
  spec.hazards.forEach((h, i) => {
    if (!inBounds(h.location)) problems.push(`hazard ${i} is outside the arena bounds (±${spec.extentCm}cm)`);
    if (h.damagePerTick < 0) problems.push(`hazard ${i} damagePerTick must be >= 0 (got ${h.damagePerTick})`);
    if (h.damageIntervalSec < 0.1) problems.push(`hazard ${i} damageIntervalSec must be >= 0.1 (got ${h.damageIntervalSec})`);
  });

  // Difficulty knobs.
  if (spec.baseDifficultyLevel < 1) problems.push(`baseDifficultyLevel must be >= 1 (got ${spec.baseDifficultyLevel})`);
  if (spec.difficultyScalePerLevel < 0) problems.push(`difficultyScalePerLevel must be >= 0 (got ${spec.difficultyScalePerLevel})`);
  if (spec.maxDifficultyMultiplier < 1) problems.push(`maxDifficultyMultiplier must be >= 1.0 (got ${spec.maxDifficultyMultiplier})`);

  return problems;
}

/** Narrowing guard — true when a catalog `data` blob is an Arena Slice. */
export function isArenaSlice(data: unknown): data is ArenaSliceSpec {
  return !!data && typeof data === 'object' && (data as { kind?: unknown }).kind === 'arena-slice';
}

// ── The seeded target asset ─────────────────────────────────────────────────

/**
 * "Ravaged Courtyard" — the combat-map row's end-to-end target asset. A
 * mid-zone two-wave skirmish in the proven 20 m `build_arena.py` arena:
 * fast Kath Hounds soften the player, then armoured Mandalorians press in;
 * four corner pillars (the arena's existing pillars) give cover, a fire-floor
 * hazard denies the centre. Win by clearing both waves; lose on death.
 */
export const RAVAGED_COURTYARD: ArenaSliceSpec = {
  kind: 'arena-slice',
  id: 'ravaged-courtyard',
  name: 'Ravaged Courtyard',
  theme: 'A scorched Sith-temple courtyard — broken pillars and a smouldering centre.',
  position: 'middle',
  extentCm: 1000,            // 20 m square arena → ±1000 cm (matches build_arena.py walls ~1000)
  elevatedThresholdCm: 150,  // UE AARPGEncounterArena defaults
  highGroundThresholdCm: 300,
  tacticalPoints: [
    { location: [0, 0, 0],        tier: 'ground',   goodForRanged: false, hasNearbyCover: false, flanking: false },
    { location: [-700, 700, 200], tier: 'elevated', goodForRanged: true,  hasNearbyCover: true,  flanking: false },
    { location: [700, -700, 0],   tier: 'ground',   goodForRanged: false, hasNearbyCover: true,  flanking: true  },
  ],
  // Four corner pillars at ±850 cm, mirroring build_arena.py's corner pillars.
  cover: [
    { location: [850, 850, 0],   kind: 'pillar', widthCm: 120 },
    { location: [850, -850, 0],  kind: 'pillar', widthCm: 120 },
    { location: [-850, 850, 0],  kind: 'pillar', widthCm: 120 },
    { location: [-850, -850, 0], kind: 'pillar', widthCm: 120 },
  ],
  waves: [
    { enemyArchetype: 'kath-hound',          count: 4, spawnIntervalSec: 0.5, delayBeforeWaveSec: 0,   difficultyMultiplier: 1.0 },
    { enemyArchetype: 'mandalorian-warrior', count: 3, spawnIntervalSec: 0.7, delayBeforeWaveSec: 2.0, difficultyMultiplier: 1.25 },
  ],
  hazards: [
    { kind: 'fire-floor', location: [0, 0, 0], damagePerTick: 15, damageIntervalSec: 1.0 },
  ],
  winCondition: 'clear-all-waves',
  lossCondition: 'player-death',
  baseDifficultyLevel: 3,
  difficultyScalePerLevel: 0.1,
  maxDifficultyMultiplier: 3.0,
  waitForKillsBeforeNextWave: true,
};

/** Every Arena Slice spec that seeds into the `combat-map` catalog. */
export const ARENA_SLICES: ArenaSliceSpec[] = [RAVAGED_COURTYARD];
