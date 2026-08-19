/**
 * Deterministic fixtures for the STANDALONE prompt builders (`src/lib/prompts/`).
 *
 * One representative invocation per builder file, so both rails can iterate the
 * same table instead of duplicating fixtures:
 * - `standalone-builder-knowledge.test.ts` — asserts module knowledge routing
 *   reaches every builder (Direction 1);
 * - `task-prompt-golden.test.ts` — byte-pins each builder's output (Direction 3).
 *
 * Every fixture is a plain literal (no `Date.now()`, no randomness) so the
 * produced prompt is a pure function of `ProjectContext`.
 */

import { Boxes } from 'lucide-react';
import type { ProjectContext } from '@/lib/prompt-context';
import type { SubModuleId } from '@/types/modules';

import type { LevelDesignDocument, RoomNode } from '@/types/level-design';
import type { AudioSceneDocument, AudioZone } from '@/types/audio-scene';
import type { TestSuite } from '@/types/ai-testing';
import type { PPStudioEffect } from '@/types/post-process-studio';
import type { MaterialConfiguratorConfig } from '@/components/modules/content/materials/MaterialParameterConfigurator';
import type { MaterialPattern } from '@/components/modules/content/materials/MaterialPatternCatalog';
import type { StyleTransferConfig } from '@/components/modules/content/materials/MaterialStyleTransfer';
import type { ChecklistStep } from '@/components/modules/content/animations/AnimationChecklist';
import type { AudioEventCatalogConfig } from '@/components/modules/content/audio/AudioEventCatalog';
import type { MenuFlowConfig } from '@/components/modules/content/ui-hud/MenuFlowDiagram';

import { buildRoomCodegenPrompt } from '@/lib/prompts/level-design';
import { buildInventoryPrompt, DEFAULT_CONFIG as INVENTORY_DEFAULTS } from '@/lib/prompts/inventory';
import { buildMaterialConfiguratorPrompt } from '@/lib/prompts/material-configurator';
import { buildMaterialPatternPrompt } from '@/lib/prompts/material-patterns';
import { buildAnimationChecklistPrompt } from '@/lib/prompts/animation-checklist';
import { buildAudioSystemPrompt } from '@/lib/prompts/audio-scene';
import { buildAudioEventPrompt } from '@/lib/prompts/audio-events';
import { buildMenuFlowPrompt } from '@/lib/prompts/menu-flow';
import { buildPostProcessPrompt } from '@/lib/prompts/post-process';
import { buildStyleTransferPrompt } from '@/lib/prompts/style-transfer';
import { buildGenerateTestsPrompt } from '@/lib/prompts/ai-testing';

// ── Fixtures ────────────────────────────────────────────────────────────────

const ROOM: RoomNode = {
  id: 'room-1',
  name: 'Crypt Antechamber',
  type: 'combat',
  description: 'A cramped stone antechamber lit by guttering braziers.',
  encounterDesign: 'Two waves of skeletons, the second flanking from the side alcoves.',
  difficulty: 3,
  pacing: 'rising',
  x: 0,
  y: 0,
  linkedFiles: [],
  spawnEntries: [
    { id: 'sp-1', enemyClass: 'AARPGSkeleton', count: 3, spawnDelay: 0, wave: 1 },
    { id: 'sp-2', enemyClass: 'AARPGSkeletonArcher', count: 2, spawnDelay: 4, wave: 2 },
  ],
  tags: ['crypt', 'tutorial'],
};

const LEVEL_DOC: LevelDesignDocument = {
  id: 1,
  name: 'Crypt of the First King',
  description: 'The opening dungeon.',
  designNarrative: 'A descent from the chapel into the flooded royal crypt.',
  rooms: [ROOM],
  connections: [],
  difficultyArc: ['room-1'],
  pacingNotes: 'Rising tension into the boss antechamber.',
  syncStatus: 'unlinked',
  syncReport: [],
  lastGeneratedAt: null,
  lastCodeHash: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** Shared with the task-prompt golden rail — the `level-sync` task carries a whole doc. */
export { LEVEL_DOC as GOLDEN_LEVEL_DOC };

const MATERIAL_CONFIG: MaterialConfiguratorConfig = {
  surfaceType: 'metal',
  features: ['emissive'],
  outputType: 'master',
  params: {
    roughness: { name: 'Roughness', min: 0, max: 1, defaultValue: 0.35, step: 0.01 },
    metallic: { name: 'Metallic', min: 0, max: 1, defaultValue: 1, step: 0.01 },
  },
};

const MATERIAL_PATTERN: MaterialPattern = {
  id: 'dissolve',
  name: 'Dissolve',
  category: 'stylized',
  icon: Boxes,
  description: 'Noise-driven dissolve with an emissive burn edge.',
  approach: 'Mask the opacity with a noise texture stepped by a scalar parameter.',
  hlslSnippet: 'float Mask = step(Noise, DissolveAmount);',
  tags: ['vfx', 'opacity'],
};

const ANIMATION_STEP: ChecklistStep = {
  id: 'anim-3',
  number: 3,
  title: 'Locomotion blend space',
  type: 'code',
  icon: Boxes,
  description: 'Author the 2D locomotion blend space and drive it from the AnimInstance.',
  details: [
    'Create BS_Locomotion with Speed and Direction axes.',
    'Drive the axes from NativeUpdateAnimation.',
  ],
  prompt: 'Generate the UARPGAnimInstance that drives BS_Locomotion.',
};

const AUDIO_ZONE: AudioZone = {
  id: 'zone-1',
  name: 'Flooded Nave',
  shape: 'rect',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  soundscapeDescription: 'Dripping water, distant echoing chants, low stone rumble.',
  reverbPreset: 'stone-chamber',
  reverbDecayTime: 2.4,
  reverbDiffusion: 0.8,
  reverbWetDry: 0.5,
  attenuationRadius: 1500,
  occlusionMode: 'medium',
  priority: 5,
  color: 'var(--accent)',
};

const AUDIO_DOC: AudioSceneDocument = {
  id: 1,
  name: 'Crypt Soundscape',
  description: 'Spatial audio for the crypt.',
  zones: [AUDIO_ZONE],
  emitters: [
    {
      id: 'em-1',
      name: 'Brazier Crackle',
      type: 'loop',
      x: 40,
      y: 60,
      soundCueRef: '/Game/Audio/SC_Brazier',
      attenuationRadius: 600,
      volumeMultiplier: 0.8,
      pitchMin: 0.95,
      pitchMax: 1.05,
      spawnChance: 1,
      cooldownSeconds: 0,
      zoneId: 'zone-1',
    },
  ],
  globalReverbPreset: 'cave',
  soundPoolSize: 32,
  maxConcurrentSounds: 16,
  lastGeneratedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const AUDIO_EVENTS: AudioEventCatalogConfig = {
  events: [
    {
      id: 'evt-1',
      name: 'Melee Impact',
      category: 'combat',
      trigger: 'GameplayCue.Combat.Impact',
      priority: 'high',
      spatial: '3d',
      concurrency: 4,
      cooldownMs: 60,
      tags: ['combat'],
    },
    {
      id: 'evt-2',
      name: 'Menu Confirm',
      category: 'ui',
      trigger: 'UI.Confirm',
      priority: 'normal',
      spatial: '2d',
      concurrency: 1,
      cooldownMs: 0,
      tags: ['ui'],
    },
  ],
};

const MENU_FLOW: MenuFlowConfig = {
  screens: [
    { id: 'scr-main', name: 'Main Menu', type: 'main-menu', x: 0, y: 0, widgets: ['Play', 'Settings', 'Quit'] },
    { id: 'scr-settings', name: 'Settings', type: 'settings', x: 200, y: 0, widgets: ['Audio', 'Video'] },
  ],
  transitions: [
    { id: 'tr-1', fromId: 'scr-main', toId: 'scr-settings', trigger: 'Settings clicked', bidirectional: true },
  ],
};

const PP_EFFECT: PPStudioEffect = {
  id: 'bloom',
  name: 'Bloom',
  category: 'lighting',
  ueClass: 'FPostProcessSettings',
  description: 'Halo bleed from bright pixels.',
  enabled: true,
  priority: 0,
  gpuCostMs: 0.4,
  params: [
    {
      name: 'Intensity',
      description: 'Overall bloom strength.',
      type: 'float',
      defaultValue: 0.675,
      value: 1.2,
      min: 0,
      max: 8,
      step: 0.01,
      ueProperty: 'BloomIntensity',
    },
  ],
};

const STYLE_TRANSFER: StyleTransferConfig = {
  imageDataUrl: null,
  referenceDescription: 'Weathered bronze temple door with verdigris in the recesses.',
  analysis: {
    colorPalette: ['bronze', 'verdigris', 'soot'],
    surfaceType: 'metal',
    surfaceConfidence: 0.86,
    roughness: 0.42,
    metallic: 0.95,
    emissiveIntensity: 0,
    subsurfacePresence: 0,
    parallaxDepth: 0.02,
    opacity: 1,
    features: ['parallax'],
    description: 'Aged patinated bronze with deep recessed detail.',
    suggestions: ['Raise parallax depth for the recesses.'],
  },
  adjustments: {},
};

const TEST_SUITE: TestSuite = {
  id: 1,
  name: 'Skeleton Aggro Suite',
  description: 'Perception + chase behaviour for the crypt skeleton.',
  targetClass: 'AARPGEnemyAIController',
  scenarios: [
    {
      id: 1,
      suiteId: 1,
      name: 'Sees player at 50m',
      description: 'Player walks into the sight cone at 50 metres.',
      stimuli: [
        {
          id: 'st-1',
          type: 'perception_sight',
          label: 'Player enters sight at 50m',
          description: 'Spawn the player inside the sight cone at 5000 units.',
          params: { distance: '5000' },
        },
      ],
      expectedActions: [
        { id: 'ea-1', action: 'Enter Chase state', btNode: 'BTT_Chase', timeoutSeconds: 3 },
      ],
      status: 'ready',
      lastRunOutput: '',
      lastRunAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// ── The table ───────────────────────────────────────────────────────────────

/** One representative invocation of a standalone builder. */
export interface StandaloneBuilderCase {
  /** Stable id — also the golden-snapshot name. Keep in sync with the file name. */
  name: string;
  /** The module the builder authors for (drives the expected knowledge routing). */
  module: SubModuleId;
  build: (ctx: ProjectContext) => string;
}

/**
 * Every standalone builder file, one representative call each. Adding a builder
 * file without adding it here fails `standalone-builder-knowledge.test.ts`'s
 * coverage guard.
 */
export const STANDALONE_BUILDERS: StandaloneBuilderCase[] = [
  { name: 'level-design', module: 'level-design', build: (ctx) => buildRoomCodegenPrompt(ROOM, LEVEL_DOC, ctx) },
  { name: 'inventory', module: 'ui-hud', build: (ctx) => buildInventoryPrompt(INVENTORY_DEFAULTS, ctx) },
  { name: 'material-configurator', module: 'materials', build: (ctx) => buildMaterialConfiguratorPrompt(MATERIAL_CONFIG, ctx) },
  { name: 'material-patterns', module: 'materials', build: (ctx) => buildMaterialPatternPrompt(MATERIAL_PATTERN, ctx) },
  { name: 'animation-checklist', module: 'animations', build: (ctx) => buildAnimationChecklistPrompt(ANIMATION_STEP, ctx) },
  { name: 'audio-scene', module: 'audio', build: (ctx) => buildAudioSystemPrompt(AUDIO_DOC, ctx) },
  { name: 'audio-events', module: 'audio', build: (ctx) => buildAudioEventPrompt(AUDIO_EVENTS, ctx) },
  { name: 'menu-flow', module: 'ui-hud', build: (ctx) => buildMenuFlowPrompt(MENU_FLOW, ctx) },
  { name: 'post-process', module: 'materials', build: (ctx) => buildPostProcessPrompt({ effects: [PP_EFFECT] }, ctx) },
  { name: 'style-transfer', module: 'materials', build: (ctx) => buildStyleTransferPrompt(STYLE_TRANSFER, ctx) },
  { name: 'ai-testing', module: 'ai-behavior', build: (ctx) => buildGenerateTestsPrompt(TEST_SUITE, ctx) },
];
