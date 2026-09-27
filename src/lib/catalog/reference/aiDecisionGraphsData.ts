/** Hand-authored control-flow structure for the engine-derived Diablo I AI graphs. */

export type AiGraphActionMode =
  | 'Walk'
  | 'MeleeAttack'
  | 'RangedAttack'
  | 'SpecialMeleeAttack'
  | 'SpecialRangedAttack'
  | 'SpecialStand'
  | 'Delay'
  | 'Stand-idle'
  | 'FadeIn'
  | 'FadeOut'
  | 'Charge'
  | 'Heal'
  | 'Death';

export type AiGraphActionCategory = 'attack' | 'approach' | 'wait' | 'special';
export type AiGraphBandRole = 'adjacent' | 'range' | 'other';

export interface AiGraphRollRef {
  index: number;
  routine?: string;
}

export interface AiGraphActionTree {
  kind: 'action';
  mode: Exclude<AiGraphActionMode, 'Walk'>;
  category: AiGraphActionCategory;
  pause?: AiGraphRollRef;
  note?: string;
  immediateReturn?: AiGraphImmediateReturn;
}

export type AiGraphWalkHelper = 'Walk' | 'RandomWalk' | 'RandomWalk2' | 'RoundWalk' | 'GolemFallback';
export type AiGraphWalkFailureOutcome = 'stay-stand' | 'delay' | 'fall-through';

export interface AiGraphWalkFailure {
  outcome: AiGraphWalkFailureOutcome;
  detail: string;
}

export interface AiGraphWalkAttemptData {
  helper: AiGraphWalkHelper;
  directionOrder: readonly string[];
  failure: AiGraphWalkFailure;
  sourceRefs: readonly string[];
}

export interface AiGraphWalkAttemptTree {
  kind: 'walk-attempt';
  attempt: string;
  category: Extract<AiGraphActionCategory, 'approach' | 'special'>;
  note?: string;
}

export interface AiGraphImmediateReturn {
  condition: string;
  outcome: string;
  sourceRefs: readonly string[];
}

export interface AiGraphRollTree {
  kind: 'roll';
  roll: AiGraphRollRef;
  success: AiGraphTree;
  failure: AiGraphTree;
}

export interface AiGraphRollBandsTree {
  kind: 'roll-bands';
  bands: readonly { roll: AiGraphRollRef; result: AiGraphTree }[];
  remainder: AiGraphTree;
}

export interface AiGraphTestTree {
  kind: 'test';
  test: 'condition' | 'previous-mode';
  label: string;
  branches: readonly { condition: string; result: AiGraphTree }[];
}

export type AiGraphTree = AiGraphActionTree | AiGraphWalkAttemptTree | AiGraphRollTree | AiGraphRollBandsTree | AiGraphTestTree;

export interface AiGraphScenarioData {
  context: string;
  tree: AiGraphTree;
  primary?: boolean;
}

export interface AiGraphDistanceBandData {
  /** Index into the routine's distances array. Omitted for an engine branch not represented there. */
  distance?: number;
  /** Delegating routines may inherit the named distance test from this routine. */
  distanceRoutine?: string;
  label?: string;
  role: AiGraphBandRole;
  scenarioTest?: 'condition' | 'previous-mode';
  scenarios: readonly AiGraphScenarioData[];
}

export interface AiDecisionGraphData {
  sourceRefs: readonly string[];
  bands: readonly AiGraphDistanceBandData[];
  walkAttempts?: Readonly<Record<string, AiGraphWalkAttemptData>>;
  findings?: readonly string[];
}

const ref = (index: number, routine?: string): AiGraphRollRef => ({ index, ...(routine ? { routine } : {}) });
const action = (mode: Exclude<AiGraphActionMode, 'Walk'>, category: AiGraphActionCategory, pause?: AiGraphRollRef, note?: string, immediateReturn?: AiGraphImmediateReturn): AiGraphActionTree => ({
  kind: 'action', mode, category, ...(pause ? { pause } : {}), ...(note ? { note } : {}), ...(immediateReturn ? { immediateReturn } : {}),
});
const walkAttempt = (attempt: string, category: AiGraphWalkAttemptTree['category'], note?: string): AiGraphWalkAttemptTree => ({
  kind: 'walk-attempt', attempt, category, ...(note ? { note } : {}),
});
const roll = (index: number, success: AiGraphTree, failure: AiGraphTree, routine?: string): AiGraphRollTree => ({
  kind: 'roll', roll: ref(index, routine), success, failure,
});
const rollBands = (bands: readonly [number, AiGraphTree][], remainder: AiGraphTree, routine?: string): AiGraphRollBandsTree => ({
  kind: 'roll-bands',
  bands: bands.map(([index, result]) => ({ roll: ref(index, routine), result })),
  remainder,
});
const test = (kind: AiGraphTestTree['test'], label: string, branches: readonly [string, AiGraphTree][]): AiGraphTestTree => ({
  kind: 'test', label, test: kind, branches: branches.map(([condition, result]) => ({ condition, result })),
});

const idle = action('Stand-idle', 'wait');
const approach = walkAttempt('approach', 'approach');
const approachDelay = walkAttempt('approach-delay', 'approach');
const circle = walkAttempt('circle', 'special');
const corpseWalk = walkAttempt('corpse', 'special');
const directFacingWalk = walkAttempt('direct-facing', 'special');
const directRandomWalk = walkAttempt('direct-random', 'special');
const directRetreat = walkAttempt('direct-retreat', 'special');
const driftWalk = walkAttempt('drift', 'approach');
const pathWalk = walkAttempt('path', 'approach');
const fallbackWalk = walkAttempt('fallback', 'approach');
const retreat = walkAttempt('retreat', 'special');
const retreatAway = walkAttempt('retreat-away', 'special');
const retreatSide = walkAttempt('retreat-side', 'special');
const melee = action('MeleeAttack', 'attack');
const ranged = action('RangedAttack', 'attack');
const specialMelee = action('SpecialMeleeAttack', 'special');
const specialRanged = action('SpecialRangedAttack', 'special');

const skeletonRange = (routine = 'SkeletonMelee', movement: AiGraphTree = approach): AiGraphTree => roll(0, movement, action('Delay', 'wait', ref(0, routine)), routine);
const skeletonAdjacent = (routine = 'SkeletonMelee'): AiGraphTree => roll(1, melee, action('Delay', 'wait', ref(1, routine)), routine);

const STAY_STAND = (detail: string): AiGraphWalkFailure => ({ outcome: 'stay-stand', detail });
const DELAY = (detail: string): AiGraphWalkFailure => ({ outcome: 'delay', detail });
const FALL_THROUGH = (detail: string): AiGraphWalkFailure => ({ outcome: 'fall-through', detail });

const randomWalkAttempt = (callSource: string, failure: AiGraphWalkFailure, preferred = 'preferred direction'): AiGraphWalkAttemptData => ({
  helper: 'RandomWalk',
  directionOrder: [
    preferred,
    'first preferred ±45° side selected by a fair coin',
    'the other preferred ±45° side',
    'first preferred ±90° side selected by an independent fair coin',
    'the other preferred ±90° side',
  ],
  failure,
  sourceRefs: ['.reference/devilutionX/Source/monster.cpp:1731-1751', callSource],
});

const directWalkAttempt = (callSource: string, failure: AiGraphWalkFailure, preferred: string): AiGraphWalkAttemptData => ({
  helper: 'Walk',
  directionOrder: [preferred],
  failure,
  sourceRefs: ['.reference/devilutionX/Source/monster.cpp:4144-4154', callSource],
});

const roundWalkAttempt = (callSource: string, failure: AiGraphWalkFailure): AiGraphWalkAttemptData => ({
  helper: 'RoundWalk',
  directionOrder: [
    'chosen-side 90°',
    'chosen-side 45°',
    'straight',
    'opposite-side 90°',
    'first ±45° direction from opposite-side 90°, selected by a fair coin',
    'the other ±45° direction from opposite-side 90°',
    'first ±90° direction from opposite-side 90°, selected by an independent fair coin',
    'the other ±90° direction from opposite-side 90°',
  ],
  failure,
  sourceRefs: ['.reference/devilutionX/Source/monster.cpp:1835-1857', callSource],
});

const randomWalk2Attempt = (callSource: string, failure: AiGraphWalkFailure): AiGraphWalkAttemptData => ({
  helper: 'RandomWalk2',
  directionOrder: [
    'pattern-selected direction',
    'current facing',
    'first current-facing ±45° side selected by a fair coin',
    'the other current-facing ±45° side',
  ],
  failure,
  sourceRefs: [
    '.reference/devilutionX/Source/monster.cpp:4144-4154',
    '.reference/devilutionX/Source/monster.cpp:1754-1769',
    callSource,
  ],
});

const zeroDelayContinues = (outcome: string): AiGraphImmediateReturn => ({
  condition: 'the generated delay is zero ticks',
  outcome,
  sourceRefs: ['.reference/devilutionX/Source/monster.cpp:755-758', '.reference/devilutionX/Source/monster.cpp:1987-1993'],
});

const rangedAvoidanceBands = (sourceRef: string): AiDecisionGraphData => ({
  sourceRefs: [sourceRef, '.reference/devilutionX/Source/monster.cpp:1940'],
  walkAttempts: {
    approach: randomWalkAttempt(
      '.reference/devilutionX/Source/monster.cpp:2051-2065',
      DELAY('No step starts; the still-Stand guard starts a 5-14 tick Delay.'),
      'toward the last known target position',
    ),
    circle: roundWalkAttempt(
      '.reference/devilutionX/Source/monster.cpp:2033-2041',
      DELAY('No circle step starts; the routine reaches its still-Stand guard and starts a 5-14 tick Delay.'),
    ),
  },
  bands: [
    {
      distance: 0,
      role: 'adjacent',
      scenarioTest: 'condition',
      scenarios: [{
        context: 'Normal goal with a clear line', primary: true,
        tree: rollBands([[3, specialRanged], [4, melee]], action('Delay', 'wait', ref(4))),
      }, {
        context: 'Normal goal with a blocked line',
        tree: roll(5, melee, action('Delay', 'wait', ref(5))),
      }],
    },
    {
      label: 'near range — normal goal',
      role: 'range',
      scenarios: [{ context: 'Clear line', primary: true, tree: roll(3, specialRanged, approach) }],
    },
    {
      distance: 1,
      role: 'range',
      scenarioTest: 'condition',
      scenarios: [
        { context: 'Normal goal with a clear line', primary: true, tree: roll(2, specialRanged, approach) },
        { context: 'Move goal', tree: roll(1, specialRanged, circle) },
        { context: 'Circle-entry test', tree: roll(0, circle, roll(2, specialRanged, approach)) },
      ],
    },
  ],
});

const sharedRangedBands = (special = false, suppressPostShotDelay = false): readonly AiGraphDistanceBandData[] => {
  const shot = special ? specialRanged : ranged;
  const postShotDelay = action('Delay', 'wait', ref(0), undefined, zeroDelayContinues(
    'AiDelay returns immediately, so the routine continues to its retreat and line-of-sight/fire gates in the same AI call.',
  ));
  return [
    {
      distance: 0,
      role: 'adjacent',
      scenarioTest: 'previous-mode',
      scenarios: [
        ...(!suppressPostShotDelay ? [{ context: 'Previous mode was RangedAttack', tree: postShotDelay }] : []),
        { context: `${suppressPostShotDelay ? 'Previous mode was SpecialRangedAttack' : 'Previous mode was not RangedAttack'}; line clear`, primary: true, tree: roll(1, retreat, shot) },
        { context: `${suppressPostShotDelay ? 'Previous mode was SpecialRangedAttack' : 'Previous mode was not RangedAttack'}; line blocked`, tree: roll(1, retreat, idle) },
      ],
    },
    {
      distance: 1,
      role: 'range',
      scenarioTest: 'condition',
      scenarios: [
        ...(!suppressPostShotDelay ? [{ context: 'Previous mode was RangedAttack', tree: postShotDelay }] : []),
        { context: 'Fully alert or targeting a monster; line clear', primary: true, tree: shot },
        { context: 'Fully alert or targeting a monster; line blocked', tree: idle },
        { context: 'Partially alert', tree: approach },
      ],
    },
  ];
};

const sharedRangedWalkAttempts = (): Readonly<Record<string, AiGraphWalkAttemptData>> => ({
  approach: randomWalkAttempt(
    '.reference/devilutionX/Source/monster.cpp:2007-2010',
    STAY_STAND('No approach step starts; the partially alert branch ends this AI call in Stand.'),
    'toward the last known target position',
  ),
  retreat: randomWalkAttempt(
    '.reference/devilutionX/Source/monster.cpp:1989-1999',
    FALL_THROUGH('No retreat step starts; mode remains Stand and the routine immediately tests line of sight, then may fire in the same AI call.'),
    'directly away from the target',
  ),
});

const goatBands = (routine = 'GoatMelee'): readonly AiGraphDistanceBandData[] => [
  {
    distance: 0,
    distanceRoutine: 'GoatMelee',
    role: 'adjacent',
    scenarioTest: 'condition',
    scenarios: [
      { context: 'Healthy, or wounded fair-bit normal branch', primary: true, tree: roll(3, melee, idle, routine) },
      { context: 'Wounded fair-bit special branch', tree: roll(3, specialMelee, idle, routine) },
    ],
  },
  {
    distance: 1,
    distanceRoutine: 'GoatMelee',
    role: 'range',
    scenarioTest: 'previous-mode',
    scenarios: [
      { context: 'Standing more than the settle interval', primary: true, tree: roll(1, approach, idle, routine) },
      { context: 'Immediately after movement', tree: roll(2, approach, idle, routine) },
    ],
  },
  {
    distance: 2,
    distanceRoutine: 'GoatMelee',
    role: 'range',
    scenarios: [{ context: 'Fully alert in the target room', tree: roll(0, circle, roll(1, approach, idle, routine)) }],
  },
];

const goatWalkAttempts = (): Readonly<Record<string, AiGraphWalkAttemptData>> => ({
  approach: randomWalkAttempt(
    '.reference/devilutionX/Source/monster.cpp:1920-1927',
    STAY_STAND('No approach step starts; the routine finishes this Stand decision without starting a mode.'),
    'toward the last known target position',
  ),
  circle: roundWalkAttempt(
    '.reference/devilutionX/Source/monster.cpp:1910-1915',
    DELAY('No circle step starts; the routine immediately starts a 10-19 tick Delay.'),
  ),
});

const counselorBands = (ignoreDelay = false): readonly AiGraphDistanceBandData[] => [
  {
    distance: 0,
    distanceRoutine: 'Counselor',
    role: 'adjacent',
    scenarioTest: 'condition',
    scenarios: [
      { context: 'Wounded', tree: action('FadeOut', 'special') },
      { context: 'Healthy immediately after Delay', tree: action('RangedAttack', 'special') },
      {
        context: 'Healthy and not immediately after Delay',
        primary: true,
        tree: roll(2, action('RangedAttack', 'special'), ignoreDelay ? idle : action('Delay', 'wait', ref(2, 'Counselor')), 'Counselor'),
      },
    ],
  },
  {
    distance: 1,
    distanceRoutine: 'Counselor',
    role: 'range',
    scenarioTest: 'condition',
    scenarios: [
      {
        context: 'Normal goal with line test', primary: true,
        tree: roll(0, ranged, roll(1, action('FadeOut', 'special'), ignoreDelay ? idle : action('Delay', 'wait', ref(1, 'Counselor')), 'Counselor'), 'Counselor'),
      },
      { context: 'Move goal', tree: circle },
      { context: 'Retreat goal', tree: retreat },
    ],
  },
];

const counselorWalkAttempts = (ignoreDelay = false): Readonly<Record<string, AiGraphWalkAttemptData>> => ({
  circle: roundWalkAttempt(
    '.reference/devilutionX/Source/monster.cpp:2741-2748',
    ignoreDelay
      ? STAY_STAND('No circle step starts; the final AiDelay call returns immediately for Lazarus, so the AI call ends in Stand.')
      : DELAY('No circle step starts; the final still-Stand guard starts a 5-14 tick Delay.'),
  ),
  retreat: randomWalkAttempt(
    '.reference/devilutionX/Source/monster.cpp:2734-2740',
    ignoreDelay
      ? STAY_STAND('No retreat step starts; the final AiDelay call returns immediately for Lazarus, so the AI call ends in Stand.')
      : DELAY('No retreat step starts; the final still-Stand guard starts a 5-14 tick Delay.'),
    'directly away from the target',
  ),
});

export const D1_AI_DECISION_GRAPHS_DATA: Record<string, AiDecisionGraphData> = {
  Zombie: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2069'],
    walkAttempts: {
      approach: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2088-2090',
        STAY_STAND('No fallback direction is legal; the routine remains in Stand and finishes the AI call.'),
        'toward the target',
      ),
      'direct-facing': directWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2082-2089',
        STAY_STAND('The selected single direction is blocked; the routine remains in Stand and finishes the AI call.'),
        'current facing direction',
      ),
      'direct-random': directWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2082-2089',
        STAY_STAND('The selected single direction is blocked; the routine remains in Stand and finishes the AI call.'),
        'one uniformly random direction',
      ),
    },
    bands: [
      { distance: 0, role: 'adjacent', scenarios: [{ context: 'Visible tile', primary: true, tree: roll(0, melee, idle) }] },
      { distance: 1, role: 'range', scenarios: [{ context: 'Visible tile', primary: true, tree: roll(0, approach, idle) }] },
      { distance: 2, role: 'range', scenarios: [{ context: 'Visible tile', tree: roll(0, roll(1, directRandomWalk, directFacingWalk), idle) }] },
    ],
  },
  Fat: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2099'],
    walkAttempts: {
      approach: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2108-2114',
        STAY_STAND('No fallback direction is legal; the routine remains in Stand and finishes the AI call.'),
        'toward the target',
      ),
    },
    bands: [
      { distance: 0, role: 'adjacent', scenarios: [{ context: 'Alert', primary: true, tree: rollBands([[2, melee], [3, specialMelee]], idle) }] },
      { distance: 1, role: 'range', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Standing more than the settle interval', primary: true, tree: roll(0, approach, idle) },
        { context: 'Immediately after movement', tree: roll(1, approach, idle) },
      ] },
    ],
  },
  SkeletonMelee: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2124', '.reference/devilutionX/Source/monster.cpp:755'],
    walkAttempts: {
      approach: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2132-2136',
        STAY_STAND('No fallback direction is legal; the forced or rolled movement attempt ends this AI call in Stand.'),
        'toward the last known target position',
      ),
    },
    bands: [
      { distance: 0, role: 'adjacent', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Previous mode was Delay', tree: melee },
        { context: 'Previous mode was not Delay', primary: true, tree: skeletonAdjacent() },
      ] },
      { distance: 1, role: 'range', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Previous mode was Delay', tree: approach },
        { context: 'Previous mode was not Delay', primary: true, tree: skeletonRange() },
      ] },
    ],
  },
  SkeletonRanged: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2149'],
    walkAttempts: {
      'direct-retreat': directWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2161-2174',
        FALL_THROUGH('The directly-away tile is blocked; walking remains false and the independent shot roll runs in the same AI call.'),
        'directly away from the target',
      ),
    },
    bands: [
      { distance: 0, role: 'adjacent', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Settled; line clear', primary: true, tree: roll(0, directRetreat, roll(2, ranged, idle)) },
        { context: 'After movement; line clear', tree: roll(1, directRetreat, roll(2, ranged, idle)) },
        { context: 'Settled; line blocked', tree: roll(0, directRetreat, idle) },
        { context: 'After movement; line blocked', tree: roll(1, directRetreat, idle) },
      ] },
      { distance: 1, role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Outside retreat band; line clear', tree: roll(2, ranged, idle) },
        { context: 'Outside retreat band; line blocked', tree: idle },
      ] },
    ],
  },
  Scavenger: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2180', '.reference/devilutionX/Source/monster.cpp:2202', '.reference/devilutionX/Source/monster.cpp:2124'],
    walkAttempts: {
      approach: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2132-2136',
        STAY_STAND('The inherited Skeleton movement attempt finds no legal direction and ends in Stand.'),
        'toward the last known target position',
      ),
      corpse: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2243-2253',
        FALL_THROUGH('No step toward the remembered corpse starts; mode remains Stand and Scavenger immediately delegates to SkeletonAi in the same AI call.'),
        'toward the remembered corpse',
      ),
    },
    bands: [
      { distance: 0, role: 'other', scenarioTest: 'condition', scenarios: [
        { context: 'Healing while standing on a corpse', tree: specialMelee },
        { context: 'Healing with a remembered corpse', tree: corpseWalk },
        { context: 'Healing search has no remembered corpse', tree: roll(1, test('condition', 'ascending scan result', [['corpse found', corpseWalk], ['no corpse found', idle]]), idle) },
      ] },
      { distance: 1, role: 'range', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Healing did not start an action; previous mode was Delay', tree: approach },
        { context: 'Healing did not start an action; previous mode was not Delay', primary: true, tree: skeletonRange() },
      ] },
      { label: 'inherited adjacent melee split', role: 'adjacent', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Previous mode was Delay', tree: melee },
        { context: 'Previous mode was not Delay', primary: true, tree: skeletonAdjacent() },
      ] },
    ],
  },
  Rhino: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2256'],
    walkAttempts: {
      approach: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2293-2303',
        STAY_STAND('No approach direction is legal; the routine remains in Stand and finishes the AI call.'),
        'toward the last known target position',
      ),
      circle: roundWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2273-2278',
        DELAY('No circle direction is legal; the routine immediately starts a 10-19 tick Delay.'),
      ),
    },
    bands: [
      { distance: 0, role: 'adjacent', scenarios: [{ context: 'Normal goal', primary: true, tree: roll(4, melee, idle) }] },
      { distance: 1, role: 'range', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Immediately after movement', tree: roll(2, approach, action('Delay', 'wait', ref(2))) },
        { context: 'Otherwise', primary: true, tree: roll(3, approach, action('Delay', 'wait', ref(3))) },
      ] },
      { distance: 2, role: 'range', scenarios: [{ context: 'Not already circling', tree: roll(0, circle, roll(1, action('Charge', 'special'), roll(3, approach, action('Delay', 'wait', ref(3))))) }] },
    ],
  },
  GoatMelee: { sourceRefs: ['.reference/devilutionX/Source/monster.cpp:1893'], walkAttempts: goatWalkAttempts(), bands: goatBands() },
  GoatRanged: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:1976', '.reference/devilutionX/Source/monster.cpp:1940'],
    walkAttempts: sharedRangedWalkAttempts(),
    bands: sharedRangedBands(),
  },
  Fallen: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2314', '.reference/devilutionX/Source/monster.cpp:2124'],
    walkAttempts: {
      approach: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2364-2370',
        STAY_STAND('No direction toward the target is legal; the Attack or inherited Skeleton branch ends this AI call in Stand.'),
        'toward the target or last known target position',
      ),
      retreat: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2326-2364',
        STAY_STAND('No retreat direction is legal; the blocked attempt still consumes one Retreat counter call and the routine ends in Stand.'),
        'stored retreat direction',
      ),
    },
    bands: [
      { label: 'adjacent target', role: 'adjacent', scenarioTest: 'condition', scenarios: [
        { context: 'Attack goal', tree: melee },
        { context: 'Normal goal; previous mode was not Delay', primary: true, tree: skeletonAdjacent() },
        { context: 'Last standing-animation frame', tree: roll(0, action('SpecialStand', 'special'), idle) },
      ] },
      { label: 'target at range', role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Attack goal', tree: approach },
        { context: 'Retreat goal', tree: retreat },
        { context: 'Normal goal; previous mode was not Delay', primary: true, tree: skeletonRange() },
      ] },
    ],
  },
  Magma: rangedAvoidanceBands('.reference/devilutionX/Source/monster.cpp:2013'),
  SkeletonKing: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2374'],
    walkAttempts: {
      approach: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2413-2421',
        STAY_STAND('No approach direction is legal; the routine remains in Stand and finishes the AI call.'),
        'toward the last known target position',
      ),
      circle: roundWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2391-2396',
        DELAY('No circle direction is legal; the routine immediately starts a 10-19 tick Delay.'),
      ),
    },
    bands: [
      { distance: 0, role: 'adjacent', scenarioTest: 'condition', scenarios: [
        { context: 'Summoning disabled', primary: true, tree: roll(3, melee, idle) },
        { context: 'Multiplayer quests disabled; summon resources available', tree: roll(1, action('SpecialStand', 'special'), roll(3, melee, idle)) },
        { context: 'Multiplayer quests disabled; summon resources unavailable', tree: roll(1, idle, roll(3, melee, idle)) },
      ] },
      { label: 'approach range below circle entry', role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Summoning disabled', primary: true, tree: roll(2, approach, action('Delay', 'wait', ref(2))) },
        { context: 'Multiplayer quests disabled; summon resources available', tree: roll(1, action('SpecialStand', 'special'), roll(2, approach, action('Delay', 'wait', ref(2)))) },
        { context: 'Multiplayer quests disabled; summon resources unavailable', tree: roll(1, idle, roll(2, approach, action('Delay', 'wait', ref(2)))) },
      ] },
      { distance: 1, role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Fully alert in the target room; summon resources available', tree: roll(0, circle, roll(1, action('SpecialStand', 'special'), roll(2, approach, action('Delay', 'wait', ref(2))))) },
        { context: 'Fully alert in the target room; summon resources unavailable', tree: roll(0, circle, roll(1, idle, roll(2, approach, action('Delay', 'wait', ref(2))))) },
      ] },
    ],
  },
  Bat: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2432'],
    walkAttempts: {
      approach: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2461-2467',
        STAY_STAND('No ordinary approach direction is legal; the routine remains in Stand and finishes the AI call.'),
        'toward the last known target position',
      ),
      'retreat-away': randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2441-2449',
        STAY_STAND('No retreat direction is legal; the blocked first attempt still advances the two-call Retreat goal before returning in Stand.'),
        'directly away from the target',
      ),
      'retreat-side': randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2441-2449',
        STAY_STAND('No retreat direction is legal; the blocked second attempt still finishes the Retreat goal before returning in Stand.'),
        'a randomly selected left or right side of the target direction',
      ),
    },
    bands: [
      { distance: 0, role: 'adjacent', scenarios: [{ context: 'Normal goal', primary: true, tree: roll(3, melee, idle) }] },
      { label: 'ordinary approach range', role: 'range', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Standing more than the settle interval', primary: true, tree: roll(1, approach, idle) },
        { context: 'Immediately after movement', tree: roll(2, approach, idle) },
      ] },
      { distance: 1, role: 'range', scenarios: [{ context: 'Gloom with clear route', tree: roll(0, action('Charge', 'special'), roll(1, approach, idle)) }] },
      { label: 'post-melee retreat', role: 'other', scenarioTest: 'condition', scenarios: [
        { context: 'First retreat AI call', tree: retreatAway },
        { context: 'Second retreat AI call', tree: roll(4, retreatSide, retreatSide) },
      ] },
    ],
  },
  Gargoyle: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2480', '.reference/devilutionX/Source/monster.cpp:1893', '.reference/devilutionX/Source/monster.cpp:1051'],
    walkAttempts: {
      ...goatWalkAttempts(),
      retreat: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2496-2506',
        FALL_THROUGH('No retreat direction is legal; the routine cancels Retreat and immediately runs AiAvoidance in the same AI call.'),
        'directly away from the target',
      ),
    },
    bands: [
      { distance: 0, role: 'other', scenarioTest: 'condition', scenarios: [
        { context: 'Statue permission still set', tree: idle },
        { context: 'Wounded retreat reached clearance', tree: action('Heal', 'special') },
        { context: 'Wounded and below clearance', tree: retreat },
      ] },
      ...goatBands(),
    ],
  },
  Butcher: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2509'],
    walkAttempts: {
      approach: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2515-2523',
        STAY_STAND('No approach direction is legal; the routine remains in Stand and finishes the AI call.'),
        'toward the last known target position',
      ),
    },
    bands: [
      { distance: 0, role: 'adjacent', scenarios: [{ context: 'Alert', primary: true, tree: melee }] },
      { distance: 1, role: 'range', scenarios: [{ context: 'Alert', primary: true, tree: approach }] },
    ],
  },
  Succubus: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:1976', '.reference/devilutionX/Source/monster.cpp:1940'],
    walkAttempts: sharedRangedWalkAttempts(),
    bands: sharedRangedBands(),
  },
  Sneak: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2526'],
    walkAttempts: {
      approach: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2560-2575',
        FALL_THROUGH('No approach step starts; the routine reaches its still-Stand range/melee gate, which idles at range and can attack only when adjacent.'),
        'toward the target',
      ),
      retreat: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2542-2575',
        FALL_THROUGH('No retreat step starts; the blocked attempt still increments the Retreat counter and reaches the same-call still-Stand range/melee gate.'),
        'directly away, or a randomly selected lateral side for Unseen',
      ),
    },
    bands: [
      { label: 'adjacent while visible', role: 'adjacent', scenarios: [{ context: 'Normal goal', primary: true, tree: roll(2, melee, idle) }] },
      { distance: 0, role: 'other', scenarios: [{ context: 'Hidden', tree: action('FadeIn', 'special') }] },
      { distance: 1, role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Visible', tree: action('FadeOut', 'special') },
        { context: 'Retreat goal', tree: retreat },
        { context: 'Normal goal after settling', primary: true, tree: roll(0, approach, idle) },
        { context: 'Normal goal immediately after movement', tree: roll(1, approach, idle) },
      ] },
      { distance: 2, role: 'range', scenarios: [{ context: 'Retreat goal resets to Normal', tree: roll(0, approach, idle) }] },
    ],
  },
  Storm: rangedAvoidanceBands('.reference/devilutionX/Source/monster.cpp:2013'),
  FireMan: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:3108', '.reference/devilutionX/Source/monster.cpp:4323'],
    bands: [{ label: 'null dispatch entry', role: 'other', scenarios: [{ context: 'Ordinary processing has no callable routine', primary: true, tree: idle }] }],
  },
  Gharbad: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2578', '.reference/devilutionX/Source/monster.cpp:1893'],
    walkAttempts: goatWalkAttempts(),
    bands: [
      { label: 'quest-gated', role: 'other', scenarios: [{ context: 'Talking or Inquiring goal', tree: idle }] },
      ...goatBands('GoatMelee'),
    ],
  },
  Acid: rangedAvoidanceBands('.reference/devilutionX/Source/monster.cpp:2013'),
  AcidUnique: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:1976', '.reference/devilutionX/Source/monster.cpp:1996'],
    walkAttempts: sharedRangedWalkAttempts(),
    bands: sharedRangedBands(true, true),
  },
  Golem: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:4157'],
    walkAttempts: {
      path: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:1815-1827',
        STAY_STAND('FindPath returned a route but RandomWalk found no legal first-step fallback; AiPlanWalk still returns true, so Golem returns from this AI call in Stand.'),
        'the first pathfinding direction',
      ),
      fallback: {
        helper: 'GolemFallback',
        directionOrder: [
          'owner facing direction',
          'first owner-facing ±45° side selected by a fair coin',
          'the other owner-facing ±45° side',
          'first owner-facing ±90° side selected by an independent fair coin',
          'the other owner-facing ±90° side',
          'golem facing followed by seven clockwise directions',
        ],
        failure: STAY_STAND('Every RandomWalk and full-eight-direction candidate is blocked; the routine finishes in Stand.'),
        sourceRefs: [
          '.reference/devilutionX/Source/monster.cpp:1731-1751',
          '.reference/devilutionX/Source/monster.cpp:4144-4154',
          '.reference/devilutionX/Source/monster.cpp:4199-4216',
        ],
      },
    },
    bands: [
      { distance: 0, role: 'adjacent', scenarios: [{ context: 'Monster target in the attack box', primary: true, tree: melee }] },
      { label: 'target outside attack box', role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Pathfinding finds a route', primary: true, tree: pathWalk },
        { context: 'Pathfinding does not pre-empt the owner-facing fallback', tree: fallbackWalk },
      ] },
    ],
  },
  Zhar: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2786', '.reference/devilutionX/Source/monster.cpp:2724'],
    walkAttempts: counselorWalkAttempts(),
    bands: [{ label: 'quest-gated', role: 'other', scenarios: [{ context: 'Talking or Inquiring goal', tree: idle }] }, ...counselorBands()],
  },
  Snotspill: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2630', '.reference/devilutionX/Source/monster.cpp:2314'],
    walkAttempts: {
      approach: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2364-2370',
        STAY_STAND('No inherited Fallen/Skeleton approach direction is legal; the delegated routine ends in Stand.'),
        'toward the target or last known target position',
      ),
    },
    bands: [
      { label: 'quest/visibility gate', role: 'other', scenarioTest: 'condition', scenarios: [
        { context: 'Banner quest has not released combat', tree: idle },
        { context: 'Tile is hidden', tree: idle },
      ] },
      { label: 'adjacent target while visible after release', role: 'adjacent', scenarioTest: 'condition', scenarios: [
        { context: 'Attack goal', tree: melee },
        { context: 'Normal goal; previous mode was Delay', tree: melee },
        { context: 'Normal goal; previous mode was not Delay', primary: true, tree: skeletonAdjacent() },
        { context: 'Last standing-animation frame', tree: roll(0, action('SpecialStand', 'special'), idle, 'Fallen') },
      ] },
      { label: 'target at range while visible after release', role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Attack goal', tree: approach },
        { context: 'Normal goal; previous mode was Delay', tree: approach },
        { context: 'Normal goal; previous mode was not Delay', primary: true, tree: skeletonRange() },
        { context: 'Last standing-animation frame', tree: roll(0, action('SpecialStand', 'special'), idle, 'Fallen') },
      ] },
    ],
  },
  Snake: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2669'],
    walkAttempts: {
      drift: randomWalk2Attempt(
        '.reference/devilutionX/Source/monster.cpp:2684-2708',
        STAY_STAND('The pattern-selected step and the straight/±45° fallbacks are all blocked; the routine remains in Stand.'),
      ),
    },
    bands: [
      { distance: 0, role: 'adjacent', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Previous mode was Delay or Charge', tree: melee },
        { context: 'Previous mode was neither Delay nor Charge', primary: true, tree: roll(1, melee, action('Delay', 'wait', ref(1))) },
      ] },
      { distance: 1, role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Clear route and previous mode was not Charge', tree: action('Charge', 'special') },
        { context: 'Charge ineligible; previous mode was Delay', tree: driftWalk },
        { context: 'Charge ineligible; previous mode was not Delay', primary: true, tree: roll(0, driftWalk, action('Delay', 'wait', ref(0))) },
      ] },
      { label: 'range beyond charge distance', role: 'range', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Previous mode was Delay', tree: driftWalk },
        { context: 'Previous mode was not Delay', tree: roll(0, driftWalk, action('Delay', 'wait', ref(0))) },
      ] },
    ],
  },
  Counselor: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2724'],
    walkAttempts: counselorWalkAttempts(),
    bands: counselorBands(),
  },
  Mega: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2818', '.reference/devilutionX/Source/monster.cpp:2124'],
    walkAttempts: {
      approach: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2132-2136',
        STAY_STAND('At five or more tiles, the inherited Skeleton approach finds no legal direction and returns in Stand.'),
        'toward the last known target position',
      ),
      'approach-delay': randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2852-2875',
        DELAY('Below five tiles, no approach direction is legal; the final still-Stand guard starts a 5-14 tick Delay.'),
        'toward the last known target position',
      ),
      circle: roundWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:2834-2844',
        DELAY('No circle direction is legal; the routine remains in Move and the final still-Stand guard starts a 5-14 tick Delay.'),
      ),
    },
    bands: [
      { distance: 0, role: 'adjacent', scenarioTest: 'condition', scenarios: [
        { context: 'Normal goal with a clear line', primary: true, tree: roll(2, specialRanged, roll(4, test('condition', 'fair attack selection', [['Inferno branch', specialRanged], ['melee branch', melee]]), action('Delay', 'wait', ref(4)))) },
        { context: 'Normal goal with a blocked line', tree: roll(4, test('condition', 'fair attack selection', [['Inferno branch', specialRanged], ['melee branch', melee]]), action('Delay', 'wait', ref(4))) },
      ] },
      { distance: 1, role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Move goal', tree: roll(1, circle, action('Delay', 'wait', ref(1))) },
        { context: 'Normal goal', primary: true, tree: roll(2, specialRanged, roll(3, approachDelay, action('Delay', 'wait', ref(3)))) },
      ] },
      { distance: 2, role: 'range', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Previous mode was Delay', tree: approach },
        { context: 'Previous mode was not Delay', tree: skeletonRange() },
      ] },
    ],
  },
  Diablo: rangedAvoidanceBands('.reference/devilutionX/Source/monster.cpp:2013'),
  Lazarus: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2879', '.reference/devilutionX/Source/monster.cpp:2724', '.reference/devilutionX/Source/monster.cpp:755'],
    walkAttempts: counselorWalkAttempts(true),
    bands: [{ label: 'quest-gated', role: 'other', scenarios: [{ context: 'Talking or Inquiring goal', tree: idle }] }, ...counselorBands(true)],
  },
  LazarusSuccubus: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2928', '.reference/devilutionX/Source/monster.cpp:1976'],
    walkAttempts: sharedRangedWalkAttempts(),
    bands: [{ label: 'quest-gated', role: 'other', scenarios: [{ context: 'Goal is not Normal', tree: idle }] }, ...sharedRangedBands()],
  },
  Lachdanan: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2953'],
    bands: [{ label: 'scripted encounter', role: 'other', scenarioTest: 'condition', scenarios: [
      { context: 'Dialogue continues', primary: true, tree: idle },
      { context: 'Final speech has finished', tree: action('Death', 'special') },
    ] }],
  },
  Warlord: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2984', '.reference/devilutionX/Source/monster.cpp:2124'],
    walkAttempts: {
      approach: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:3003-3004',
        STAY_STAND('The inherited Skeleton approach finds no legal direction and ends the delegated AI call in Stand.'),
        'toward the last known target position',
      ),
    },
    bands: [
      { label: 'quest-gated', role: 'other', scenarios: [{ context: 'Goal is not Normal', tree: idle }] },
      { label: 'adjacent target after release', role: 'adjacent', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Previous mode was Delay', tree: melee },
        { context: 'Previous mode was not Delay', primary: true, tree: skeletonAdjacent() },
      ] },
      { label: 'target at range after release', role: 'range', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Previous mode was Delay', tree: approach },
        { context: 'Previous mode was not Delay', primary: true, tree: skeletonRange() },
      ] },
    ],
  },
  HorkDemon: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:3009'],
    walkAttempts: {
      approach: randomWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:3050-3058',
        STAY_STAND('No approach direction is legal; the routine remains in Stand and finishes the AI call.'),
        'toward the last known target position',
      ),
      circle: roundWalkAttempt(
        '.reference/devilutionX/Source/monster.cpp:3026-3035',
        DELAY('No circle direction is legal; the routine immediately starts a 10-19 tick Delay.'),
      ),
    },
    bands: [
      { distance: 0, role: 'adjacent', scenarios: [{ context: 'Normal goal', primary: true, tree: roll(4, melee, idle) }] },
      { distance: 1, role: 'range', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Spawn tile and capacity available', tree: roll(1, specialRanged, roll(3, approach, action('Delay', 'wait', ref(3)))) },
        { context: 'Spawn tile or capacity unavailable', tree: roll(1, idle, roll(3, approach, action('Delay', 'wait', ref(3)))) },
        { context: 'No spawn; immediately after movement', tree: roll(2, approach, action('Delay', 'wait', ref(2))) },
        { context: 'No spawn; otherwise', primary: true, tree: roll(3, approach, action('Delay', 'wait', ref(3))) },
      ] },
      { distance: 2, role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Not already circling; spawn resources available', tree: roll(0, circle, roll(1, specialRanged, roll(3, approach, action('Delay', 'wait', ref(3))))) },
        { context: 'Not already circling; spawn resources unavailable', tree: roll(0, circle, roll(1, idle, roll(3, approach, action('Delay', 'wait', ref(3))))) },
      ] },
    ],
  },
};
