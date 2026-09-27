import type { AiRollChance, AiRoutineSpec } from '@/lib/catalog/reference/aiRoutines';

const linear = (perIntelligence: number, base: number): AiRollChance => ({ linear: { perIntelligence, base } });
const expression = (value: string): AiRollChance => ({ expression: value });
const roll = (when: string, chance: AiRollChance, onSuccess: string, onFail: string, pause?: { base: number; perIntelligence: number; randomMax: number }) => ({ when, chance, onSuccess, onFail, pause });
const distance = (name: string, tiles: string, meaning: string, threshold?: number) => ({ name, tiles, meaning, threshold });
const attack = (kind: AiRoutineSpec['attacks'][number]['kind'], missile: string, condition: string) => ({ kind, missile, condition });

/**
 * One entry for every AI identifier used by the pinned base-game monster tables.
 * The prose is descriptive; machine-readable probabilities live in `chance.linear` whenever one
 * threshold is exactly `(a * intelligence + b)%` and in `chance.expression` otherwise.
 */
export const D1_AI_ROUTINES_DATA = {
  Zombie: {
    lawId: 'd1-ai-zombie-law',
    states: ['Stand decision gate', 'Walk', 'MeleeAttack'],
    rolls: [
      roll('Standing on a visible tile', linear(2, 10), 'Choose attack or movement by distance.', 'Remain standing.'),
      roll('Acting at long range', linear(2, 20), 'Walk in a uniformly random direction if legal.', 'Try the current facing direction.'),
    ],
    distances: [distance('adjacent', 'd < 2', 'Start normal melee.'), distance('intermediate', '2 <= d < 2*i+4', 'Move toward the target.'), distance('long', 'd >= 2*i+4', 'Continue facing or choose a random direction.')],
    attacks: [attack('melee', 'none', 'Successful action while adjacent.')],
    movement: 'Intermediate movement tries toward, ±45°, then ±90°; long movement tries only the selected direction. SEARCH may pathfind first.',
    // monster.cpp:349-365,1674-1728,4886-4899 — alertness copies before the later leash line check.
    special: "Pack minions get twice the hit points and the leader intelligence. Leashed minions copy the leader AI and copy a more-alert leader's alertness (activeForTicks) minus one with no line check; later cohesion checks can separate or reunite the leash.",
    hellfire: false,
  },
  Fat: {
    lawId: 'd1-ai-fat-law',
    states: ['Stand decision gate', 'Walk', 'MeleeAttack', 'SpecialMeleeAttack'],
    rolls: [
      roll('At range after standing more than 20 ticks', linear(4, 20), 'Approach.', 'Idle.'),
      roll('At range immediately after a completed move', linear(4, 70), 'Approach.', 'Idle.'),
      roll('Adjacent, lower band of one shared roll', linear(4, 15), 'Start the normal melee animation.', 'Test the next band of the same roll.'),
      roll('Adjacent, next band of the same roll', linear(0, 5), 'Start the special melee animation.', 'Idle.'),
    ],
    distances: [distance('adjacent', 'd < 2', 'Melee decision.'), distance('range', 'd >= 2', 'Approach decision.')],
    attacks: [attack('melee', 'none', 'Adjacent lower roll band.'), attack('special', 'none', 'Adjacent 5-point band above the normal threshold.')],
    movement: 'Faces the target and uses obstacle-tolerant approach movement; SEARCH may pathfind first.',
    special: 'No routine pause; common pack rules apply.',
    hellfire: false,
  },
  SkeletonMelee: {
    lawId: 'd1-ai-skeleton-melee-law',
    states: ['Stand decision gate', 'Delay', 'Walk', 'MeleeAttack'],
    rolls: [
      roll('At range and previous mode was not Delay', linear(4, 65), 'Approach.', 'Pause (15 - 2*i) plus 0-9 ticks.', { base: 15, perIntelligence: 2, randomMax: 9 }),
      roll('Adjacent and previous mode was not Delay', linear(2, 20), 'Normal melee.', 'Pause (10 - 2*i) plus 0-9 ticks.', { base: 10, perIntelligence: 2, randomMax: 9 }),
      roll('Previous mode was Delay', expression('forced; no roll'), 'Step at range, otherwise attack.', 'Not applicable.'),
    ],
    distances: [distance('adjacent', 'd < 2', 'Attack or attack-delay.'), distance('range', 'd >= 2', 'Approach or movement-delay.')],
    attacks: [attack('melee', 'none', 'Adjacent successful roll or first decision after Delay.')],
    movement: 'Obstacle-tolerant step toward the last known target position; SEARCH may pathfind first.',
    special: 'A delay returns to Stand when its pre-decrement counter reaches zero; common pack rules apply.',
    hellfire: false,
  },
  SkeletonRanged: {
    lawId: 'd1-ai-skeleton-ranged-law',
    states: ['Stand decision gate', 'Walk', 'RangedAttack'],
    rolls: [
      roll('Below 4 tiles after standing more than 20 ticks', linear(2, 13), 'Try one direct step opposite the target.', 'Proceed to the independent shot roll.'),
      roll('Below 4 tiles immediately after a completed move', linear(2, 63), 'Try one direct step opposite the target.', 'Proceed to the independent shot roll.'),
      roll('No retreat step actually started, at any distance', linear(2, 3), 'Fire Arrow when line-clear.', 'Idle.'),
    ],
    distances: [distance('retreat band', 'd < 4', 'May step directly away.', 4), distance('shot range', 'any d', 'May shoot if it did not move.')],
    attacks: [attack('missile', 'Arrow', 'Independent shot roll succeeds and moving-missile line is clear.')],
    movement: 'Never approaches; retreat is one exact opposite-direction step and a blocked attempt still permits the shot roll. SEARCH may pathfind first.',
    special: 'Common pack rules apply.',
    hellfire: false,
  },
  Scavenger: {
    lawId: 'd1-ai-scavenger-law',
    states: ['Stand decision gate', 'Healing goal', 'SpecialMeleeAttack/eating', 'Delay', 'Walk', 'MeleeAttack'],
    rolls: [
      roll('Entering healing below half HP', expression('no roll; budget is ten standing AI calls'), 'Detach from any leader and seek corpses.', 'Not applicable.'),
      // monster.cpp:2180-2199 — the reverse branch starts at +4 with <= -4 loop guards, so it never iterates.
      roll('Selecting corpse traversal order', expression('one fair bit'), 'Scan the square in ascending order.', 'The reverse scan performs no iterations and finds nothing.'),
      roll('Healing does not start an action', expression('delegate to SkeletonMelee rolls'), 'Use its result.', 'Use its delay.'),
    ],
    distances: [distance('corpse search square', 'within 4 tiles on each axis', 'The ascending scan selects the first corpse connected by a non-solid line; the reverse scan selects none.'), distance('melee split', 'inherited SkeletonMelee distance', 'Inherited behavior.')],
    attacks: [attack('heal', 'none', 'Eat a corpse during the healing budget.'), attack('melee', 'none', 'Inherited SkeletonMelee action.')],
    movement: 'Walks toward the remembered corpse; otherwise inherits SkeletonMelee approach. SEARCH may pathfind first.',
    special: 'Vanilla adds one health per eating action until reaching three-quarters health. Hellfire adds one-eighth maximum health, clamps at full, and consumes the corpse when the ten-call budget expires or full health is reached.',
    hellfire: false,
  },
  Rhino: {
    lawId: 'd1-ai-rhino-law',
    states: ['Stand decision gate', 'Normal goal', 'Move/circle goal', 'Delay', 'Walk', 'Charge', 'MeleeAttack'],
    rolls: [
      roll('At 5 or more tiles and not circling', expression('75%'), 'Circle for at most twice the distance in decisions.', 'Continue normally.'),
      roll('Normal goal at 5 or more tiles', linear(2, 43), 'Charge if the route is traversable.', 'Redraw for movement.'),
      roll('Normal goal at range after a completed move', linear(2, 83), 'Approach.', 'Pause 10-19 ticks.', { base: 10, perIntelligence: 0, randomMax: 9 }),
      roll('Normal goal at range otherwise', linear(2, 33), 'Approach.', 'Pause 10-19 ticks.', { base: 10, perIntelligence: 0, randomMax: 9 }),
      roll('Normal goal while adjacent', linear(2, 28), 'Normal melee.', 'Idle.'),
    ],
    distances: [distance('adjacent', 'd < 2', 'Melee.'), distance('approach', '2 <= d < 5', 'Walk or delay.'), distance('charge/circle', 'd >= 5', 'May circle or charge.')],
    attacks: [attack('special', 'Rhino', 'Clear traversable charge route.'), attack('melee', 'none', 'Adjacent attack roll.')],
    movement: 'Circles or approaches with obstacle tolerance; blocked circles pause 10-19 ticks. SEARCH may pathfind first.',
    special: 'Most Rhino collisions may shove the player; common pack rules apply.',
    hellfire: false,
  },
  GoatMelee: {
    lawId: 'd1-ai-goat-melee-law',
    states: ['Stand decision gate', 'Normal goal', 'Move/circle goal', 'Delay', 'Walk', 'MeleeAttack', 'SpecialMeleeAttack'],
    rolls: [
      roll('Fully alert, same room, at least 4 tiles away', expression('25%'), 'Enter the circle goal.', 'Remain normal.'),
      roll('At range after standing more than 20 ticks', linear(2, 28), 'Approach.', 'Idle.'),
      roll('At range immediately after a move', linear(2, 78), 'Approach.', 'Idle.'),
      roll('Adjacent', linear(2, 23), 'Attack; a fair bit selects special when wounded.', 'Idle.'),
    ],
    distances: [distance('adjacent', 'd < 2', 'Melee roll.'), distance('approach', 'd >= 2', 'Approach roll.'), distance('circle entry', 'd >= 4', 'May circle.')],
    attacks: [attack('melee', 'none', 'Successful adjacent roll.'), attack('special', 'none', 'Half of successful adjacent rolls below half HP.')],
    // monster.cpp:1911-1915 — after 2*d attempts the circle ends only when the direct direction is legal.
    movement: 'Obstacle-tolerant approach or circling; the circle counter can exceed 2*d while the direct direction remains blocked, and a failed circle walk pauses 10-19 ticks. SEARCH may pathfind first.',
    special: 'Common pack rules apply.',
    hellfire: false,
  },
  GoatRanged: {
    lawId: 'd1-ai-ranged-law',
    states: ['Stand decision gate', 'Delay', 'Walk', 'RangedAttack'],
    rolls: [
      roll('Previous mode was RangedAttack', expression('delay n in [0,19]'), 'A positive draw starts Delay; zero leaves the monster standing and it continues this AI call.', 'Not applicable.', { base: 0, perIntelligence: 0, randomMax: 19 }),
      roll('Fully alert or monster-targeting and below 4 tiles', linear(10, 70), 'Attempt RandomWalk away.', 'Remain standing and test line of sight.'),
      roll('Still standing', expression('no random shot roll; requires clear line'), 'Fire Arrow.', 'Idle.'),
    ],
    distances: [distance('retreat band', 'd < 4', 'May retreat.', 4), distance('shot range', 'any d', 'At full alert or while monster-targeting, shoot whenever still standing and line-clear.')],
    attacks: [attack('missile', 'Arrow', 'Still standing after the retreat branch and moving-missile line is clear.')],
    movement: 'At full alert or while monster-targeting it never approaches; below 4 tiles RandomWalk prefers away but may fall back or fail. A partially alert player-targeter approaches the last target position. SEARCH may pathfind first.',
    special: 'Common pack rules apply.',
    hellfire: false,
  },
  Fallen: {
    lawId: 'd1-ai-fallen-law',
    states: ['Stand decision gate', 'Normal goal', 'Retreat goal', 'Attack goal', 'SpecialStand/war cry', 'Delay', 'Walk', 'MeleeAttack'],
    rolls: [
      // monster.cpp:2314-2324,2333-2358 — Attack counts every FallenAi call, even calls that return for a non-Stand mode.
      roll('Last standing-animation frame', expression('one in four'), 'Heal and order nearby Fallen to attack for 30*i+105 AI calls.', 'Return without normal AI.'),
      roll('Normal goal', expression('SkeletonMelee rolls'), 'Use inherited step or attack.', 'Use inherited delay.'),
      roll('Attack goal', expression('forced; no roll'), 'Attack while adjacent; otherwise approach.', 'Not applicable.'),
    ],
    distances: [distance('death-fear square', 'radius 4', 'Nearby Fallen retreat.'), distance('war-cry square', 'radius 2*i+4', 'Nearby Fallen attack.')],
    attacks: [attack('melee', 'none', 'Inherited or forced during Attack goal.'), attack('heal', 'none', 'War cry restores up to 2*i+2 internal health.')],
    movement: 'Retreat makes max(8-level,2) standing RandomWalk attempts, counting blocked attempts; Attack approaches while its AI-call counter remains; Normal inherits SkeletonMelee. SEARCH may pathfind first.',
    special: 'War cries affect all Fallen in range; common pack rules apply.',
    hellfire: false,
  },
  Magma: {
    lawId: 'd1-ai-ranged-avoidance-law',
    states: ['Stand decision gate', 'Normal goal', 'Move/circle goal', 'Delay', 'Walk', 'SpecialRangedAttack', 'MeleeAttack'],
    rolls: [
      roll('Fully alert, same room, d >= 3, not already circling', expression('one in four'), 'Enter the circle goal.', 'Remain normal.'),
      roll('Circling', linear(5, 5), 'Fire MagmaBall when line-clear.', 'Attempt RoundWalk; if still standing, pause 5-14 ticks.'),
      roll('Normal goal at 3 or more tiles with a clear line', linear(5, 10), 'Fire MagmaBall.', 'Redraw and approach.'),
      roll('Normal goal at 2 tiles with a clear line', linear(5, 5), 'Fire MagmaBall.', 'Redraw and approach.'),
      roll('Normal goal, adjacent with a clear line, next band of the shared roll', linear(5, 55), 'Normal melee.', 'Pause 5-14 ticks.', { base: 5, perIntelligence: 0, randomMax: 9 }),
      // monster.cpp:2047-2065 — without line-clear the skipped missile band remains eligible for melee.
      roll('Normal goal, adjacent with a blocked line', linear(10, 60), 'Normal melee.', 'Pause 5-14 ticks.', { base: 5, perIntelligence: 0, randomMax: 9 }),
    ],
    distances: [distance('adjacent', 'd < 2', 'Possible melee.'), distance('far range', 'd >= 3', 'Higher ranged threshold and possible circling.')],
    attacks: [attack('missile', 'MagmaBall', 'Line-clear ranged threshold.'), attack('melee', 'none', 'Adjacent next band when line-clear, or the full 10*i+60% threshold when line-blocked.')],
    movement: 'Circles at far range; a missed ranged action always tries to approach when non-adjacent because of the scale mismatch. SEARCH may pathfind first.',
    special: 'Magma also has an engine-defined frame-8 strike; common pack rules apply.',
    hellfire: false,
  },
  SkeletonKing: {
    lawId: 'd1-ai-skeleton-king-law',
    states: ['Stand decision gate', 'Normal goal', 'Move/circle goal', 'Delay', 'Walk', 'SpecialStand/summon', 'MeleeAttack'],
    rolls: [
      roll('Fully alert, same room, d >= 3, not already circling', expression('one in four'), 'Enter the circle goal.', 'Remain normal.'),
      // monster.cpp:2402-2425 — passing the roll but failing the space/capacity checks idles instead of falling through.
      roll('Normal goal while multiplayer quests are disabled', expression('line-clear and ((d>=3 and r<4*i+35) or r<6)'), 'With space and capacity, spawn if a skeleton type exists and enter SpecialStand; otherwise idle.', 'Use the movement/melee branch.'),
      roll('Normal goal, d >= 2', expression('i+25%, or i+75% immediately after movement'), 'Approach.', 'Pause 10-19 ticks.', { base: 10, perIntelligence: 0, randomMax: 9 }),
      roll('Adjacent', linear(1, 20), 'Normal melee.', 'Idle.'),
    ],
    distances: [distance('adjacent', 'd < 2', 'Melee.'), distance('circle/summon band', 'd >= 3', 'Circle and stronger summon condition.')],
    attacks: [attack('summon', 'none', 'Multiplayer quests disabled, line-clear predicate passed, front tile and capacity available, and a skeleton type exists.'), attack('melee', 'none', 'Adjacent threshold after the summon predicate fails.')],
    movement: 'Circling or obstacle-tolerant approach; the circle counter can exceed 2*d while the direct direction remains blocked, and failed movement pauses 10-19 ticks. SEARCH may pathfind first.',
    special: 'Enabling multiplayer quests disables summoning; successful melee may heal the King. Common pack rules apply.',
    hellfire: false,
  },
  Bat: {
    lawId: 'd1-ai-bat-law',
    states: ['Stand decision gate', 'Normal goal', 'Retreat goal', 'Walk', 'Charge', 'MeleeAttack'],
    rolls: [
      roll('Gloom at 5 or more tiles', linear(4, 33), 'Charge if route-clear.', 'Use ordinary movement.'),
      roll('At range after standing more than 20 ticks', linear(1, 13), 'Approach.', 'Idle.'),
      roll('At range immediately after a move', linear(1, 63), 'Approach.', 'Idle.'),
      roll('Adjacent', linear(4, 8), 'Melee, then retreat.', 'Idle.'),
      // monster.cpp:2441-2449 — both retreat calls use RandomWalk, so either can fall back or fail.
      roll('Second retreat AI call chooses its preferred side', expression('fair choice of right or left'), 'Prefer right in RandomWalk, then return to Normal.', 'Prefer left in RandomWalk, then return to Normal.'),
    ],
    distances: [distance('adjacent', 'd < 2', 'Melee and begin retreat.'), distance('Gloom charge', 'd >= 5', 'May charge.')],
    attacks: [attack('melee', 'none', 'Adjacent successful roll.'), attack('special', 'Rhino', 'Gloom clear-route charge.'), attack('missile', 'Lightning', 'Familiar creates lightning when melee begins.')],
    movement: 'After attacking it makes two retreat AI calls: RandomWalk first prefers directly away, then prefers a randomly chosen side; either call may fall back or fail, and the second returns to Normal. Ordinary movement approaches. SEARCH may pathfind first.',
    special: 'The Gloom charge intentionally deals no collision damage; common pack rules apply.',
    hellfire: false,
  },
  Gargoyle: {
    lawId: 'd1-ai-gargoyle-law',
    states: ['Statue/AllowSpecial', 'Stand decision gate', 'Retreat goal', 'Heal', 'Normal/Move goals', 'Walk', 'MeleeAttack'],
    rolls: [roll('Starting heal at sufficient clearance', expression('uniform k from 4 through 8; chunk=maxHP/(16*k)'), 'Enter Heal and statue state.', 'Not applicable.'), roll('Normal combat', expression('GoatMelee rolls'), 'Use inherited action.', 'Use inherited idle or delay.')],
    distances: [distance('wake/heal threshold', 'd compared with i+2', 'Wake below it; wounded retreat may heal at or above it.')],
    attacks: [attack('heal', 'none', 'Below half HP after retreat reaches clearance.'), attack('melee', 'none', 'Inherited GoatMelee.')],
    movement: 'Below half HP RandomWalk prefers directly away but may fall back; if every candidate is blocked, retreat is cancelled. Otherwise it inherits GoatMelee movement. SEARCH may pathfind first.',
    special: 'Approaching a healing statue wakes it; full health clears statue permission; common pack rules apply.',
    hellfire: false,
  },
  Butcher: {
    lawId: 'd1-ai-butcher-law', states: ['Stand decision gate', 'Walk', 'MeleeAttack'], rolls: [],
    distances: [distance('adjacent', 'adjacent', 'Always attack.'), distance('range', 'non-adjacent', 'Always approach.')],
    attacks: [attack('melee', 'none', 'Alert, standing and adjacent.')],
    movement: 'Always uses obstacle-tolerant movement toward the last target position when non-adjacent. SEARCH may pathfind first.',
    special: 'Intelligence is unused; common pack rules apply.', hellfire: false,
  },
  Succubus: {
    lawId: 'd1-ai-ranged-law', states: ['Stand decision gate', 'Delay', 'Walk', 'RangedAttack'],
    rolls: [roll('Previous mode was RangedAttack', expression('delay n in [0,19]'), 'A positive draw starts Delay; zero continues this AI call.', 'Not applicable.', { base: 0, perIntelligence: 0, randomMax: 19 }), roll('Fully alert or monster-targeting below 4 tiles', linear(10, 70), 'Attempt RandomWalk away.', 'Remain standing.'), roll('Still standing', expression('no random shot roll; clear line required'), 'Fire BloodStar.', 'Idle.')],
    distances: [distance('retreat band', 'd < 4', 'May retreat.', 4), distance('shot range', 'any d', 'At full alert or while monster-targeting, shoot whenever still standing and line-clear.')],
    attacks: [attack('missile', 'BloodStar', 'Fully alert or monster-targeting, still standing after the retreat branch, and line-clear.')],
    movement: 'At full alert or while monster-targeting it never approaches; below 4 tiles RandomWalk prefers away but may fall back or fail. A partially alert player-targeter approaches the last target position. SEARCH may pathfind first.', special: 'Common pack rules apply.', hellfire: false,
  },
  Sneak: {
    lawId: 'd1-ai-sneak-law', states: ['Stand decision gate', 'Normal goal', 'Retreat goal', 'FadeIn', 'FadeOut', 'Walk', 'MeleeAttack'],
    rolls: [roll('Normal range after standing more than 20 ticks', linear(4, 14), 'Move toward target.', 'Idle.'), roll('Normal range immediately after moving', linear(4, 64), 'Move toward target.', 'Idle.'), roll('Normal and adjacent', linear(4, 10), 'Normal melee.', 'Stand.'), roll('Retreating Unseen subtype chooses a preferred lateral direction', expression('fair choice of left or right relative to directly away'), 'Prefer the right side in RandomWalk; fallbacks or failure remain possible.', 'Prefer the left side in RandomWalk; fallbacks or failure remain possible.')],
    distances: [distance('fade-in', 'd < 5-i', 'Fade in if hidden.'), distance('fade-out', 'd >= 6-i', 'Fade out if visible.'), distance('retreat reset', 'd >= 8-i', 'Return to Normal.')],
    attacks: [attack('melee', 'none', 'Visible and adjacent roll succeeds.')],
    // monster.cpp:2534-2566 — goalVar1 increments before RandomWalk reports whether a tile was found.
    movement: 'Being hit starts retreat for at most nine movement attempts, counting blocked attempts, or until 8-i tiles away; Unseen prefers a random lateral direction and other subtypes prefer away, with RandomWalk fallbacks. SEARCH may pathfind first.', special: 'Common pack rules apply.', hellfire: false,
  },
  Storm: {
    lawId: 'd1-ai-ranged-avoidance-law', states: ['Stand decision gate', 'Normal goal', 'Move/circle goal', 'Delay', 'Walk', 'SpecialRangedAttack', 'MeleeAttack'],
    rolls: [
      roll('Fully alert, same room, d >= 3', expression('one in four'), 'Enter the circle goal.', 'Remain normal.'),
      roll('Circling', linear(5, 5), 'Fire ThinLightningControl when line-clear.', 'Attempt RoundWalk; if still standing, pause 5-14 ticks.'),
      roll('Normal goal at 3 or more tiles with a clear line', linear(5, 10), 'Fire ThinLightningControl.', 'Redraw and approach.'),
      roll('Normal goal at 2 tiles with a clear line', linear(5, 5), 'Fire ThinLightningControl.', 'Redraw and approach.'),
      roll('Normal goal, adjacent with a clear line, next band of the shared roll', linear(5, 55), 'Normal melee.', 'Pause 5-14 ticks.', { base: 5, perIntelligence: 0, randomMax: 9 }),
      roll('Normal goal, adjacent with a blocked line', linear(10, 60), 'Normal melee.', 'Pause 5-14 ticks.', { base: 5, perIntelligence: 0, randomMax: 9 }),
    ],
    distances: [distance('adjacent', 'd < 2', 'Possible melee.'), distance('far range', 'd >= 3', 'Higher cast threshold and possible circling.')],
    attacks: [attack('missile', 'ThinLightningControl', 'Line-clear ranged threshold.'), attack('melee', 'none', 'Adjacent next band when line-clear, or the full 10*i+60% threshold when line-blocked.')],
    movement: 'Circles at far range; the scale mismatch makes every non-adjacent missed-shot branch attempt approach. SEARCH may pathfind first.', special: 'Storm also has an engine-defined frame-12 strike; common pack rules apply.', hellfire: false,
  },
  FireMan: {
    lawId: 'd1-ai-fireman-law', states: ['Unimplemented/null dispatch'], rolls: [], distances: [],
    attacks: [attack('none', 'none', 'No callable AI routine exists.')], movement: 'None; ordinary processing would call a null dispatch entry.',
    special: 'Data-only and unimplemented in this source.', hellfire: true,
  },
  Gharbad: {
    lawId: 'd1-ai-gharbad-law', states: ['Stand decision gate', 'Talking/Inquiring quest goals', 'Normal goal', 'Move/circle goal', 'Delay', 'Walk', 'MeleeAttack', 'SpecialMeleeAttack'],
    rolls: [roll('Quest gate has released combat', expression('GoatMelee rolls'), 'Use inherited movement or attack.', 'Use inherited idle or delay.')],
    distances: [distance('combat distances', 'same as GoatMelee', 'Used only after hostile transition.')],
    attacks: [attack('melee', 'none', 'Inherited GoatMelee.'), attack('special', 'none', 'Inherited wounded GoatMelee selection.')],
    movement: 'No combat movement during dialogue; afterward inherits GoatMelee approach and circling. SEARCH may pathfind first.', special: 'Quest speech controls activation; common pack rules apply.', hellfire: false,
  },
  Acid: {
    lawId: 'd1-ai-ranged-avoidance-law', states: ['Stand decision gate', 'Normal goal', 'Move/circle goal', 'Delay', 'Walk', 'SpecialRangedAttack', 'MeleeAttack'],
    rolls: [
      roll('Fully alert, same room, d >= 3', expression('one in eight'), 'Enter the circle goal.', 'Remain normal.'),
      roll('Circling', expression('integer threshold (500*(i+1)) shifted right once on a 0-9999 roll'), 'Fire Acid when line-clear.', 'Attempt RoundWalk; if still standing, pause 5-14 ticks.'),
      roll('Normal goal at 3 or more tiles with a clear line', linear(2.5, 5), 'Fire Acid.', 'Redraw and approach.'),
      roll('Normal goal at 2 tiles with a clear line', linear(2.5, 2.5), 'Fire Acid.', 'Redraw and approach.'),
      roll('Normal goal, adjacent with a clear line, next band of the shared roll', linear(7.5, 57.5), 'Normal melee.', 'Pause 5-14 ticks.', { base: 5, perIntelligence: 0, randomMax: 9 }),
      roll('Normal goal, adjacent with a blocked line', linear(10, 60), 'Normal melee.', 'Pause 5-14 ticks.', { base: 5, perIntelligence: 0, randomMax: 9 }),
    ],
    distances: [distance('adjacent', 'd < 2', 'Possible melee.'), distance('far range', 'd >= 3', 'Higher cast threshold and possible circling.')],
    attacks: [attack('missile', 'Acid', 'Line-clear halved threshold.'), attack('melee', 'none', 'Adjacent next band when line-clear, or the full 10*i+60% threshold when line-blocked.')],
    movement: 'Circles one time in eight at far range; scale mismatch makes every non-adjacent missed-shot branch approach. SEARCH may pathfind first.', special: 'Common pack rules apply.', hellfire: false,
  },
  AcidUnique: {
    lawId: 'd1-ai-ranged-law', states: ['Stand decision gate', 'Walk', 'SpecialRangedAttack'],
    // monster.cpp:1987-1999 — the literal RangedAttack delay gate is not reached after AcidUnique's SpecialRangedAttack.
    rolls: [roll('Previous mode was normal RangedAttack (not produced by AcidUnique)', expression('delay n in [0,19]; unreachable after its own shot'), 'A positive draw would start Delay; SpecialRangedAttack bypasses this branch.', 'Not applicable.', { base: 0, perIntelligence: 0, randomMax: 19 }), roll('Fully alert or monster-targeting below 4 tiles', linear(10, 70), 'Attempt RandomWalk away.', 'Remain standing.'), roll('Still standing', expression('no random shot roll; clear line required'), 'Fire Acid with special animation.', 'Idle.')],
    distances: [distance('retreat band', 'd < 4', 'May retreat.', 4), distance('shot range', 'any d', 'At full alert or while monster-targeting, shoot whenever still standing and line-clear.')],
    attacks: [attack('missile', 'Acid', 'Fully alert or monster-targeting, still standing after the retreat branch, and line-clear; special animation.')],
    movement: 'At full alert or while monster-targeting it never approaches; below 4 tiles RandomWalk prefers away but may fall back or fail. A partially alert player-targeter approaches the last target position. SEARCH may pathfind first.', special: 'Its SpecialRangedAttack does not trigger the shared routine\'s literal previous-RangedAttack delay gate; common pack rules apply.', hellfire: false,
  },
  Golem: {
    lawId: 'd1-ai-golem-law', states: ['Holding cell', 'Death', 'SpecialStand', 'Walk', 'MeleeAttack', 'Target search/pathfinding'], rolls: [],
    // monster.cpp:4181-4194 — the wake square is centered on the golem, not on its target.
    distances: [distance('attack box', 'both coordinate differences below 2', 'Start melee.'), distance('wake square', '5-by-5 around the golem', 'When the adjacent target was inactive, wake positive dMonster occupants in this area.')],
    attacks: [attack('melee', 'none', 'A monster target is inside the attack box.')],
    movement: 'Pathfind first; then try the owner facing direction and all eight directions. Path count cycles from above 8 back to 5.',
    special: 'Table intelligence is unused; the player minion targets monsters.', hellfire: false,
  },
  Zhar: {
    lawId: 'd1-ai-zhar-law', states: ['Stand decision gate', 'Talking/Inquiring quest goals', 'Normal goal', 'Retreat goal', 'Move/circle goal', 'FadeIn', 'FadeOut', 'Delay', 'Walk', 'RangedAttack'],
    rolls: [roll('Quest gate has released combat', expression('Counselor rolls'), 'Use inherited spell, flash, fade or movement.', 'Use inherited delay.')],
    distances: [distance('combat distances', 'same as Counselor', 'Used after hostile transition.')],
    attacks: [attack('missile', 'Firebolt|ChargedBolt|LightningControl|Fireball', 'Inherited Counselor spell.'), attack('special', 'FlashBottom+FlashTop', 'Inherited adjacent flash.')],
    movement: 'No combat movement while quest-gated; afterward inherits Counselor circling and retreat. SEARCH may pathfind first.', special: 'Quest speech controls activation; common pack rules apply.', hellfire: false,
  },
  Snotspill: {
    lawId: 'd1-ai-snotspill-law', states: ['Stand decision gate', 'Talking/Inquiring quest goals', 'Normal goal', 'Attack goal', 'SpecialStand', 'Delay', 'Walk', 'MeleeAttack'],
    rolls: [roll('Visible after the banner quest releases combat, with a Normal or Attack goal', expression('Fallen normal/attack rolls'), 'Use inherited war cry, SkeletonMelee decision, or forced Attack-goal action.', 'Hidden or quest-gated calls do not delegate.')],
    distances: [distance('combat distances', 'same as Fallen normal/attack and SkeletonMelee', 'Used only while visible after the banner quest gate.')],
    attacks: [attack('melee', 'none', 'Inherited Fallen behavior.'), attack('heal', 'none', 'Inherited Fallen war cry.')],
    movement: 'The routine does not delegate before the quest transition or while hidden; while visible afterward, Normal inherits SkeletonMelee and Attack forces approach. SEARCH path planning may pre-empt the routine.',
    // monster.cpp:2630-2667,4450-4467 — M_FallenFear accepts only the Fallen AI identifier.
    special: 'Quest completion changes the map and activates visible-tile delegation. Snotspill can war-cry but never receives the death-triggered Fallen Retreat goal; common pack rules apply.', hellfire: false,
  },
  Snake: {
    lawId: 'd1-ai-snake-law', states: ['Stand decision gate', 'Delay', 'Walk', 'Charge', 'MeleeAttack'],
    rolls: [roll('At range without an eligible charge and not after Delay', linear(2, 65), 'Advance in the drift pattern.', 'Pause (15-i) plus 0-9 ticks.', { base: 15, perIntelligence: 1, randomMax: 9 }), roll('Adjacent and not after Delay or Charge', linear(1, 20), 'Normal melee.', 'Pause (10-i) plus 0-9 ticks.', { base: 10, perIntelligence: 1, randomMax: 9 }), roll('Previous mode is Delay or Charge', expression('forced; no roll'), 'Move at range or attack adjacent.', 'Not applicable.')],
    distances: [distance('adjacent', 'd < 2', 'Attack or delay.'), distance('charge distance', 'd = 2', 'Charge if clear and not just after Charge.')],
    attacks: [attack('special', 'Rhino', 'Exactly 2 tiles away with a clear route.'), attack('melee', 'none', 'Adjacent roll or forced action.')],
    movement: 'Right, right, straight, left, left, straight drift corrected toward the target; if the selected step is blocked, RandomWalk2 tries straight and then the two 45-degree fallbacks. SEARCH may pathfind first.', special: 'Charge collision does not shove; common pack rules apply.', hellfire: false,
  },
  Counselor: {
    lawId: 'd1-ai-counselor-law', states: ['Stand decision gate', 'Normal goal', 'Move/circle goal', 'Retreat goal', 'FadeIn', 'FadeOut', 'Delay', 'Walk', 'RangedAttack'],
    rolls: [
      roll('Normal goal at range', expression('5*(i+10)% and line-clear'), 'Cast the spell indexed by intelligence.', 'Draw an independent second roll.'),
      roll('Ranged cast failed', expression('30%'), 'Fade out and enter Move goal.', 'Pause (10-2*i) plus 0-9 ticks.', { base: 10, perIntelligence: 2, randomMax: 9 }),
      roll('Healthy and adjacent, not immediately after Delay', linear(2, 20), 'Create both Flash missiles.', 'Pause (10-2*i) plus 0-9 ticks.', { base: 10, perIntelligence: 2, randomMax: 9 }),
      roll('Healthy and adjacent immediately after Delay', expression('forced; no roll'), 'Create both Flash missiles.', 'Not applicable.'),
    ],
    distances: [distance('adjacent', 'd < 2', 'Retreat if wounded; otherwise flash or delay.'), distance('range', 'd >= 2', 'Spell, fade/circle or delay.'), distance('retreat duration', 'four attempted RandomWalk AI calls', 'Prefer away on each call, counting blocked attempts, then fade in.')],
    attacks: [attack('missile', 'Firebolt|ChargedBolt|LightningControl|Fireball', 'Line-clear ranged cast threshold, selected by intelligence 0-3.'), attack('special', 'FlashBottom+FlashTop', 'Healthy adjacency: forced after Delay, otherwise on the adjacent roll.')],
    movement: 'Move goal circles; wounded adjacent state fades and retreats. SEARCH may pathfind first.', special: 'ChargedBolt creates three bolts; still-standing outcomes pause 5-14 ticks; common pack rules apply.', hellfire: false,
  },
  Mega: {
    lawId: 'd1-ai-mega-law', states: ['Stand decision gate', 'Normal goal', 'Move/circle goal', 'Delay', 'Walk', 'SpecialRangedAttack', 'MeleeAttack'],
    rolls: [
      roll('At 5 or more tiles', expression('SkeletonMelee rolls'), 'Use inherited action.', 'Use inherited delay.'),
      roll('Closer than 5 tiles while circling', expression('5*(i+16)%'), 'Attempt a circle step and mark the forced-cast state.', 'Mark the forced-cast state, remain in Move, and pause 5-14 ticks if no step starts.', { base: 5, perIntelligence: 0, randomMax: 9 }),
      roll('Normal goal closer than 5 tiles', expression('line-clear and 5*(i+2)% at d>=3, 5*(i+1)% closer, or forced-cast marker'), 'Cast InfernoControl.', 'Test movement or melee.'),
      roll('Normal goal, 2 <= d < 5', expression('10*i+50%, or 10*i+80% immediately after moving'), 'Approach.', 'Pause 5-14 ticks.', { base: 5, perIntelligence: 0, randomMax: 9 }),
      roll('Normal goal, adjacent', expression('10*(i+4)%, then a fair bit'), 'Cast Inferno or use melee.', 'Pause 5-14 ticks.', { base: 5, perIntelligence: 0, randomMax: 9 }),
    ],
    distances: [distance('adjacent', 'd < 2', 'Inferno or melee.'), distance('close range', '2 <= d < 5', 'Circle, cast or approach.'), distance('far range', 'd >= 5', 'Delegate to SkeletonMelee.')],
    attacks: [attack('missile', 'InfernoControl', 'Line-clear threshold or forced marker, plus half of successful adjacent 10*(i+4)% actions.'), attack('melee', 'none', 'The other half of successful adjacent 10*(i+4)% actions.')],
    movement: 'Within 5 tiles it circles from 3 or more; leaving circle forces line-clear Inferno. Otherwise it approaches. SEARCH may pathfind first.', special: 'Still-standing outcomes pause 5-14 ticks; common pack rules apply.', hellfire: false,
  },
  Diablo: {
    lawId: 'd1-ai-ranged-avoidance-law', states: ['Stand decision gate', 'Normal goal', 'Move/circle goal', 'Delay', 'Walk', 'SpecialRangedAttack', 'MeleeAttack'],
    rolls: [
      roll('Fully alert, same room, d >= 3', expression('one in four'), 'Enter the circle goal.', 'Remain normal.'),
      roll('Circling', linear(5, 5), 'Fire DiabloApocalypse with damage argument 40 when line-clear.', 'Attempt RoundWalk; if still standing, pause 5-14 ticks.'),
      roll('Normal goal at 3 or more tiles with a clear line', linear(5, 10), 'Fire DiabloApocalypse.', 'Redraw and approach.'),
      roll('Normal goal at 2 tiles with a clear line', linear(5, 5), 'Fire DiabloApocalypse.', 'Redraw and approach.'),
      roll('Normal goal, adjacent with a clear line, next band of the shared roll', linear(5, 55), 'Normal melee.', 'Pause 5-14 ticks.', { base: 5, perIntelligence: 0, randomMax: 9 }),
      roll('Normal goal, adjacent with a blocked line', linear(10, 60), 'Normal melee.', 'Pause 5-14 ticks.', { base: 5, perIntelligence: 0, randomMax: 9 }),
    ],
    distances: [distance('adjacent', 'd < 2', 'Possible melee.'), distance('far range', 'd >= 3', 'Higher apocalypse threshold and possible circling.')],
    attacks: [attack('missile', 'DiabloApocalypse', 'Line-clear ranged threshold with fixed argument 40.'), attack('melee', 'none', 'Adjacent next band when line-clear, or the full 10*i+60% threshold when line-blocked.')],
    movement: 'Circles at far range; every non-adjacent missed-shot branch approaches because of the scale mismatch. SEARCH may pathfind first.', special: 'Alert does not decay offscreen; common pack rules apply.', hellfire: false,
  },
  Lazarus: {
    lawId: 'd1-ai-lazarus-law', states: ['Stand decision gate', 'Talking/Inquiring quest goals', 'Normal goal', 'Retreat goal', 'Move/circle goal', 'FadeIn', 'FadeOut', 'Walk', 'RangedAttack'],
    rolls: [roll('Quest gate has released combat', expression('Counselor rolls'), 'Use inherited spell, flash, fade or movement.', 'Ignore any requested AI delay.')],
    distances: [distance('combat distances', 'same as Counselor', 'Used after encounter activation.')],
    attacks: [attack('missile', 'Firebolt|ChargedBolt|LightningControl|Fireball', 'Inherited Counselor spell.'), attack('special', 'FlashBottom+FlashTop', 'Inherited adjacent flash.')],
    movement: 'Quest states differ by game mode; after activation it inherits Counselor circle and retreat. SEARCH may pathfind first.', special: 'The shared delay helper returns immediately for Lazarus; common pack rules apply.', hellfire: false,
  },
  LazarusSuccubus: {
    lawId: 'd1-ai-lazarus-succubus-law', states: ['Stand decision gate', 'Talking/Inquiring quest goals', 'Normal goal', 'Delay', 'Walk', 'RangedAttack'],
    rolls: [roll('Previous mode was RangedAttack after the quest gate', expression('delay n in [0,19]'), 'A positive draw starts Delay; zero continues this AI call.', 'Not applicable.', { base: 0, perIntelligence: 0, randomMax: 19 }), roll('Goal is Normal, fully alert or monster-targeting, below 4 tiles', linear(10, 70), 'Attempt RandomWalk away.', 'Remain standing.'), roll('Goal is Normal, fully alert or monster-targeting, and still standing', expression('no random shot roll; clear line required'), 'Fire BloodStar.', 'Idle.')],
    distances: [distance('retreat band', 'd < 4', 'May retreat after activation.', 4), distance('shot range', 'any d', 'When fully alert or monster-targeting after activation, fire whenever still standing and line-clear.')],
    attacks: [attack('missile', 'BloodStar', 'Goal Normal, fully alert or monster-targeting, still standing, and line-clear.')],
    movement: 'Quest state suppresses combat; afterward it retreats close and approaches only while partially alert. SEARCH may pathfind first.', special: 'Common pack rules apply.', hellfire: false,
  },
  Lachdanan: {
    lawId: 'd1-ai-lachdanan-law', states: ['Stand decision gate', 'Talking/Inquiring quest goals', 'Death'], rolls: [], distances: [],
    attacks: [attack('none', 'none', 'No combat action; final speech causes scripted death.')], movement: 'None in this routine.',
    special: 'Final speech marks the quest done and invokes death.', hellfire: false,
  },
  Warlord: {
    lawId: 'd1-ai-warlord-law', states: ['Stand decision gate', 'Talking/Inquiring quest goals', 'Normal goal', 'Delay', 'Walk', 'MeleeAttack'],
    rolls: [roll('Goal becomes Normal after speech', expression('SkeletonMelee rolls'), 'Use inherited step or melee.', 'Use inherited delay.')],
    distances: [distance('combat distances', 'same as SkeletonMelee', 'Used after hostile transition.')],
    attacks: [attack('melee', 'none', 'Inherited successful or forced post-delay action.')],
    movement: 'No combat movement while quest-gated; afterward inherits SkeletonMelee approach. SEARCH may pathfind first.', special: 'Common pack rules apply.', hellfire: false,
  },
  HorkDemon: {
    lawId: 'd1-ai-hork-demon-law', states: ['Stand decision gate', 'Normal goal', 'Move/circle goal', 'Delay', 'Walk', 'SpecialRangedAttack', 'MeleeAttack'],
    rolls: [roll('At 5 or more tiles and not circling', expression('75%'), 'Circle for at most twice the distance.', 'Remain normal.'), roll('At 3 or more tiles', linear(2, 43), 'Attempt HorkSpawn; unavailable space or capacity idles.', 'Use the movement branch.'), roll('At range after no spawn and a completed move', linear(2, 83), 'Approach.', 'Pause 10-19 ticks.', { base: 10, perIntelligence: 0, randomMax: 9 }), roll('At range after no spawn otherwise', linear(2, 33), 'Approach.', 'Pause 10-19 ticks.', { base: 10, perIntelligence: 0, randomMax: 9 }), roll('Adjacent', linear(2, 28), 'Normal melee.', 'Idle.')],
    distances: [distance('adjacent', 'd < 2', 'Melee.'), distance('spawn range', 'd >= 3', 'May emit HorkSpawn.'), distance('circle range', 'd >= 5', 'Usually circles.')],
    attacks: [attack('summon', 'HorkSpawn', 'Roll succeeds and front tile/capacity permit; resource failure does not fall through.'), attack('melee', 'none', 'Adjacent attack roll.')],
    movement: 'Bounded circling or obstacle-tolerant approach; failures pause 10-19 ticks. SEARCH may pathfind first.', special: 'Hellfire-only; HorkSpawn creates a monster near its ending tile; common pack rules apply.', hellfire: true,
  },
} as const satisfies Record<string, AiRoutineSpec>;
