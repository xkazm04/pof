/** Engine-derived Diablo I hero movement and vanilla mouse/keyboard controls. */
import type { ProjectRule } from '@/lib/catalog/canon/types';
import type { InputSpecData, MovementSpecData } from '@/lib/catalog/reference/movementSpecs';

const PIN = 'https://github.com/diasurgical/devilutionX/blob/4138a82/Source/';

export const MOVEMENT_SPEC_DATA = {
  id: 'd1-movement-hero',
  name: 'Diablo I hero grid walk',
  grid: {
    topology: 'square',
    directions: [
      'Direction::North',
      'Direction::NorthEast',
      'Direction::East',
      'Direction::SouthEast',
      'Direction::South',
      'Direction::SouthWest',
      'Direction::West',
      'Direction::NorthWest',
    ],
    distancePerStepTiles: 1,
    source: 'Source/player.cpp:92-139; Source/engine/path.h:42-53',
  },
  timing: {
    ticksPerSecond: 20,
    ticksPerSecondName: 'Gameplay.tickRate default',
    walkTicksPerFrame: 1,
    walkTicksPerFrameName: 'Player::getAnimationFramesAndTicksPerFrame(player_graphic::Walk)',
    walkStartExtraTicks: 1,
    formula: 'tilesPerSecond = ticksPerSecond / (walkingFrames * walkTicksPerFrame + walkStartExtraTicks)',
    classFrameFields: ['animations.dungeon.walkingFrames', 'animations.town.walkingFrames'],
    source: 'Source/options.cpp:843; Source/player.cpp:143-163,1819-1830,2229-2246',
  },
  pathfinding: {
    algorithm: 'A* over PathDirs',
    constants: [
      { name: 'MaxPathLengthPlayer', value: 100, source: 'Source/engine/path.h:20' },
      { name: 'MaxPathNodes', value: 1024, source: 'Source/engine/path.cpp:37' },
      { name: 'PathAxisAlignedStepCost', value: 100, source: 'Source/engine/path.cpp:32' },
      { name: 'PathDiagonalStepCost', value: 101, source: 'Source/engine/path.cpp:33' },
    ],
    diagonalRule: 'CanStep rejects a diagonal-looking screen-grid transition when either flanking tile is solid; this prevents corner cutting.',
    destinationRule: 'FindPath may admit a blocked destination only as the destination; MakePlrPath truncates the last step for adjacent actions.',
    source: 'Source/engine/path.cpp:184-282; Source/levels/tile_properties.cpp:66-88; Source/player.cpp:3115-3130',
  },
  blockers: [
    { kind: 'bounds', rule: 'A destination outside dungeon bounds is rejected.', source: 'Source/player.cpp:3090-3094' },
    { kind: 'terrain', rule: 'A tile with TileProperties::Solid is not walkable.', source: 'Source/levels/tile_properties.cpp:10-37' },
    { kind: 'objects', rule: 'A solid object, including a closed solid door, blocks its tile.', source: 'Source/levels/tile_properties.cpp:29-37' },
    { kind: 'players', rule: 'Another living player occupying the tile blocks it.', source: 'Source/player.cpp:3095-3098' },
    { kind: 'monsters', rule: 'A living monster, any town monster/towner occupancy, or reserved negative monster occupancy blocks it.', source: 'Source/player.cpp:3100-3111' },
    { kind: 'corners', rule: 'CanStep tests solid flank tiles before the step is admitted.', source: 'Source/levels/tile_properties.cpp:66-88' },
  ],
  interruptions: [
    { event: 'new walk destination', effect: 'Clear the old walk path, build a replacement path, and clear the pending contextual action.', source: 'Source/msg.cpp:1207-1217' },
    { event: 'standing/ranged attack or spell command', effect: 'Clear the walk path before queuing the action.', source: 'Source/msg.cpp:1664-1769,1834-1899' },
    { event: 'context target reached', effect: 'Clear the path and start attack/talk/interact/pick-up when its adjacency rule is met.', source: 'Source/player.cpp:1094-1329' },
    { event: 'next step becomes illegal', effect: 'StartWalk remains standing; the pending destination action is then cleared.', source: 'Source/player.cpp:105-163,1198-1205' },
    { event: 'level transition', effect: 'Clear path and destination action.', source: 'Source/player.cpp:374-394' },
  ],
  heldWalk: {
    rule: 'Holding the mouse repeats CMD_WALKXY toward the current cursor position.',
    source: 'Source/track.cpp:20-32',
  },
  speedOptions: {
    vanillaSprint: false,
    vanillaStamina: false,
    runInTown: 'excluded from base Diablo I; the pinned option says it was introduced in the expansion',
    variableTickRate: 'DevilutionX port option; vanilla timing remains the default engine rate',
    source: 'Source/options.h:572-575; Source/options.cpp:843-844; Source/player.cpp:143-150',
  },
  refs: [
    `${PIN}player.cpp#L92-L163`,
    `${PIN}player.cpp#L1094-L1210`,
    `${PIN}player.cpp#L3090-L3130`,
    `${PIN}engine/path.h#L19-L53`,
    `${PIN}engine/path.cpp#L32-L37`,
    `${PIN}engine/path.cpp#L184-L282`,
    `${PIN}levels/tile_properties.cpp#L29-L88`,
    `${PIN}track.cpp#L20-L32`,
  ],
} as const satisfies MovementSpecData;

export const INPUT_SPEC_DATA = {
  id: 'd1-input-vanilla',
  name: 'Diablo I vanilla mouse and keyboard',
  deviceFamily: 'mouse-keyboard',
  bindings: [
    { input: 'Left mouse button', context: 'town world', action: 'Pick up an item, talk to a town NPC, or walk to an otherwise empty cursor tile.', source: 'Source/diablo.cpp:247-264' },
    { input: 'Left mouse button', context: 'dungeon world', action: 'Contextually pick up an item, operate/disarm an object, attack/talk to a monster, attack a hostile player, or walk to empty ground.', source: 'Source/diablo.cpp:266-317' },
    { input: 'Shift + left mouse button', context: 'dungeon world', action: 'Attack in place toward the cursor; a nearby breakable object remains operable by attack.', source: 'Source/diablo.cpp:270-305' },
    { input: 'Right mouse button', context: 'world or inventory', action: 'Use the inventory item under the cursor; otherwise cast the readied spell, with Shift passed to spell targeting.', source: 'Source/diablo.cpp:441-479' },
    { input: 'Mouse hold', context: 'empty world ground', action: 'Repeat CMD_WALKXY toward the cursor while tracked walking remains valid.', source: 'Source/track.cpp:20-32' },
    { input: '1-8', context: 'gameplay', action: 'Use the corresponding non-gold belt item.', source: 'Source/diablo.cpp:1844-1860' },
    { input: 'F5-F8', context: 'speedbook open', action: 'Assign the selected spell to quick-spell slots 1-4.', source: 'Source/diablo.cpp:1861-1872' },
    { input: 'F5-F8', context: 'gameplay', action: 'Ready quick-spell slot 1-4; DevilutionX quick-cast is excluded as port-added behavior.', source: 'Source/diablo.cpp:1861-1880' },
    { input: 'S', context: 'gameplay', action: 'Open or close the speedbook spell selector.', source: 'Source/diablo.cpp:1914-1921' },
    { input: 'Tab', context: 'gameplay', action: 'Toggle the automap.', source: 'Source/diablo.cpp:1967-1974' },
    { input: 'I', context: 'gameplay', action: 'Open or close Inventory.', source: 'Source/diablo.cpp:1984-1991' },
    { input: 'C', context: 'gameplay', action: 'Open or close the Character panel.', source: 'Source/diablo.cpp:1992-1999' },
    { input: 'Q', context: 'gameplay', action: 'Open or close the Quest Log.', source: 'Source/diablo.cpp:2008-2015' },
    { input: 'B', context: 'gameplay', action: 'Open or close the Spellbook.', source: 'Source/diablo.cpp:2016-2023' },
    { input: 'Space', context: 'panels or overlays open', action: 'Close information panels and transient overlays.', source: 'Source/diablo.cpp:2033-2061' },
    { input: 'F1', context: 'gameplay', action: 'Open or close the static Help screen.', source: 'Source/diablo.cpp:2099-2106' },
    { input: 'F2', context: 'single-player gameplay', action: 'Quick save.', source: 'Source/diablo.cpp:1922-1930' },
    { input: 'F3', context: 'single-player gameplay', action: 'Quick load.', source: 'Source/diablo.cpp:1931-1939' },
  ],
  contexts: [
    { id: 'gameplay', rule: 'World clicks and gameplay hotkeys are active while the hero can act.' },
    { id: 'panel', rule: 'The same mouse buttons are routed to inventory, spellbook, character, quest, store, or main-panel handlers when the cursor is over an open panel.' },
    { id: 'modal', rule: 'Menus, stores, pause, death, spell selection, and quest text consume or suppress world actions.' },
  ],
  help: {
    style: 'static F1 help screen',
    contextualPrompts: false,
    source: 'Source/diablo.cpp:1620-1644,2099-2106',
  },
  exclusions: [
    { feature: 'gamepad and touch schemes', reason: 'port-added device support, outside the vanilla mouse/keyboard entity', source: 'Source/controls/controller_motion.cpp; Source/controls/touch/' },
    { feature: 'conflict-aware rebinding UI', reason: 'DevilutionX Keymapper is a port facility, not a vanilla Diablo binding screen', source: 'Source/diablo.cpp:1841-2144' },
    { feature: 'quick cast and mouse-wheel spell cycling', reason: 'port-added alternatives; vanilla F5-F8 ready spells rather than casting on selection', source: 'Source/diablo.cpp:1861-1897' },
    { feature: 'analog deadzones and haptics', reason: 'not applicable to the vanilla mouse/keyboard scheme', source: 'Source/controls/' },
  ],
  refs: [
    `${PIN}diablo.cpp#L247-L317`,
    `${PIN}diablo.cpp#L334-L479`,
    `${PIN}diablo.cpp#L1841-L2106`,
    `${PIN}track.cpp#L20-L32`,
  ],
} as const satisfies InputSpecData;

export const MOVEMENT_LAWS_DATA = [
  {
    id: 'd1-player-walk-law', title: 'Hero grid-walk law', scope: 'player-movement',
    body: 'Hero walking, derived from the engine: a path is consumed as one-tile steps in eight directions. Each class supplies dungeon and town walk-frame counts; walk frames run at the engine player-walk rate, with the walk-start scheduling tick included. A solid tile or object, a living actor, a blocked corner, a new action, or a level change prevents, replaces, or ends the route.',
    refs: [`${PIN}player.cpp#L92-L163`, `${PIN}player.cpp#L1094-L1210`, `${PIN}player.cpp#L3090-L3130`],
  },
  {
    id: 'd1-pathfinding-law', title: 'Hero pathfinding law', scope: 'player-movement',
    body: 'Pathfinding, derived from the pinned port: FindPath runs A* over eight directions and CanStep rejects corner cutting past solid flank tiles. The pin caps a hero path at MaxPathLengthPlayer (100) and monsters at MaxPathLengthMonsters (25), with axis steps costing 100 and diagonals 101 - port-tuned values; the 1996 limits are not provable at the pin. Only endspace=false paths drop the final step; non-solid, non-door object paths can pass true.',
    refs: [`${PIN}engine/path.h#L19-L53`, `${PIN}engine/path.cpp#L32-L37`, `${PIN}engine/path.cpp#L184-L282`, `${PIN}levels/tile_properties.cpp#L66-L88`],
  },
  {
    id: 'd1-click-context-law', title: 'Vanilla click-context control law', scope: 'input-schemes',
    body: 'Vanilla mouse/keyboard input, derived from the engine: left-click context chooses walk, target attack, talk, object use/disarm, or item pickup; Shift-left attacks in place except on an adjacent breakable object. Right-click uses an inventory item or casts the readied spell. Keys 1-8 use belt slots. F5-F8 assign spells in the selector, then ready or quick-cast them. S, Tab, I, C, Q, B, Space and F1 keep their classic controls.',
    refs: [`${PIN}diablo.cpp#L247-L317`, `${PIN}diablo.cpp#L441-L479`, `${PIN}diablo.cpp#L1841-L2106`, `${PIN}track.cpp#L20-L32`],
  },
] as const;

/** Laws live beside the data so the canon imports them without a cycle through the seeding module. */
export const DIABLO1_MOVEMENT_LAWS: readonly ProjectRule[] = MOVEMENT_LAWS_DATA.map((law) => ({
  ...law,
  profile: 'diablo1',
  category: 'game',
  refs: [...law.refs],
}));
