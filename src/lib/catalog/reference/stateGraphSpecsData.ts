/** Engine-derived Diablo I actor mode graphs. No reference-table rows are copied here. */
import type { ProjectRule } from '@/lib/catalog/canon/types';
import type {
  StateGraphPersistenceData,
  StateGraphSpecData,
  StateGraphStateData,
  StateGraphTransitionData,
} from '@/lib/catalog/reference/stateGraphSpecs';

type SourceReference = `.reference/devilutionX/Source/${string}`;

const refs = (...values: SourceReference[]): readonly string[] => values;

const state = (
  id: string,
  meaning: string,
  durationRule: string,
  sourceRefs: readonly string[],
  terminal = false,
): StateGraphStateData => ({ id, meaning, durationRule, refs: sourceRefs, ...(terminal ? { terminal } : {}) });

const transition = (
  from: string,
  to: string,
  trigger: string,
  sourceRefs: readonly string[],
): StateGraphTransitionData => ({ from, to, trigger, refs: sourceRefs });

const persistence = (
  field: string,
  saved: boolean,
  rationale: string,
  sourceRefs: readonly string[],
): StateGraphPersistenceData => ({ field, saved, rationale, refs: sourceRefs });

const MONSTER_GOAL_ENUM_REF = refs('.reference/devilutionX/Source/monster.h:121');

const MONSTER_STATES: readonly StateGraphStateData[] = [
  state('Stand', 'Stationary decision gate; AI routines may select the next action only in this mode.', 'Until an AI routine, damage, dialogue, petrification, or death starts another mode.', refs('.reference/devilutionX/Source/monster.h:76', '.reference/devilutionX/Source/monster.cpp:3168')),
  state('MoveNorthwards', 'One-tile walk whose facing is north, north-west, or north-east.', 'Walk animation frame count × its data-defined rate, including start-step scheduling; completes on the last frame.', refs('.reference/devilutionX/Source/monster.cpp:798', '.reference/devilutionX/Source/monster.cpp:1086')),
  state('MoveSouthwards', 'One-tile walk whose facing is south, south-west, or south-east.', 'Walk animation frame count × its data-defined rate, including start-step scheduling; completes on the last frame.', refs('.reference/devilutionX/Source/monster.cpp:807', '.reference/devilutionX/Source/monster.cpp:1086')),
  state('MoveSideways', 'One-tile walk whose facing is east or west.', 'Walk animation frame count × its data-defined rate, including start-step scheduling; completes on the last frame.', refs('.reference/devilutionX/Source/monster.cpp:802', '.reference/devilutionX/Source/monster.cpp:1086')),
  state('MeleeAttack', 'Normal melee attack; its data-defined action frame performs the hit roll.', 'Attack animation frame count × its data-defined rate; completes on the last frame.', refs('.reference/devilutionX/Source/monster.cpp:823', '.reference/devilutionX/Source/monster.cpp:1271')),
  state('HitRecovery', 'Got-hit animation that suspends ordinary AI after a qualifying hard hit.', 'GotHit animation frame count × its data-defined rate; completes on the last frame.', refs('.reference/devilutionX/Source/monster.cpp:661', '.reference/devilutionX/Source/monster.cpp:1470')),
  state('Death', 'Terminal death processing; ordinary monsters become corpses and invalid actors.', 'Terminal: death animation to its final frame, followed by corpse/invalidation; no mode transition follows.', refs('.reference/devilutionX/Source/monster.cpp:1498', '.reference/devilutionX/Source/monster.cpp:3996'), true),
  state('SpecialMeleeAttack', 'Special animation used for a special strike, corpse eating, and the gargoyle statue handoff.', 'Special animation frame count × its data-defined rate; completes on the last frame.', refs('.reference/devilutionX/Source/monster.cpp:858', '.reference/devilutionX/Source/monster.cpp:1362')),
  state('FadeIn', 'Special animation that reveals a hidden monster, forward or backwards.', 'Until the special animation reaches the endpoint selected by the animation-lock direction.', refs('.reference/devilutionX/Source/monster.cpp:1017', '.reference/devilutionX/Source/monster.cpp:1376')),
  state('FadeOut', 'Special animation that hides a monster, forward or backwards.', 'Until the special animation reaches the endpoint selected by the animation-lock direction.', refs('.reference/devilutionX/Source/monster.cpp:1030', '.reference/devilutionX/Source/monster.cpp:1389')),
  state('RangedAttack', 'Normal attack animation that creates its stored missile on the action frame.', 'Attack animation frame count × its data-defined rate; completes on the last frame.', refs('.reference/devilutionX/Source/monster.cpp:832', '.reference/devilutionX/Source/monster.cpp:1298')),
  state('SpecialStand', 'Stationary special animation, including a Fallen war cry or summon stance.', 'Special animation frame count × its data-defined rate; completes on the last frame.', refs('.reference/devilutionX/Source/monster.cpp:777', '.reference/devilutionX/Source/monster.cpp:1529')),
  state('SpecialRangedAttack', 'Special animation that creates its stored missile on the special action frame.', 'Special animation frame count × its data-defined rate; completes on the last frame.', refs('.reference/devilutionX/Source/monster.cpp:843', '.reference/devilutionX/Source/monster.cpp:1329')),
  state('Delay', 'AI pause using the stand graphic while a mode variable counts down.', 'Fixed by the caller: the stored delay counter plus the update that observes zero.', refs('.reference/devilutionX/Source/monster.cpp:755', '.reference/devilutionX/Source/monster.cpp:1542')),
  state('Charge', 'Missile-driven Rhino/Snake/bat movement; ordinary mode dispatch does not advance it.', 'Until the driving Rhino missile reaches an obstruction or its route condition ends.', refs('.reference/devilutionX/Source/monster.cpp:2291', '.reference/devilutionX/Source/monster.cpp:4580')),
  state('Petrified', 'Stone Curse freezes mode dispatch and animation while a missile remembers the prior mode.', 'Until the owning Stone Curse missile expires/removes, or death invalidates the petrified monster in place.', refs('.reference/devilutionX/Source/monster.cpp:4916', '.reference/devilutionX/Source/monster.cpp:1560')),
  state('Heal', 'Gargoyle reverse special animation that restores health in chunks.', 'Until maximum health is reached; then it hands off to SpecialMeleeAttack.', refs('.reference/devilutionX/Source/monster.cpp:1051', '.reference/devilutionX/Source/monster.cpp:1412')),
  state('Talk', 'One-update quest interaction mode that starts the speech and dialogue goal.', 'One mode-dispatch update; MonsterTalk immediately starts Stand and sets the Talking goal.', refs('.reference/devilutionX/Source/monster.cpp:1427', '.reference/devilutionX/Source/monster.cpp:4747')),
];

const MONSTER_ACTION_STARTS: readonly StateGraphTransitionData[] = [
  transition('Stand', 'MoveNorthwards', 'AI selects a legal north-facing walk direction.', refs('.reference/devilutionX/Source/monster.cpp:793')),
  transition('Stand', 'MoveSouthwards', 'AI selects a legal south-facing walk direction.', refs('.reference/devilutionX/Source/monster.cpp:793')),
  transition('Stand', 'MoveSideways', 'AI selects a legal east/west walk direction.', refs('.reference/devilutionX/Source/monster.cpp:793')),
  transition('Stand', 'MeleeAttack', 'A standing AI selects its normal adjacent attack.', refs('.reference/devilutionX/Source/monster.cpp:823')),
  transition('Stand', 'SpecialMeleeAttack', 'A standing AI selects a special melee/eating action, or gargoyle pack activation releases its statue state.', refs('.reference/devilutionX/Source/monster.cpp:251', '.reference/devilutionX/Source/monster.cpp:858', '.reference/devilutionX/Source/monster.cpp:867', '.reference/devilutionX/Source/monster.cpp:1693', '.reference/devilutionX/Source/monster.cpp:1726', '.reference/devilutionX/Source/monster.cpp:4980')),
  transition('Stand', 'FadeIn', 'A hidden Sneak/Counselor is close enough, or retreat completes.', refs('.reference/devilutionX/Source/monster.cpp:1017', '.reference/devilutionX/Source/monster.cpp:2555')),
  transition('Stand', 'FadeOut', 'A visible Sneak/Counselor is far enough or begins its move goal.', refs('.reference/devilutionX/Source/monster.cpp:1030', '.reference/devilutionX/Source/monster.cpp:2558')),
  transition('Stand', 'RangedAttack', 'A standing ranged AI has a clear line and selects its normal missile.', refs('.reference/devilutionX/Source/monster.cpp:832', '.reference/devilutionX/Source/monster.cpp:1999')),
  transition('Stand', 'SpecialStand', 'A standing AI selects its stationary special action.', refs('.reference/devilutionX/Source/monster.cpp:777', '.reference/devilutionX/Source/monster.cpp:2337')),
  transition('Stand', 'SpecialRangedAttack', 'A standing AI selects its special missile action.', refs('.reference/devilutionX/Source/monster.cpp:843', '.reference/devilutionX/Source/monster.cpp:1997')),
  transition('Stand', 'Delay', 'The AI chooses a positive pause and stores its countdown.', refs('.reference/devilutionX/Source/monster.cpp:755')),
  transition('Stand', 'Charge', 'Rhino, bat, or snake AI creates a clear-route Rhino missile.', refs('.reference/devilutionX/Source/monster.cpp:2286', '.reference/devilutionX/Source/monster.cpp:2454', '.reference/devilutionX/Source/monster.cpp:2678')),
  transition('Stand', 'Heal', 'A wounded gargoyle retreat reaches sufficient clearance.', refs('.reference/devilutionX/Source/monster.cpp:2497', '.reference/devilutionX/Source/monster.cpp:1051')),
  transition('Stand', 'Talk', 'A player interacts with an eligible quest monster.', refs('.reference/devilutionX/Source/monster.cpp:4747')),
  transition('Stand', 'Talk', 'A visible scripted quest gate starts Lazarus or Warlord speech.', refs('.reference/devilutionX/Source/monster.cpp:2894', '.reference/devilutionX/Source/monster.cpp:2911', '.reference/devilutionX/Source/monster.cpp:2993')),
];

const MONSTER_COMPLETIONS: readonly StateGraphTransitionData[] = [
  ...['MoveNorthwards', 'MoveSouthwards', 'MoveSideways'].map((from) => transition(from, 'Stand', 'Walk animation reaches its last frame and commits the destination tile.', refs('.reference/devilutionX/Source/monster.cpp:1086'))),
  transition('MeleeAttack', 'Stand', 'Attack animation reaches its last frame.', refs('.reference/devilutionX/Source/monster.cpp:1271')),
  transition('SpecialMeleeAttack', 'Stand', 'Special attack animation reaches its last frame.', refs('.reference/devilutionX/Source/monster.cpp:1362')),
  transition('FadeIn', 'Stand', 'Fade animation reaches its selected endpoint; hidden is cleared.', refs('.reference/devilutionX/Source/monster.cpp:1376')),
  transition('FadeOut', 'Stand', 'Fade animation reaches its selected endpoint; hidden is set.', refs('.reference/devilutionX/Source/monster.cpp:1389')),
  transition('RangedAttack', 'Stand', 'Ranged attack animation reaches its last frame.', refs('.reference/devilutionX/Source/monster.cpp:1298')),
  transition('SpecialStand', 'Stand', 'Stationary special animation reaches its last frame.', refs('.reference/devilutionX/Source/monster.cpp:1529')),
  transition('SpecialRangedAttack', 'Stand', 'Special ranged animation reaches its last frame.', refs('.reference/devilutionX/Source/monster.cpp:1329')),
  transition('Delay', 'Stand', 'The delay update observes the stored countdown at zero.', refs('.reference/devilutionX/Source/monster.cpp:1542')),
  transition('Charge', 'Stand', 'The driving missile reaches an obstruction and returns control to the monster.', refs('.reference/devilutionX/Source/monster.cpp:4580')),
  transition('Heal', 'SpecialMeleeAttack', 'Healing reaches maximum health and releases the locked special animation.', refs('.reference/devilutionX/Source/monster.cpp:1412')),
  transition('Talk', 'Stand', 'MonsterTalk begins by restoring Stand before it starts dialogue.', refs('.reference/devilutionX/Source/monster.cpp:1427')),
];

const MONSTER_DAMAGE_INTERRUPTIBLE = [
  'Stand', 'MoveNorthwards', 'MoveSouthwards', 'MoveSideways', 'MeleeAttack', 'HitRecovery',
  'SpecialMeleeAttack', 'FadeIn', 'FadeOut', 'RangedAttack', 'SpecialStand',
  'SpecialRangedAttack', 'Delay', 'Heal',
] as const;

const MONSTER_LETHAL_SOURCES = MONSTER_STATES
  .map((candidate) => candidate.id)
  .filter((id) => id !== 'Death' && id !== 'Petrified');

const MONSTER_PETRIFIABLE = [
  'Stand', 'MoveNorthwards', 'MoveSouthwards', 'MoveSideways', 'MeleeAttack', 'HitRecovery',
  'SpecialMeleeAttack', 'RangedAttack', 'SpecialStand', 'SpecialRangedAttack', 'Delay', 'Heal', 'Talk',
] as const;

const MONSTER_TRANSITIONS: readonly StateGraphTransitionData[] = [
  ...MONSTER_ACTION_STARTS,
  ...MONSTER_COMPLETIONS,
  ...MONSTER_DAMAGE_INTERRUPTIBLE.map((from) => transition(from, 'HitRecovery', 'A qualifying hard hit starts or restarts the GotHit animation.', refs('.reference/devilutionX/Source/monster.cpp:661', '.reference/devilutionX/Source/monster.cpp:3963'))),
  ...MONSTER_LETHAL_SOURCES.map((from) => transition(from, 'Death', 'Lethal damage or a scripted kill starts death processing.', refs('.reference/devilutionX/Source/monster.cpp:875', '.reference/devilutionX/Source/monster.cpp:3996'))),
  ...MONSTER_PETRIFIABLE.map((from) => transition(from, 'Petrified', 'An eligible Stone Curse missile saves this prior mode and calls Monster::petrify.', refs('.reference/devilutionX/Source/missiles.cpp:2363', '.reference/devilutionX/Source/monster.cpp:4916'))),
  ...MONSTER_PETRIFIABLE.map((to) => transition('Petrified', to, `Stone Curse ends while alive and restores saved mode ${to}.`, refs('.reference/devilutionX/Source/missiles.cpp:3698', '.reference/devilutionX/Source/player.cpp:2888'))),
];

const MONSTER_GOAL_STATES: readonly StateGraphStateData[] = [
  state('Normal', 'Default AI objective.', 'Until an AI-specific condition selects another goal.', MONSTER_GOAL_ENUM_REF),
  state('Retreat', 'AI-specific withdrawal or fear objective.', 'Until that routine reaches its distance, move-count, fade, or healing condition.', refs('.reference/devilutionX/Source/monster.cpp:2326', '.reference/devilutionX/Source/monster.cpp:2441')),
  state('Healing', 'Scavenger corpse-seeking/eating objective.', 'Until its search budget ends or healing condition is satisfied.', refs('.reference/devilutionX/Source/monster.cpp:2204')),
  state('Move', 'Bounded circling/repositioning objective.', 'Until its AI-specific decision counter expires or an action ends it.', refs('.reference/devilutionX/Source/monster.cpp:1905')),
  state('Attack', 'Forced Fallen approach/attack objective after a war cry.', 'Until its goal decision counter expires.', refs('.reference/devilutionX/Source/monster.cpp:2316', '.reference/devilutionX/Source/monster.cpp:2356')),
  state('Inquiring', 'Quest monster is available for the next player conversation.', 'Until player interaction starts Talk mode.', refs('.reference/devilutionX/Source/monster.cpp:3353')),
  state('Talking', 'Quest speech has started and its AI waits for script-specific continuation.', 'Until speech/visibility/quest conditions return to Inquiring or release combat.', refs('.reference/devilutionX/Source/monster.cpp:1427', '.reference/devilutionX/Source/monster.cpp:2578')),
];

const MONSTER_GOAL_TRANSITIONS: readonly StateGraphTransitionData[] = [
  transition('Normal', 'Retreat', 'A type-specific fear, wounded, or post-attack rule starts retreat.', refs('.reference/devilutionX/Source/monster.cpp:2470', '.reference/devilutionX/Source/monster.cpp:2497', '.reference/devilutionX/Source/monster.cpp:4464')),
  transition('Retreat', 'Normal', 'The owning AI reaches its retreat exit condition.', refs('.reference/devilutionX/Source/monster.cpp:2328', '.reference/devilutionX/Source/monster.cpp:2447', '.reference/devilutionX/Source/monster.cpp:2500')),
  transition('Normal', 'Healing', 'A scavenger drops below half health and begins its corpse-search budget.', refs('.reference/devilutionX/Source/monster.cpp:2204')),
  transition('Healing', 'Normal', 'Corpse search/healing finishes or exhausts its budget.', refs('.reference/devilutionX/Source/monster.cpp:2231')),
  transition('Normal', 'Move', 'An avoidance AI begins a bounded circle/reposition action.', refs('.reference/devilutionX/Source/monster.cpp:1905', '.reference/devilutionX/Source/monster.cpp:2028')),
  transition('Move', 'Normal', 'The movement goal counter expires or the AI commits another action.', refs('.reference/devilutionX/Source/monster.cpp:1912', '.reference/devilutionX/Source/monster.cpp:2035')),
  transition('Normal', 'Attack', 'A Fallen war cry assigns nearby Fallen the forced attack goal.', refs('.reference/devilutionX/Source/monster.cpp:2356')),
  transition('Attack', 'Normal', 'The forced attack goal counter expires.', refs('.reference/devilutionX/Source/monster.cpp:2316')),
  transition('Normal', 'Inquiring', 'A unique quest monster is initialized with a talk message.', refs('.reference/devilutionX/Source/monster.cpp:3353')),
  transition('Inquiring', 'Talking', 'Player interaction enters Talk mode; MonsterTalk starts the speech.', refs('.reference/devilutionX/Source/monster.cpp:1427', '.reference/devilutionX/Source/monster.cpp:4747')),
  transition('Talking', 'Inquiring', 'A quest script advances to another conversation after visibility/speech conditions.', refs('.reference/devilutionX/Source/monster.cpp:2586', '.reference/devilutionX/Source/monster.cpp:2638')),
  transition('Talking', 'Normal', 'The final quest speech releases the monster into combat.', refs('.reference/devilutionX/Source/monster.cpp:2612', '.reference/devilutionX/Source/monster.cpp:2643')),
];

const PLAYER_STATES: readonly StateGraphStateData[] = [
  state('PM_STAND', 'Stationary input and queued-action gate.', 'Until input, impact, death, level transfer, or quit starts another mode.', refs('.reference/devilutionX/Source/player.h:109', '.reference/devilutionX/Source/player.cpp:2590')),
  state('PM_WALK_NORTHWARDS', 'One-tile player walk facing north, north-west, or north-east.', 'Walk animation frame count at one tick per frame, adjusted by start-step scheduling.', refs('.reference/devilutionX/Source/player.cpp:97', '.reference/devilutionX/Source/player.cpp:403')),
  state('PM_WALK_SOUTHWARDS', 'One-tile player walk facing south, south-west, or south-east.', 'Walk animation frame count at one tick per frame, adjusted by start-step scheduling.', refs('.reference/devilutionX/Source/player.cpp:94', '.reference/devilutionX/Source/player.cpp:403')),
  state('PM_WALK_SIDEWAYS', 'One-tile player walk facing east or west.', 'Walk animation frame count at one tick per frame, adjusted by start-step scheduling.', refs('.reference/devilutionX/Source/player.cpp:96', '.reference/devilutionX/Source/player.cpp:403')),
  state('PM_ATTACK', 'Melee attack; contact occurs at the class/weapon action frame.', 'Attack animation frames at one tick per frame, minus eligible pre-contact speed skips.', refs('.reference/devilutionX/Source/player.cpp:174', '.reference/devilutionX/Source/player.cpp:778')),
  state('PM_RATTACK', 'Bow/ranged attack; missile release occurs at the attack action frame.', 'Attack animation frames at one tick per frame, minus the applicable ranged speed skips.', refs('.reference/devilutionX/Source/player.cpp:206', '.reference/devilutionX/Source/player.cpp:855')),
  state('PM_BLOCK', 'Successful shield/staff block animation.', 'Block animation frame count × three ticks per frame, with last-frame and Fast Block skips.', refs('.reference/devilutionX/Source/player.cpp:951', '.reference/devilutionX/Source/player.cpp:2605')),
  state('PM_GOTHIT', 'Player hit-recovery animation after sufficient or forced impact.', 'Hit animation frames at one tick per frame, minus the best recovery item skip.', refs('.reference/devilutionX/Source/player.cpp:1031', '.reference/devilutionX/Source/player.cpp:2639')),
  state('PM_DEATH', 'Terminal player death animation and dead-player hold.', 'Terminal: death animation at its rate, then the final frame is held; no player update transition follows.', refs('.reference/devilutionX/Source/player.cpp:1046', '.reference/devilutionX/Source/player.cpp:2683'), true),
  state('PM_SPELL', 'Spell-casting animation; CastSpell runs at the class action marker.', 'Casting animation frames at one tick per frame; attack-speed effects do not skip them.', refs('.reference/devilutionX/Source/player.cpp:248', '.reference/devilutionX/Source/player.cpp:1007')),
  state('PM_NEWLVL', 'Level-loader handoff sentinel; ordinary per-mode processing is paused.', 'Until the destination level initializes the player as living Stand or loaded Death.', refs('.reference/devilutionX/Source/player.cpp:2483', '.reference/devilutionX/Source/player.cpp:2899')),
  state('PM_QUIT', 'Game/ending handoff sentinel; ordinary per-mode processing is paused.', 'Until the game loop exits and a later player initialization establishes a new mode.', refs('.reference/devilutionX/Source/gamemenu.cpp:109', '.reference/devilutionX/Source/monster.cpp:4133', '.reference/devilutionX/Source/player.cpp:3036')),
];

const PLAYER_ACTION_STARTS: readonly StateGraphTransitionData[] = [
  transition('PM_STAND', 'PM_WALK_NORTHWARDS', 'A legal north-facing walk command is handled.', refs('.reference/devilutionX/Source/player.cpp:124', '.reference/devilutionX/Source/player.cpp:140')),
  transition('PM_STAND', 'PM_WALK_SOUTHWARDS', 'A legal south-facing walk command is handled.', refs('.reference/devilutionX/Source/player.cpp:124', '.reference/devilutionX/Source/player.cpp:140')),
  transition('PM_STAND', 'PM_WALK_SIDEWAYS', 'A legal east/west walk command is handled.', refs('.reference/devilutionX/Source/player.cpp:124', '.reference/devilutionX/Source/player.cpp:140')),
  transition('PM_STAND', 'PM_ATTACK', 'A queued melee action starts when its target/direction is valid.', refs('.reference/devilutionX/Source/player.cpp:174', '.reference/devilutionX/Source/player.cpp:1214')),
  transition('PM_STAND', 'PM_RATTACK', 'A queued ranged action starts with its target coordinates.', refs('.reference/devilutionX/Source/player.cpp:206', '.reference/devilutionX/Source/player.cpp:1242')),
  transition('PM_STAND', 'PM_BLOCK', 'A successful incoming-hit block roll starts the block animation.', refs('.reference/devilutionX/Source/monster.cpp:1196', '.reference/devilutionX/Source/player.cpp:2605')),
  transition('PM_ATTACK', 'PM_BLOCK', 'A successful incoming-hit block roll may interrupt melee attack.', refs('.reference/devilutionX/Source/monster.cpp:1196', '.reference/devilutionX/Source/player.cpp:2605')),
  transition('PM_STAND', 'PM_SPELL', 'A queued spell passes its repeated validity check.', refs('.reference/devilutionX/Source/player.cpp:248', '.reference/devilutionX/Source/player.cpp:1258')),
  transition('PM_STAND', 'PM_NEWLVL', 'A stairs, set-level, town-warp, or portal handoff begins.', refs('.reference/devilutionX/Source/player.cpp:2899', '.reference/devilutionX/Source/player.cpp:2960')),
];

const PLAYER_COMPLETIONS: readonly StateGraphTransitionData[] = [
  ...['PM_WALK_NORTHWARDS', 'PM_WALK_SOUTHWARDS', 'PM_WALK_SIDEWAYS'].map((from) => transition(from, 'PM_STAND', 'Walk animation reaches its last frame and commits the destination tile.', refs('.reference/devilutionX/Source/player.cpp:403'))),
  transition('PM_ATTACK', 'PM_STAND', 'Attack animation reaches its last frame or the weapon breaks on contact.', refs('.reference/devilutionX/Source/player.cpp:778')),
  transition('PM_RATTACK', 'PM_STAND', 'Ranged attack animation reaches its last frame or the weapon breaks.', refs('.reference/devilutionX/Source/player.cpp:855')),
  transition('PM_BLOCK', 'PM_STAND', 'Block animation reaches its last frame.', refs('.reference/devilutionX/Source/player.cpp:951')),
  transition('PM_GOTHIT', 'PM_STAND', 'Hit-recovery animation reaches its last frame.', refs('.reference/devilutionX/Source/player.cpp:1031')),
  transition('PM_SPELL', 'PM_STAND', 'Casting animation reaches its last frame.', refs('.reference/devilutionX/Source/player.cpp:1007')),
  transition('PM_NEWLVL', 'PM_STAND', 'Destination-level initialization finds the player alive.', refs('.reference/devilutionX/Source/player.cpp:2483')),
  transition('PM_NEWLVL', 'PM_DEATH', 'Destination-level initialization loads a player with no life.', refs('.reference/devilutionX/Source/player.cpp:2483')),
  transition('PM_QUIT', 'PM_STAND', 'A later living-player initialization begins a new session.', refs('.reference/devilutionX/Source/player.cpp:2483')),
  transition('PM_ATTACK', 'PM_ATTACK', 'Held/queued melee input restarts attack at its repeat window.', refs('.reference/devilutionX/Source/player.cpp:1333')),
  transition('PM_RATTACK', 'PM_RATTACK', 'Held/queued ranged input restarts attack at its repeat window.', refs('.reference/devilutionX/Source/player.cpp:1364')),
  transition('PM_SPELL', 'PM_SPELL', 'Held/queued spell input restarts casting at its repeat window.', refs('.reference/devilutionX/Source/player.cpp:1380')),
];

const PLAYER_DAMAGE_INTERRUPTIBLE = [
  'PM_STAND', 'PM_WALK_NORTHWARDS', 'PM_WALK_SOUTHWARDS', 'PM_WALK_SIDEWAYS',
  'PM_ATTACK', 'PM_RATTACK', 'PM_BLOCK', 'PM_GOTHIT', 'PM_SPELL',
] as const;

const PLAYER_TRANSITIONS: readonly StateGraphTransitionData[] = [
  ...PLAYER_ACTION_STARTS,
  ...PLAYER_COMPLETIONS,
  ...PLAYER_DAMAGE_INTERRUPTIBLE.map((from) => transition(from, 'PM_GOTHIT', 'Sufficient or forced nonlethal impact starts/restarts hit recovery.', refs('.reference/devilutionX/Source/player.cpp:2639'))),
  ...PLAYER_DAMAGE_INTERRUPTIBLE.map((from) => transition(from, 'PM_DEATH', 'Life reaches zero and StartPlayerKill starts death mode.', refs('.reference/devilutionX/Source/player.cpp:2683', '.reference/devilutionX/Source/player.cpp:2825'))),
  ...PLAYER_STATES.filter((candidate) => candidate.id !== 'PM_DEATH' && candidate.id !== 'PM_QUIT').map((candidate) => transition(candidate.id, 'PM_QUIT', 'New-game or ending control sets the global quit handoff mode.', refs('.reference/devilutionX/Source/gamemenu.cpp:109', '.reference/devilutionX/Source/monster.cpp:4133'))),
];

export const STATE_GRAPH_SPECS_DATA = [
  {
    id: 'd1-state-monster',
    name: 'Diablo I Monster Modes',
    actor: 'monster',
    rootState: 'Stand',
    states: MONSTER_STATES,
    transitions: MONSTER_TRANSITIONS,
    goalOverlay: {
      rootState: 'Normal',
      states: MONSTER_GOAL_STATES,
      transitions: MONSTER_GOAL_TRANSITIONS,
    },
    persistence: [
      persistence('Monster::mode', true, 'SaveMonster writes the current MonsterMode and LoadMonster restores it.', refs('.reference/devilutionX/Source/loadsave.cpp:667', '.reference/devilutionX/Source/loadsave.cpp:1506')),
      persistence('Monster::goal and goalVar1/2/3', true, 'The behavioral goal and its routine-specific counters are serialized beside the mode.', refs('.reference/devilutionX/Source/loadsave.cpp:668', '.reference/devilutionX/Source/loadsave.cpp:1507')),
      persistence('Monster animation cursor and mode vars', true, 'Animation rate/frame counters and var1/2/3 are serialized so a finite mode can resume.', refs('.reference/devilutionX/Source/loadsave.cpp:1540')),
      persistence('UpdateModeStance completion result', false, 'The per-dispatch boolean only controls an immediate same-tick loop; it is recomputed and never stored on Monster.', refs('.reference/devilutionX/Source/monster.cpp:3165', '.reference/devilutionX/Source/monster.cpp:4326')),
    ],
    lawBody: 'Monster modes, derived from the engine: AI routines choose actions only while a monster is in Stand. Walk, attack, fade, special, hit-recovery, delay, charge and talk actions return control to Stand when their own completion rule fires; Heal first hands off to the special animation. Goals overlay those modes and are interpreted only by each AI. Death has no outgoing mode transition and is terminal.',
    refs: refs('.reference/devilutionX/Source/monster.h:76', '.reference/devilutionX/Source/monster.h:121', '.reference/devilutionX/Source/monster.cpp:3165', '.reference/devilutionX/Source/monster.cpp:3927'),
    hellfireNote: 'The pinned MonsterMode and MonsterGoal enums contain no Hellfire-only enumerator; Hellfire AI routines reuse these states.',
  },
  {
    id: 'd1-state-player',
    name: 'Diablo I Player Modes',
    actor: 'player',
    rootState: 'PM_STAND',
    states: PLAYER_STATES,
    transitions: PLAYER_TRANSITIONS,
    persistence: [
      persistence('Player::_pmode', true, 'SavePlayer writes the current PLR_MODE and LoadPlayer restores it.', refs('.reference/devilutionX/Source/loadsave.cpp:396', '.reference/devilutionX/Source/loadsave.cpp:1254')),
      persistence('Player animation cursor', true, 'Animation rate/frame counters are serialized so the active mode resumes at its saved frame.', refs('.reference/devilutionX/Source/loadsave.cpp:1296')),
      persistence('Queued path and destination action', true, 'The walk path and destination action parameters are saved beside the mode.', refs('.reference/devilutionX/Source/loadsave.cpp:1255', '.reference/devilutionX/Source/loadsave.cpp:1260')),
      persistence('ProcessPlayers tplayer completion flag', false, 'The local per-dispatch boolean only controls the immediate mode loop; it is recreated for every processed player and never serialized.', refs('.reference/devilutionX/Source/player.cpp:3034', '.reference/devilutionX/Source/player.cpp:3067')),
    ],
    lawBody: 'Player modes, derived from the engine: Stand accepts movement, melee, ranged and spell actions; their animations, Block and GotHit return to Stand on the last frame, while repeat windows may restart the same attack or spell. Damage and death can interrupt active modes. NewLvl and Quit hand control to outer game flow and initialization establishes the next mode. Death never returns from its update and is terminal.',
    refs: refs('.reference/devilutionX/Source/player.h:109', '.reference/devilutionX/Source/player.cpp:403', '.reference/devilutionX/Source/player.cpp:1007', '.reference/devilutionX/Source/player.cpp:3036'),
    hellfireNote: 'The pinned PLR_MODE enum contains no Hellfire-only enumerator; Hellfire classes and effects reuse these modes.',
  },
] as const satisfies readonly StateGraphSpecData[];

/** Laws live beside the data (not in stateGraphSpecs.ts) so the canon can import them without an import cycle. */
const pinned = (reference: string): string => {
  const match = /^\.reference\/devilutionX\/Source\/(.+?):(\d+)$/.exec(reference);
  return match
    ? `https://github.com/diasurgical/devilutionX/blob/4138a82/Source/${match[1]}#L${match[2]}`
    : reference;
};

export const DIABLO1_STATE_GRAPH_LAWS: readonly ProjectRule[] = STATE_GRAPH_SPECS_DATA.map((spec) => ({
  id: `${spec.id}-law`,
  profile: 'diablo1',
  category: 'game',
  scope: 'state-graph',
  title: `${spec.name} law (engine-derived)`,
  body: spec.lawBody,
  refs: spec.refs.map(pinned),
}));
