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
  mode: AiGraphActionMode;
  category: AiGraphActionCategory;
  pause?: AiGraphRollRef;
  note?: string;
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

export type AiGraphTree = AiGraphActionTree | AiGraphRollTree | AiGraphRollBandsTree | AiGraphTestTree;

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
  findings?: readonly string[];
}

const ref = (index: number, routine?: string): AiGraphRollRef => ({ index, ...(routine ? { routine } : {}) });
const action = (mode: AiGraphActionMode, category: AiGraphActionCategory, pause?: AiGraphRollRef, note?: string): AiGraphActionTree => ({
  kind: 'action', mode, category, ...(pause ? { pause } : {}), ...(note ? { note } : {}),
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
const approach = action('Walk', 'approach');
const tacticalWalk = action('Walk', 'special');
const melee = action('MeleeAttack', 'attack');
const ranged = action('RangedAttack', 'attack');
const specialMelee = action('SpecialMeleeAttack', 'special');
const specialRanged = action('SpecialRangedAttack', 'special');

const skeletonRange = (routine = 'SkeletonMelee'): AiGraphTree => roll(0, approach, action('Delay', 'wait', ref(0, routine)), routine);
const skeletonAdjacent = (routine = 'SkeletonMelee'): AiGraphTree => roll(1, melee, action('Delay', 'wait', ref(1, routine)), routine);

const rangedAvoidanceBands = (sourceRef: string): AiDecisionGraphData => ({
  sourceRefs: [sourceRef, '.reference/devilutionX/Source/monster.cpp:1940'],
  bands: [
    {
      distance: 0,
      role: 'adjacent',
      scenarios: [{
        context: 'Normal goal with a clear line', primary: true,
        tree: rollBands([[3, specialRanged], [4, melee]], action('Delay', 'wait', ref(4))),
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
        { context: 'Move goal', tree: roll(1, specialRanged, tacticalWalk) },
        { context: 'Circle-entry test', tree: roll(0, tacticalWalk, roll(2, specialRanged, approach)) },
      ],
    },
  ],
});

const sharedRangedBands = (special = false, suppressPostShotDelay = false): readonly AiGraphDistanceBandData[] => {
  const shot = special ? specialRanged : ranged;
  return [
    {
      distance: 0,
      role: 'adjacent',
      scenarioTest: 'previous-mode',
      scenarios: [
        ...(!suppressPostShotDelay ? [{ context: 'Previous mode was RangedAttack', tree: action('Delay', 'wait', ref(0)) }] : []),
        { context: `${suppressPostShotDelay ? 'Previous mode was SpecialRangedAttack' : 'Previous mode was not RangedAttack'}; line clear`, primary: true, tree: roll(1, tacticalWalk, shot) },
        { context: `${suppressPostShotDelay ? 'Previous mode was SpecialRangedAttack' : 'Previous mode was not RangedAttack'}; line blocked`, tree: roll(1, tacticalWalk, idle) },
      ],
    },
    {
      distance: 1,
      role: 'range',
      scenarioTest: 'condition',
      scenarios: [
        ...(!suppressPostShotDelay ? [{ context: 'Previous mode was RangedAttack', tree: action('Delay', 'wait', ref(0)) }] : []),
        { context: 'Fully alert or targeting a monster; line clear', primary: true, tree: shot },
        { context: 'Fully alert or targeting a monster; line blocked', tree: idle },
        { context: 'Partially alert', tree: approach },
      ],
    },
  ];
};

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
    scenarios: [{ context: 'Fully alert in the target room', tree: roll(0, tacticalWalk, roll(1, approach, idle, routine)) }],
  },
];

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
        tree: roll(0, ranged, roll(1, action('FadeOut', 'special'), ignoreDelay ? idle : action('Delay', 'wait'), 'Counselor'), 'Counselor'),
      },
      { context: 'Move goal', tree: tacticalWalk },
      { context: 'Retreat goal', tree: tacticalWalk },
    ],
  },
];

export const D1_AI_DECISION_GRAPHS_DATA: Record<string, AiDecisionGraphData> = {
  Zombie: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2069'],
    bands: [
      { distance: 0, role: 'adjacent', scenarios: [{ context: 'Visible tile', primary: true, tree: roll(0, melee, idle) }] },
      { distance: 1, role: 'range', scenarios: [{ context: 'Visible tile', primary: true, tree: roll(0, approach, idle) }] },
      { distance: 2, role: 'range', scenarios: [{ context: 'Visible tile', tree: roll(0, roll(1, tacticalWalk, tacticalWalk), idle) }] },
    ],
  },
  Fat: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2099'],
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
    bands: [
      { distance: 0, role: 'adjacent', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Settled; retreat tile legal', primary: true, tree: roll(0, tacticalWalk, roll(2, ranged, idle)) },
        { context: 'After movement; retreat tile legal', tree: roll(1, tacticalWalk, roll(2, ranged, idle)) },
        { context: 'Retreat tile blocked', tree: roll(0, roll(2, ranged, idle), roll(2, ranged, idle)) },
      ] },
      { distance: 1, role: 'range', scenarios: [{ context: 'Outside retreat band', tree: roll(2, ranged, idle) }] },
    ],
  },
  Scavenger: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2180', '.reference/devilutionX/Source/monster.cpp:2202', '.reference/devilutionX/Source/monster.cpp:2124'],
    findings: ['The table says the fair bit selects ascending versus descending corpse traversal. In the pinned source, the descending case starts at +4 with a -1 increment but retains y <= -4 and x <= -4 loop conditions, so neither loop iterates.'],
    bands: [
      { distance: 0, role: 'other', scenarioTest: 'condition', scenarios: [
        { context: 'Healing while standing on a corpse', tree: specialMelee },
        { context: 'Healing with a remembered corpse', tree: tacticalWalk },
        { context: 'Healing search has no remembered corpse', tree: roll(1, tacticalWalk, idle) },
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
    bands: [
      { distance: 0, role: 'adjacent', scenarios: [{ context: 'Normal goal', primary: true, tree: roll(4, melee, idle) }] },
      { distance: 1, role: 'range', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Immediately after movement', tree: roll(2, approach, action('Delay', 'wait', ref(2))) },
        { context: 'Otherwise', primary: true, tree: roll(3, approach, action('Delay', 'wait', ref(3))) },
      ] },
      { distance: 2, role: 'range', scenarios: [{ context: 'Not already circling', tree: roll(0, tacticalWalk, roll(1, action('Charge', 'special'), roll(3, approach, action('Delay', 'wait', ref(3))))) }] },
    ],
  },
  GoatMelee: { sourceRefs: ['.reference/devilutionX/Source/monster.cpp:1893'], bands: goatBands() },
  GoatRanged: { sourceRefs: ['.reference/devilutionX/Source/monster.cpp:1976', '.reference/devilutionX/Source/monster.cpp:1940'], bands: sharedRangedBands() },
  Fallen: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2314', '.reference/devilutionX/Source/monster.cpp:2124'],
    bands: [
      { label: 'adjacent target', role: 'adjacent', scenarioTest: 'condition', scenarios: [
        { context: 'Attack goal', tree: melee },
        { context: 'Normal goal; previous mode was not Delay', primary: true, tree: skeletonAdjacent() },
        { context: 'Last standing-animation frame', tree: roll(0, action('SpecialStand', 'special'), idle) },
      ] },
      { label: 'target at range', role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Attack goal', tree: approach },
        { context: 'Retreat goal', tree: tacticalWalk },
        { context: 'Normal goal; previous mode was not Delay', primary: true, tree: skeletonRange() },
      ] },
    ],
  },
  Magma: rangedAvoidanceBands('.reference/devilutionX/Source/monster.cpp:2013'),
  SkeletonKing: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2374'],
    bands: [
      { distance: 0, role: 'adjacent', scenarioTest: 'condition', scenarios: [
        { context: 'Summoning disabled', primary: true, tree: roll(3, melee, idle) },
        { context: 'Vanilla single-player summon branch', tree: roll(1, action('SpecialStand', 'special'), roll(3, melee, idle)) },
      ] },
      { label: 'approach range below circle entry', role: 'range', scenarios: [{ context: 'Normal goal', primary: true, tree: roll(2, approach, action('Delay', 'wait')) }] },
      { distance: 1, role: 'range', scenarios: [{ context: 'Fully alert in the target room', tree: roll(0, tacticalWalk, roll(1, action('SpecialStand', 'special'), roll(2, approach, action('Delay', 'wait')))) }] },
    ],
  },
  Bat: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2432'],
    bands: [
      { distance: 0, role: 'adjacent', scenarios: [{ context: 'Normal goal', primary: true, tree: roll(3, melee, idle) }] },
      { label: 'ordinary approach range', role: 'range', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Standing more than the settle interval', primary: true, tree: roll(1, approach, idle) },
        { context: 'Immediately after movement', tree: roll(2, approach, idle) },
      ] },
      { distance: 1, role: 'range', scenarios: [{ context: 'Gloom with clear route', tree: roll(0, action('Charge', 'special'), roll(1, approach, idle)) }] },
      { label: 'post-melee retreat', role: 'other', scenarios: [{ context: 'Second retreat decision', tree: roll(4, tacticalWalk, tacticalWalk) }] },
    ],
  },
  Gargoyle: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2480', '.reference/devilutionX/Source/monster.cpp:1893', '.reference/devilutionX/Source/monster.cpp:1051'],
    bands: [
      { distance: 0, role: 'other', scenarioTest: 'condition', scenarios: [
        { context: 'Statue permission still set', tree: idle },
        { context: 'Wounded retreat reached clearance', tree: action('Heal', 'special') },
        { context: 'Wounded and below clearance', tree: tacticalWalk },
      ] },
      ...goatBands(),
    ],
  },
  Butcher: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2509'],
    bands: [
      { distance: 0, role: 'adjacent', scenarios: [{ context: 'Alert', primary: true, tree: melee }] },
      { distance: 1, role: 'range', scenarios: [{ context: 'Alert', primary: true, tree: approach }] },
    ],
  },
  Succubus: { sourceRefs: ['.reference/devilutionX/Source/monster.cpp:1976', '.reference/devilutionX/Source/monster.cpp:1940'], bands: sharedRangedBands() },
  Sneak: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2526'],
    bands: [
      { label: 'adjacent while visible', role: 'adjacent', scenarios: [{ context: 'Normal goal', primary: true, tree: roll(2, melee, idle) }] },
      { distance: 0, role: 'other', scenarios: [{ context: 'Hidden', tree: action('FadeIn', 'special') }] },
      { distance: 1, role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Visible', tree: action('FadeOut', 'special') },
        { context: 'Retreat goal', tree: tacticalWalk },
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
    bands: [
      { label: 'quest-gated', role: 'other', scenarios: [{ context: 'Talking or Inquiring goal', tree: idle }] },
      ...goatBands('GoatMelee'),
    ],
  },
  Acid: rangedAvoidanceBands('.reference/devilutionX/Source/monster.cpp:2013'),
  AcidUnique: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:1976', '.reference/devilutionX/Source/monster.cpp:1996'],
    findings: ['The table exposes the shared previous-RangedAttack delay row for AcidUnique, but AcidUnique starts SpecialRangedAttack. The pinned delay gate tests literal RangedAttack, so AcidUnique does not enter that delay immediately after its own shot.'],
    bands: sharedRangedBands(true, true),
  },
  Golem: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:4157'],
    bands: [
      { distance: 0, role: 'adjacent', scenarios: [{ context: 'Monster target in the attack box', primary: true, tree: melee }] },
      { label: 'target outside attack box', role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Pathfinding starts a step', primary: true, tree: approach },
        { context: 'Owner-facing or fallback direction starts a step', tree: approach },
        { context: 'Every candidate tile blocked', tree: idle },
      ] },
    ],
  },
  Zhar: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2786', '.reference/devilutionX/Source/monster.cpp:2724'],
    bands: [{ label: 'quest-gated', role: 'other', scenarios: [{ context: 'Talking or Inquiring goal', tree: idle }] }, ...counselorBands()],
  },
  Snotspill: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2630', '.reference/devilutionX/Source/monster.cpp:2314'],
    bands: [
      { label: 'quest-gated', role: 'other', scenarios: [{ context: 'Banner quest has not released combat', tree: idle }] },
      { label: 'adjacent target after release', role: 'adjacent', scenarios: [{ context: 'Normal goal', primary: true, tree: skeletonAdjacent() }] },
      { label: 'target at range after release', role: 'range', scenarios: [{ context: 'Normal goal', primary: true, tree: skeletonRange() }] },
    ],
  },
  Snake: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2669'],
    bands: [
      { distance: 0, role: 'adjacent', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Previous mode was Delay or Charge', tree: melee },
        { context: 'Previous mode was neither Delay nor Charge', primary: true, tree: roll(1, melee, action('Delay', 'wait', ref(1))) },
      ] },
      { distance: 1, role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Clear route and previous mode was not Charge', tree: action('Charge', 'special') },
        { context: 'Charge ineligible; previous mode was Delay', tree: approach },
        { context: 'Charge ineligible; previous mode was not Delay', primary: true, tree: roll(0, approach, action('Delay', 'wait', ref(0))) },
      ] },
      { label: 'range beyond charge distance', role: 'range', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Previous mode was Delay', tree: approach },
        { context: 'Previous mode was not Delay', tree: roll(0, approach, action('Delay', 'wait', ref(0))) },
      ] },
    ],
  },
  Counselor: { sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2724'], bands: counselorBands() },
  Mega: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2818', '.reference/devilutionX/Source/monster.cpp:2124'],
    bands: [
      { distance: 0, role: 'adjacent', scenarios: [{ context: 'Normal goal', primary: true, tree: roll(4, test('condition', 'fair attack selection', [['Inferno branch', specialRanged], ['melee branch', melee]]), action('Delay', 'wait')) }] },
      { distance: 1, role: 'range', scenarioTest: 'condition', scenarios: [
        { context: 'Move goal', tree: roll(1, tacticalWalk, idle) },
        { context: 'Normal goal', primary: true, tree: roll(2, specialRanged, roll(3, approach, action('Delay', 'wait'))) },
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
    bands: [{ label: 'quest-gated', role: 'other', scenarios: [{ context: 'Talking or Inquiring goal', tree: idle }] }, ...counselorBands(true)],
  },
  LazarusSuccubus: {
    sourceRefs: ['.reference/devilutionX/Source/monster.cpp:2928', '.reference/devilutionX/Source/monster.cpp:1976'],
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
    bands: [
      { distance: 0, role: 'adjacent', scenarios: [{ context: 'Normal goal', primary: true, tree: roll(4, melee, idle) }] },
      { distance: 1, role: 'range', scenarioTest: 'previous-mode', scenarios: [
        { context: 'Spawn tile and capacity available', tree: roll(1, specialRanged, roll(3, approach, action('Delay', 'wait', ref(3)))) },
        { context: 'No spawn; immediately after movement', tree: roll(2, approach, action('Delay', 'wait', ref(2))) },
        { context: 'No spawn; otherwise', primary: true, tree: roll(3, approach, action('Delay', 'wait', ref(3))) },
      ] },
      { distance: 2, role: 'range', scenarios: [{ context: 'Not already circling', tree: roll(0, tacticalWalk, roll(1, specialRanged, roll(3, approach, action('Delay', 'wait', ref(3))))) }] },
    ],
  },
};
