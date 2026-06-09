// ── AI Director: Squad Tactics Engine ─────────────────────────────────────────
// Composes EQS queries across a squad, allocating positions with awareness
// of ally positions to produce emergent coordinated formations.

import type {
  SquadRole, SquadRoleDefinition, SquadMember,
  SquadFormation, DirectorConfig, DirectorResult, ComposedEQSStep,
  SquadConfigError,
} from '@/types/squad-tactics';
import { type Result, ok, err } from '@/types/result';
import { computeFlankAngle, distance, ringPoint, forwardVector } from '@/lib/ai-director/eqs-geometry';
import { createXorShift32RNG } from '@/lib/seeded-rng';

// ── Role Definitions ─────────────────────────────────────────────────────────

export const ROLE_DEFINITIONS: Record<SquadRole, SquadRoleDefinition> = {
  aggressor: {
    role: 'aggressor',
    label: 'Aggressor',
    description: 'Frontal engagement — draws attention while flankers reposition',
    generators: ['AttackPositions'],
    tests: ['FlankAngle (prefer front)', 'PathExists'],
    engagementRange: [150, 250],
    priority: 3,
  },
  flanker: {
    role: 'flanker',
    label: 'Flanker',
    description: 'Side/rear attack — maximizes flank angle for bonus damage',
    generators: ['AttackPositions'],
    tests: ['FlankAngle (prefer behind)', 'AllySeparation', 'PathExists'],
    engagementRange: [200, 350],
    priority: 2,
  },
  support: {
    role: 'support',
    label: 'Support',
    description: 'Ranged backline — maintains distance, avoids ally overlap',
    generators: ['AttackPositions (outer ring)'],
    tests: ['Distance (prefer far)', 'LineOfSight', 'PathExists'],
    engagementRange: [400, 700],
    priority: 1,
  },
  tank: {
    role: 'tank',
    label: 'Tank',
    description: 'Close-range absorber — stays between target and allies',
    generators: ['AttackPositions (inner ring)'],
    tests: ['FlankAngle (prefer front)', 'Distance (prefer close)', 'PathExists'],
    engagementRange: [100, 200],
    priority: 4,
  },
  ambusher: {
    role: 'ambusher',
    label: 'Ambusher',
    description: 'Hidden position — waits behind cover for opportunistic strike',
    generators: ['CoverPositions'],
    tests: ['LineOfSight (prefer occluded)', 'FlankAngle (prefer behind)', 'PathExists'],
    engagementRange: [250, 500],
    priority: 1,
  },
};

// ── Preset Formations ────────────────────────────────────────────────────────

export const PRESET_FORMATIONS: SquadFormation[] = [
  {
    id: 'pincer',
    name: 'Pincer',
    description: 'Two flankers attack from sides while aggressor holds attention from front',
    roles: [
      { role: 'aggressor', count: 1 },
      { role: 'flanker', count: 2 },
    ],
    size: 3,
  },
  {
    id: 'wolf-pack',
    name: 'Wolf Pack',
    description: 'Tank draws aggro, flankers surround, support provides ranged pressure',
    roles: [
      { role: 'tank', count: 1 },
      { role: 'flanker', count: 2 },
      { role: 'support', count: 1 },
    ],
    size: 4,
  },
  {
    id: 'ambush',
    name: 'Ambush',
    description: 'Aggressor lures target while ambushers wait in cover for the kill',
    roles: [
      { role: 'aggressor', count: 1 },
      { role: 'ambusher', count: 2 },
      { role: 'flanker', count: 1 },
    ],
    size: 4,
  },
  {
    id: 'siege',
    name: 'Siege',
    description: 'Full surround with tank absorbing, flankers cutting retreat, support peppering from range',
    roles: [
      { role: 'tank', count: 1 },
      { role: 'aggressor', count: 1 },
      { role: 'flanker', count: 2 },
      { role: 'support', count: 2 },
    ],
    size: 6,
  },
  {
    id: 'skirmish',
    name: 'Skirmish Line',
    description: 'All aggressors spread in arc — simple but effective for weak enemies',
    roles: [
      { role: 'aggressor', count: 3 },
      { role: 'flanker', count: 1 },
    ],
    size: 4,
  },
];

// ── Default Configuration ────────────────────────────────────────────────────

export const DEFAULT_DIRECTOR_CONFIG: DirectorConfig = {
  formation: PRESET_FORMATIONS[0],
  targetForwardAngle: -Math.PI / 2, // facing up/north
  attackDistance: 200,
  minSeparation: 80,
  flankWeight: 0.4,
  separationWeight: 0.35,
  rangeWeight: 0.25,
  seed: 42,
};

// ── Config Validation ────────────────────────────────────────────────────────

/** Number of ring candidates generated per role (must be > 0). */
const NUM_CANDIDATES = 36;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Validate (and normalize) a director config before the allocation engine runs.
 *
 * Unrecoverable problems — non-finite scalars, empty/zero-member formations,
 * unknown roles, inverted/negative engagement ranges, a zero/negative minimum
 * separation (which would divide by zero) — return a typed {@link SquadConfigError}.
 * Recoverable drift (weights outside [0, 1], a non-finite seed) is clamped/coerced
 * on the returned config so the engine can never emit NaN positions.
 */
export function validateDirectorConfig(
  config: DirectorConfig,
): Result<DirectorConfig, SquadConfigError> {
  const formation = config?.formation;
  if (!formation || !Array.isArray(formation.roles) || formation.roles.length === 0) {
    return err({
      code: 'empty-formation',
      message: 'Formation has no roles to allocate.',
      field: 'formation',
    });
  }

  let memberCount = 0;
  for (const entry of formation.roles) {
    if (!entry || !(entry.role in ROLE_DEFINITIONS)) {
      return err({
        code: 'invalid-role',
        message: `Unknown squad role "${entry?.role}".`,
        field: 'formation',
      });
    }
    if (!Number.isFinite(entry.count) || entry.count < 0) {
      return err({
        code: 'invalid-formation',
        message: `Role "${entry.role}" has an invalid member count.`,
        field: 'formation',
      });
    }
    memberCount += Math.floor(entry.count);

    const [minRange, maxRange] = ROLE_DEFINITIONS[entry.role].engagementRange;
    if (
      !Number.isFinite(minRange) || !Number.isFinite(maxRange) ||
      minRange < 0 || maxRange < 0 || minRange > maxRange
    ) {
      return err({
        code: 'invalid-range',
        message: `Role "${entry.role}" has an invalid engagement range.`,
        field: 'formation',
      });
    }
  }
  if (memberCount <= 0) {
    return err({
      code: 'empty-formation',
      message: 'Formation expands to zero squad members.',
      field: 'formation',
    });
  }

  const scalars: [string, number][] = [
    ['targetForwardAngle', config.targetForwardAngle],
    ['attackDistance', config.attackDistance],
    ['minSeparation', config.minSeparation],
    ['flankWeight', config.flankWeight],
    ['separationWeight', config.separationWeight],
    ['rangeWeight', config.rangeWeight],
  ];
  for (const [field, value] of scalars) {
    if (!Number.isFinite(value)) {
      return err({ code: 'non-finite', message: `"${field}" must be a finite number.`, field });
    }
  }

  if (config.attackDistance < 0) {
    return err({
      code: 'invalid-distance',
      message: 'Attack distance cannot be negative.',
      field: 'attackDistance',
    });
  }
  if (config.minSeparation <= 0) {
    return err({
      code: 'invalid-separation',
      message: 'Minimum separation must be greater than zero.',
      field: 'minSeparation',
    });
  }

  // Recoverable drift: clamp weights into range, coerce a usable integer seed.
  return ok({
    ...config,
    flankWeight: clamp(config.flankWeight, 0, 1),
    separationWeight: clamp(config.separationWeight, 0, 1),
    rangeWeight: clamp(config.rangeWeight, 0, 1),
    seed: Number.isFinite(config.seed) ? Math.trunc(config.seed) : 1,
  });
}

// ── Seeded RNG ───────────────────────────────────────────────────────────────
// The shared xorshift32 helper (see `@/lib/seeded-rng`). The director was authored
// against the legacy 2^32-1 divisor, passed explicitly to keep its output stable.

// ── Scoring Helpers ──────────────────────────────────────────────────────────
// `computeFlankAngle` / `distance` / `ringPoint` / `forwardVector` are the shared
// pure geometry helpers in `./eqs-geometry` — the single source of truth that
// mirrors the C++ UEnvQueryTest_FlankAngle.

/** Preferred flank angle per role. */
function preferredFlankAngle(role: SquadRole): number {
  switch (role) {
    case 'aggressor': return 10;   // Front
    case 'tank': return 0;         // Dead center front
    case 'flanker': return 135;    // Side-to-behind
    case 'ambusher': return 160;   // Behind
    case 'support': return 90;     // Side
  }
}

// ── Position Allocation Engine ───────────────────────────────────────────────

/**
 * Generates candidate positions on an attack ring and scores them
 * with awareness of already-allocated ally positions.
 */
function allocatePosition(
  role: SquadRole,
  config: DirectorConfig,
  allocatedPositions: { x: number; y: number }[],
  rng: () => number,
): { x: number; y: number; score: number; flankAngle: number; dist: number } {
  const roleDef = ROLE_DEFINITIONS[role];
  const { x: fwdX, y: fwdY } = forwardVector(config.targetForwardAngle);

  // Determine distance range for this role. Defensive clamp: even if a role
  // definition ever ships an inverted/negative range, normalize it so the ring
  // math below can never produce NaN/negative distances.
  let [minRange, maxRange] = roleDef.engagementRange;
  if (!Number.isFinite(minRange) || minRange < 0) minRange = 0;
  if (!Number.isFinite(maxRange) || maxRange < minRange) maxRange = minRange;
  const baseDistance = clamp(config.attackDistance, minRange, maxRange);

  // Generate candidate positions on the ring (like UEnvQueryGenerator_AttackPositions)
  const numCandidates = NUM_CANDIDATES;
  const angleStep = (2 * Math.PI) / numCandidates;

  // Add some jitter for variation
  const jitterOffset = rng() * angleStep;

  let bestScore = -Infinity;
  let bestPos = { x: 0, y: 0 };
  let bestFlank = 0;
  let bestDist = baseDistance;

  for (let i = 0; i < numCandidates; i++) {
    const angle = angleStep * i + jitterOffset;

    // Vary distance slightly based on role
    const distJitter = (rng() - 0.5) * (maxRange - minRange) * 0.5;
    const dist = baseDistance + distJitter;

    const { x: px, y: py } = ringPoint(angle, dist);

    // ── Score 1: Flank angle preference ──
    const flankDeg = computeFlankAngle(fwdX, fwdY, px, py);
    const preferred = preferredFlankAngle(role);
    const flankScore = 1 - Math.abs(flankDeg - preferred) / 180;

    // ── Score 2: Ally separation ──
    let sepScore = 1;
    if (allocatedPositions.length > 0) {
      const minDist = Math.min(
        ...allocatedPositions.map(a => distance(px, py, a.x, a.y))
      );
      sepScore = Math.min(minDist / config.minSeparation, 1);
      // Penalize heavily if too close
      if (minDist < config.minSeparation * 0.5) sepScore *= 0.2;
    }

    // ── Score 3: Range preference ──
    const rangeMid = (minRange + maxRange) / 2;
    const rangeScore = rangeMid > 0
      ? 1 - Math.min(Math.abs(dist - rangeMid) / rangeMid, 1)
      : 1;

    // ── Weighted composite ──
    const totalScore =
      flankScore * config.flankWeight +
      sepScore * config.separationWeight +
      rangeScore * config.rangeWeight;

    // Skip any candidate that somehow scored non-finite so a NaN can never win.
    if (!Number.isFinite(totalScore) || !Number.isFinite(px) || !Number.isFinite(py)) continue;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestPos = { x: px, y: py };
      bestFlank = flankDeg;
      bestDist = dist;
    }
  }

  return { ...bestPos, score: bestScore, flankAngle: bestFlank, dist: bestDist };
}

// ── Composed EQS Pipeline ────────────────────────────────────────────────────

function buildComposedPipeline(formation: SquadFormation): ComposedEQSStep[] {
  const uniqueRoles = [...new Set(formation.roles.map(r => r.role))];
  const steps: ComposedEQSStep[] = [
    {
      label: 'TargetActor',
      cppClass: 'UEnvQueryContext_TargetActor',
      kind: 'context',
      description: 'Resolve target actor from blackboard for all squad queries',
    },
    {
      label: 'SquadContext',
      cppClass: 'UEnvQueryContext_SquadAllies',
      kind: 'context',
      description: 'Resolve positions of all squad allies for separation scoring',
    },
    {
      label: 'AttackPositions',
      cppClass: 'UEnvQueryGenerator_AttackPositions',
      kind: 'generator',
      description: `Generate ring candidates per role (${uniqueRoles.join(', ')})`,
    },
    {
      label: 'FlankAngle',
      cppClass: 'UEnvQueryTest_FlankAngle',
      kind: 'test-score',
      description: 'Score by angle from target forward — preferred angle varies per role',
    },
    {
      label: 'AllySeparation',
      cppClass: 'UEnvQueryTest_AllySeparation',
      kind: 'test-score',
      description: 'Score by minimum distance to already-allocated ally positions',
    },
    {
      label: 'PathExists',
      cppClass: 'UEnvQueryTest_PathExists',
      kind: 'test-filter',
      description: 'Filter unreachable positions via synchronous nav path query',
    },
    {
      label: 'Director Allocate',
      cppClass: 'UARPGSquadDirector',
      kind: 'director',
      description: `Sequentially allocate positions by priority: ${uniqueRoles.join(' → ')}`,
    },
    {
      label: 'Formation',
      cppClass: '',
      kind: 'result',
      description: `${formation.size} members positioned in ${formation.name} formation`,
    },
  ];
  return steps;
}

// ── Main Simulation ──────────────────────────────────────────────────────────

/**
 * Run the AI Director squad allocation simulation.
 * Allocates positions in priority order (highest priority roles first)
 * so that early allocations influence later ones — producing coordination.
 *
 * Validates the config at the engine boundary and returns a typed
 * {@link Result}: an invalid config yields a {@link SquadConfigError} instead of
 * silently emitting NaN positions that break the downstream SVG render.
 */
export function runSquadSimulation(
  config: DirectorConfig,
): Result<DirectorResult, SquadConfigError> {
  const validated = validateDirectorConfig(config);
  if (!validated.ok) return validated;
  config = validated.data;

  const rng = createXorShift32RNG(config.seed, 0xFFFFFFFF);

  // Expand formation roles into individual members, sorted by priority (descending)
  const memberSpecs: { role: SquadRole; index: number }[] = [];
  for (const { role, count } of config.formation.roles) {
    for (let i = 0; i < count; i++) {
      memberSpecs.push({ role, index: memberSpecs.length });
    }
  }
  memberSpecs.sort((a, b) =>
    ROLE_DEFINITIONS[b.role].priority - ROLE_DEFINITIONS[a.role].priority
  );

  const allocatedPositions: { x: number; y: number }[] = [];
  const members: SquadMember[] = [];

  for (const spec of memberSpecs) {
    const result = allocatePosition(spec.role, config, allocatedPositions, rng);
    allocatedPositions.push({ x: result.x, y: result.y });

    const roleDef = ROLE_DEFINITIONS[spec.role];
    const roleCount = members.filter(m => m.role === spec.role).length;

    members.push({
      id: `${spec.role}-${roleCount}`,
      label: `${roleDef.label} ${roleCount + 1}`,
      role: spec.role,
      position: { x: result.x, y: result.y },
      flankAngle: result.flankAngle,
      distance: result.dist,
      score: result.score,
    });
  }

  // Compute formation metrics
  const angles = members.map(m => {
    const a = Math.atan2(m.position.y, m.position.x);
    return ((a * 180 / Math.PI) + 360) % 360;
  }).sort((a, b) => a - b);

  // Angular coverage: total arc covered by members
  let angularCoverage = 0;
  if (angles.length >= 2) {
    let maxGap = 0;
    for (let i = 1; i < angles.length; i++) {
      maxGap = Math.max(maxGap, angles[i] - angles[i - 1]);
    }
    maxGap = Math.max(maxGap, 360 - angles[angles.length - 1] + angles[0]);
    angularCoverage = 360 - maxGap;
  }

  // Average separation
  let totalSep = 0;
  let sepCount = 0;
  let hasCollisions = false;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const d = distance(
        members[i].position.x, members[i].position.y,
        members[j].position.x, members[j].position.y,
      );
      totalSep += d;
      sepCount++;
      if (d < config.minSeparation) hasCollisions = true;
    }
  }
  const avgSeparation = sepCount > 0 ? totalSep / sepCount : 0;

  // Formation quality: weighted average of member scores
  const formationScore = members.length > 0
    ? members.reduce((sum, m) => sum + m.score, 0) / members.length
    : 0;

  return ok({
    members,
    formationScore,
    angularCoverage,
    avgSeparation,
    hasCollisions,
    composedPipeline: buildComposedPipeline(config.formation),
  });
}
