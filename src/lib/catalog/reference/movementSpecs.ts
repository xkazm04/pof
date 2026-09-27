/** Diablo I hero movement and vanilla input, derived from pinned engine code. */
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import type { IngestedEntity } from '@/lib/catalog/ingest/run';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { DIABLO1_MOVEMENT_LAWS, INPUT_SPEC_DATA, MOVEMENT_SPEC_DATA } from '@/lib/catalog/reference/movementSpecsData';

export interface EngineConstant {
  name: string;
  value: number;
  source: string;
}

export interface MovementSpecData {
  id: 'd1-movement-hero';
  name: string;
  grid: { topology: string; directions: readonly string[]; distancePerStepTiles: number; source: string };
  timing: {
    ticksPerSecond: number;
    ticksPerSecondName: string;
    walkTicksPerFrame: number;
    walkTicksPerFrameName: string;
    walkStartExtraTicks: number;
    formula: string;
    classFrameFields: readonly string[];
    source: string;
  };
  pathfinding: {
    algorithm: string;
    constants: readonly EngineConstant[];
    diagonalRule: string;
    destinationRule: string;
    source: string;
  };
  blockers: readonly { kind: string; rule: string; source: string }[];
  interruptions: readonly { event: string; effect: string; source: string }[];
  heldWalk: { rule: string; source: string };
  speedOptions: { vanillaSprint: boolean; vanillaStamina: boolean; runInTown: string; variableTickRate: string; source: string };
  refs: readonly string[];
}

export interface VanillaBinding {
  input: string;
  context: string;
  action: string;
  source: `Source/${string}:${number}-${number}`;
}

export interface InputSpecData {
  id: 'd1-input-vanilla';
  name: string;
  deviceFamily: 'mouse-keyboard';
  bindings: readonly VanillaBinding[];
  contexts: readonly { id: string; rule: string }[];
  help: { style: string; contextualPrompts: boolean; source: string };
  exclusions: readonly { feature: string; reason: string; source: string }[];
  refs: readonly string[];
}

export const DIABLO1_MOVEMENT_SPEC: MovementSpecData = MOVEMENT_SPEC_DATA;
export const DIABLO1_INPUT_SPEC: InputSpecData = INPUT_SPEC_DATA;

export { DIABLO1_MOVEMENT_LAWS };

interface WrappedClassLike {
  id: string;
  name?: string;
  data: Record<string, unknown>;
}

export interface HeroWalkSpeed {
  classId: string;
  className: string;
  area: 'dungeon' | 'town';
  walkingFrames: number;
  ticksPerFrame: number;
  ticksPerTile: number;
  tilesPerSecond: number;
}

function positiveNumber(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${field} must be a positive number`);
  return number;
}

/** Compute, never store, a class's one-tile walking speed from its aggregate class wrapper. */
export function deriveHeroWalkSpeed(hero: WrappedClassLike, area: 'dungeon' | 'town' = 'dungeon'): HeroWalkSpeed {
  const animations = hero.data.animations as Record<string, unknown> | undefined;
  const areaAnimation = animations?.[area] as Record<string, unknown> | undefined;
  const walkingFrames = positiveNumber(areaAnimation?.walkingFrames, `animations.${area}.walkingFrames`);
  const timing = DIABLO1_MOVEMENT_SPEC.timing;
  const ticksPerTile = walkingFrames * timing.walkTicksPerFrame + timing.walkStartExtraTicks;
  return {
    classId: hero.id,
    className: hero.name ?? hero.id,
    area,
    walkingFrames,
    ticksPerFrame: timing.walkTicksPerFrame,
    ticksPerTile,
    tilesPerSecond: timing.ticksPerSecond / ticksPerTile,
  };
}

const provenance = (sourceFile: string, sourceRow: string): IngestedEntity['provenance'] => ({
  kind: 'ingest',
  sourceGame: DIABLO1.game,
  sourceProject: DIABLO1.project,
  sourceFile,
  sourceRow,
  licenceNote: DIABLO1.licenceNote,
  ingestedAt: '2026-09-27T00:00:00.000Z',
  canonProfile: DIABLO1.canonProfile,
});

export interface MovementSpecWrapper { catalogId: 'player-movement'; entity: IngestedEntity }
export interface InputSpecWrapper { catalogId: 'input-schemes'; entity: IngestedEntity }

export function movementEntity(): MovementSpecWrapper {
  return {
    catalogId: 'player-movement',
    entity: {
      id: DIABLO1_MOVEMENT_SPEC.id,
      catalogId: 'player-movement',
      name: DIABLO1_MOVEMENT_SPEC.name,
      categoryPath: ['Diablo I', 'Engine movement'],
      tags: ['engine-derived', 'grid-walk', 'eight-direction'],
      lifecycle: 'planned',
      links: [
        { catalogId: 'characters', entityId: 'd1-class-warrior', role: 'timing-source' },
        { catalogId: 'characters', entityId: 'd1-class-rogue', role: 'timing-source' },
        { catalogId: 'characters', entityId: 'd1-class-sorcerer', role: 'timing-source' },
      ],
      data: {
        movementSpec: DIABLO1_MOVEMENT_SPEC,
        openQuestions: [
          'Mesh + Skeleton through Retarget Clips assume Manny, Mixamo FBX, IK, and generated UE animation assets; which target-side translation, if any, should replace Diablo directional sprites?',
          'Blend Space Grid and ABP_VSPlayer assume continuous skeletal blending; Diablo selects one of eight directional sprite walks.',
          'AM_Roll Montage and Playable Gate require dodge/roll, WASD, and sprint; vanilla Diablo has no jump, dodge, sprint, or stamina action.',
          'PoFEditor Build and the L4 playable capture are target-engine proof steps and cannot be established by the reference engine specification.',
        ],
      },
      provenance: provenance(
        'engine: Source/player.cpp, Source/engine/path.cpp, Source/engine/path.h, Source/levels/tile_properties.cpp, Source/track.cpp',
        'WalkSettings, StartWalk, CheckNewPath, PosOkPlayer, MakePlrPath, FindPath, CanStep',
      ),
    },
  };
}

export function inputEntity(): InputSpecWrapper {
  return {
    catalogId: 'input-schemes',
    entity: {
      id: DIABLO1_INPUT_SPEC.id,
      catalogId: 'input-schemes',
      name: DIABLO1_INPUT_SPEC.name,
      categoryPath: ['Diablo I', 'Vanilla controls'],
      tags: ['engine-derived', 'vanilla', 'mouse-keyboard'],
      lifecycle: 'planned',
      data: {
        inputSpec: DIABLO1_INPUT_SPEC,
        openQuestions: [
          'Action Mapping requires dodge and four fixed ability actions; vanilla has no dodge, and F5-F8 are assignable spell-selection slots rather than fixed abilities.',
          'Context Stack assumes UE mapping-context assets; vanilla routes the same mouse and keyboard through world, panel, store, menu, and modal state checks.',
          'Rebinding UI is absent in vanilla; DevilutionX Keymapper is port-added and must not be attributed to this entity.',
          'Deadzone & Haptics assumes analog input; gamepad, touch, rumble, and deadzone profiles are port-added and outside this mouse/keyboard scheme.',
          'Accessibility, Input Glyphs, Platform Cert, Test Gate, and UE Packaging require target-side evidence the source does not contain.',
          'Tutorial Prompts assumes contextual prompts; vanilla exposes an on-demand static F1 help screen.',
        ],
      },
      provenance: provenance(
        'engine: Source/diablo.cpp, Source/track.cpp',
        'LeftMouseCmd, LeftMouseDown, RightMouseDown, InitKeymapActions, TrackProcess',
      ),
    },
  };
}

function stamp(entity: IngestedEntity, columns: string[]): SourcedStamp {
  return {
    sourceGame: entity.provenance.sourceGame,
    sourceFile: entity.provenance.sourceFile,
    sourceRow: entity.provenance.sourceRow,
    columns,
  };
}

export function seedMovementSteps(entity: IngestedEntity): StepSeed[] {
  // Every registered player-movement step asserts target-side UE assets or a live UE gate.
  // The engine specification is retained on the entity; seeding any of those envelopes would claim an asset exists.
  if (entity.id !== DIABLO1_MOVEMENT_SPEC.id || entity.catalogId !== 'player-movement') return [];
  return [];
}

export function seedInputSteps(entity: IngestedEntity): StepSeed[] {
  if (entity.id !== DIABLO1_INPUT_SPEC.id || entity.catalogId !== 'input-schemes') return [];
  const sourced = stamp(entity, ['input', 'context', 'action', 'file:line']);
  const byInput = (input: string) => DIABLO1_INPUT_SPEC.bindings.filter((binding) => binding.input === input);
  return [
    {
      catalogId: 'input-schemes', entityId: entity.id, step: 'Concept Brief',
      data: {
        brief: 'Diablo I uses a fixed vanilla mouse-and-keyboard scheme. Left click is contextual: empty ground walks, while actors, objects, and items select attack, talk, operate/disarm, or pickup commands. Shift-left attacks in place, right click uses an item or casts the readied spell, number keys use belt slots, and F5-F8 assign or ready quick spells. Letter keys open the classic panels and F1 opens a static help screen. Controller, touch, analog deadzones, haptics, quick-cast, and conflict-aware rebinding are port facilities, not properties of this vanilla entity.',
        [SOURCED_FIELD]: sourced,
      },
      gaps: ['target implementation: the reference states behavior, not UE Enhanced Input assets or callbacks'],
    },
    {
      catalogId: 'input-schemes', entityId: entity.id, step: 'Action Mapping',
      data: {
        mapping: {
          move: byInput('Left mouse button'),
          attack: [...byInput('Left mouse button'), ...byInput('Shift + left mouse button')],
          dodge: REFERENCE_GAP,
          interact: byInput('Left mouse button'),
          ability1: byInput('F5-F8')[0],
          ability2: byInput('F5-F8')[0],
          ability3: byInput('F5-F8')[1],
          ability4: byInput('F5-F8')[1],
          bindings: DIABLO1_INPUT_SPEC.bindings,
          wiringContract: {
            grantedBy: 'Source/diablo.cpp mouse handlers and InitKeymapActions register the vanilla commands.',
            activatedBy: 'Mouse events and fixed keyboard defaults dispatch engine commands in the active game state.',
            dependencies: ['Source/diablo.cpp', 'Source/track.cpp', 'Source/msg.cpp'],
            verification: 'L1: compare every binding to its pinned Source file:line and command handler.',
          },
        },
        [SOURCED_FIELD]: sourced,
      },
      gaps: ['dodge: vanilla Diablo has no dodge action', 'ability1-4: F5-F8 are assignable ready-spell slots, not four fixed abilities'],
    },
    {
      catalogId: 'input-schemes', entityId: entity.id, step: 'Context Stack',
      data: {
        contexts: {
          gameplay: DIABLO1_INPUT_SPEC.contexts[0],
          menu: DIABLO1_INPUT_SPEC.contexts[2],
          dialogue: { id: 'dialogue', rule: 'Quest text and conversation state consume world input until dismissed.' },
          sourceContexts: DIABLO1_INPUT_SPEC.contexts,
        },
        [SOURCED_FIELD]: sourced,
      },
      gaps: ['assets/priorities/push-pop: vanilla uses state checks rather than UE mapping-context assets'],
    },
    {
      catalogId: 'input-schemes', entityId: entity.id, step: 'Tutorial Prompts',
      data: {
        tutorial: {
          promptStyle: DIABLO1_INPUT_SPEC.help.style,
          glyphSource: 'static text and mouse/keyboard labels',
          taughtSequence: DIABLO1_INPUT_SPEC.bindings,
          pacing: 'player-opened with F1; no contextual sequencing or re-prompt cadence',
        },
        [SOURCED_FIELD]: sourced,
      },
      gaps: ['contextual trigger/dismiss telemetry: vanilla provides only the static F1 help screen'],
    },
  ];
}
