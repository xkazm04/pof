import {
  Rocket, Code, Palette, Gamepad2, Radar,
  Box, Film, Brush, Map, Monitor, Music,
  Bot, Atom, Globe, Save, Joystick, MessageSquare, Package,
} from 'lucide-react';
import type { CategoryDefinition, SubModuleDefinition } from '@/types/modules';
import type { GameGenre } from '@/stores/projectStore';
import { getGenreSubModules } from '@/lib/genre-registry';

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'project-setup',
    label: 'Project Setup',
    icon: Rocket,
    accentColor: '#00ff88',
    accentColorVar: 'var(--setup)',
    subModules: [],
  },
  {
    id: 'core-engine',
    label: 'Core Engine',
    icon: Code,
    accentColor: '#3b82f6',
    accentColorVar: 'var(--core)',
    subModules: [], // Driven by genre-registry based on selected game genre
  },
  {
    id: 'content',
    label: 'Content',
    icon: Palette,
    accentColor: '#f59e0b',
    accentColorVar: 'var(--content)',
    subModules: ['models', 'animations', 'materials', 'level-design', 'ui-hud', 'audio'],
  },
  {
    id: 'game-systems',
    label: 'Game Systems',
    icon: Gamepad2,
    accentColor: '#8b5cf6',
    accentColorVar: 'var(--systems)',
    subModules: ['ai-behavior', 'physics', 'multiplayer', 'save-load', 'input-handling', 'dialogue-quests', 'packaging'],
  },
  {
    id: 'evaluator',
    label: 'Evaluator',
    icon: Radar,
    accentColor: '#ef4444',
    accentColorVar: 'var(--evaluator)',
    subModules: [],
  },
];

export const SUB_MODULES: SubModuleDefinition[] = [
  // Core Engine sub-modules are now driven by genre-registry.ts
  // Content
  {
    id: 'models',
    label: '3D Models & Characters',
    description: 'Import pipelines, procedural meshes, data tables',
    categoryId: 'content',
    icon: Box,
    feasibilityRating: 'moderate',
    quickActions: [
      { id: 'md-1', label: 'Import Pipeline', prompt: 'Set up an FBX/glTF import pipeline with proper material assignment, LOD setup, and collision generation.' },
      { id: 'md-2', label: 'Procedural Mesh', prompt: 'Create a procedural mesh generation system for runtime geometry creation.' },
      { id: 'md-3', label: 'Data Tables', prompt: 'Design data tables for character/item stats with proper struct definitions and CSV import.' },
    ],
    knowledgeTips: [
      { title: 'Art is the gap', content: 'The feasibility study identified 3D art creation as the biggest gap in AI-assisted UE5 development. Focus on code-side asset management.', source: 'feasibility' },
    ],
  },
  {
    id: 'animations',
    label: 'Animations',
    description: 'AnimBP, locomotion states, montages, notifies',
    categoryId: 'content',
    icon: Film,
    feasibilityRating: 'moderate',
    quickActions: [
      { id: 'an-1', label: 'Anim Blueprint', prompt: 'Create an Animation Blueprint with state machine for locomotion (idle, walk, run, jump).' },
      { id: 'an-2', label: 'Montage System', prompt: 'Set up animation montage system for attacks, abilities, and contextual actions with notifies.' },
      { id: 'an-3', label: 'Blend Spaces', prompt: 'Create blend spaces for smooth movement transitions (directional, speed-based).' },
    ],
    knowledgeTips: [
      { title: 'C++ AnimInstance', content: 'Use C++ AnimInstance for performance-critical animation logic, expose variables to AnimBP for visual state machine.', source: 'best-practice' },
    ],
  },
  {
    id: 'materials',
    label: 'Materials & Shaders',
    description: 'Dynamic materials, post-process, HLSL',
    categoryId: 'content',
    icon: Brush,
    feasibilityRating: 'moderate',
    quickActions: [
      { id: 'mt-1', label: 'Dynamic Materials', prompt: 'Create a dynamic material system for runtime color/texture changes with material parameter collections.' },
      { id: 'mt-2', label: 'Post-Process', prompt: 'Set up post-process effects chain with bloom, color grading, and custom effects.' },
      { id: 'mt-3', label: 'Master Material', prompt: 'Design a master material with switches for different surface types (metal, cloth, skin, etc.).' },
    ],
    knowledgeTips: [
      { title: 'Material instances', content: 'Always use Material Instances for runtime changes. Never modify the parent material directly in-game.', source: 'best-practice' },
    ],
  },
  {
    id: 'level-design',
    label: 'Level Design',
    description: 'Procedural generation, streaming, spawn systems',
    categoryId: 'content',
    icon: Map,
    feasibilityRating: 'moderate',
    quickActions: [
      { id: 'ld-1', label: 'Procedural Gen', prompt: 'Implement a procedural level generation system with rooms, corridors, and proper connectivity.' },
      { id: 'ld-2', label: 'Level Streaming', prompt: 'Set up level streaming with proper loading/unloading triggers and seamless transitions.' },
      { id: 'ld-3', label: 'Spawn System', prompt: 'Create a flexible spawn system with spawn points, waves, difficulty scaling, and spawn rules.' },
    ],
    knowledgeTips: [
      { title: 'Procedural generation is strong', content: 'Code-driven level generation is an area where Claude can contribute significantly - algorithms over art.', source: 'feasibility' },
    ],
  },
  {
    id: 'ui-hud',
    label: 'UI / HUD',
    description: 'UMG menus, HUD, inventory, settings',
    categoryId: 'content',
    icon: Monitor,
    feasibilityRating: 'moderate',
    quickActions: [
      { id: 'uh-1', label: 'Main Menu', prompt: 'Create a main menu system with play, settings, and quit buttons using UMG in C++.' },
      { id: 'uh-2', label: 'HUD System', prompt: 'Implement a game HUD with health bar, ammo counter, minimap, and crosshair using C++ and UMG.' },
      { id: 'uh-3', label: 'Inventory UI', prompt: 'Create an inventory UI system with grid layout, drag-and-drop, and item tooltips.' },
      { id: 'uh-4', label: 'Settings Menu', prompt: 'Build a settings menu with graphics, audio, controls tabs and save/load preferences.' },
    ],
    knowledgeTips: [
      { title: 'C++ driven UMG', content: 'Create widgets in C++ and use Blueprint for layout. This gives you type safety and better performance.', source: 'best-practice' },
    ],
  },
  {
    id: 'audio',
    label: 'Audio & Music',
    description: 'Sound cues, ambient system, dynamic music',
    categoryId: 'content',
    icon: Music,
    feasibilityRating: 'moderate',
    quickActions: [
      { id: 'au-1', label: 'Sound Manager', prompt: 'Create an audio manager component for playing sounds with pooling, fading, and priority.' },
      { id: 'au-2', label: 'Ambient System', prompt: 'Build an ambient sound system with audio volumes, time-of-day variation, and environmental triggers.' },
      { id: 'au-3', label: 'Dynamic Music', prompt: 'Implement a dynamic music system that transitions between layers based on game state.' },
    ],
    knowledgeTips: [
      { title: 'MetaSounds', content: 'UE5 MetaSounds provides a node-based audio system. Use C++ to drive parameters, MetaSounds for DSP.', source: 'best-practice' },
    ],
  },
  // Game Systems
  {
    id: 'ai-behavior',
    label: 'AI / NPC Behavior',
    description: 'Behavior trees, EQS, perception, combat AI',
    categoryId: 'game-systems',
    icon: Bot,
    feasibilityRating: 'strong',
    quickActions: [
      { id: 'ai-1', label: 'Behavior Tree', prompt: 'Create a behavior tree for an enemy AI with patrol, chase, attack, and retreat behaviors.' },
      { id: 'ai-2', label: 'AI Perception', prompt: 'Set up AI perception with sight, hearing, and damage senses with proper stimuli sources.' },
      { id: 'ai-3', label: 'EQS Queries', prompt: 'Create Environment Query System queries for finding cover, flanking positions, and patrol points.' },
      { id: 'ai-4', label: 'Combat AI', prompt: 'Implement combat AI with attack patterns, cooldowns, aggro management, and group coordination.' },
    ],
    knowledgeTips: [
      { title: 'AI is Claude\'s strength', content: 'AI behavior trees and logic are purely code-driven, making this one of the strongest modules for AI assistance.', source: 'feasibility' },
    ],
  },
  {
    id: 'physics',
    label: 'Physics & Collision',
    description: 'Profiles, materials, projectiles, destruction',
    categoryId: 'game-systems',
    icon: Atom,
    feasibilityRating: 'strong',
    quickActions: [
      { id: 'ph-1', label: 'Collision Setup', prompt: 'Set up collision profiles and channels for player, enemies, projectiles, and environment.' },
      { id: 'ph-2', label: 'Projectile System', prompt: 'Create a projectile system with physics simulation, hit detection, and damage application.' },
      { id: 'ph-3', label: 'Destruction', prompt: 'Implement a destructible environment system with Chaos Destruction and damage thresholds.' },
    ],
    knowledgeTips: [
      { title: 'Collision channels first', content: 'Define your collision channels and profiles early - refactoring collision later is painful.', source: 'best-practice' },
    ],
  },
  {
    id: 'multiplayer',
    label: 'Multiplayer',
    description: 'Replication, RPCs, sessions',
    categoryId: 'game-systems',
    icon: Globe,
    feasibilityRating: 'challenging',
    quickActions: [
      { id: 'mp-1', label: 'Replication Setup', prompt: 'Set up basic replication with replicated properties, conditions, and lifetime management.' },
      { id: 'mp-2', label: 'RPC Framework', prompt: 'Create a framework for Server, Client, and Multicast RPCs with proper validation.' },
      { id: 'mp-3', label: 'Session System', prompt: 'Implement online session creation, discovery, and joining using Online Subsystem.' },
    ],
    knowledgeTips: [
      { title: 'Multiplayer is challenging', content: 'The feasibility study rates multiplayer as the most challenging module. Start simple, test with dedicated server early.', source: 'feasibility' },
    ],
  },
  {
    id: 'save-load',
    label: 'Save / Load',
    description: 'USaveGame, auto-save, slot system',
    categoryId: 'game-systems',
    icon: Save,
    feasibilityRating: 'strong',
    quickActions: [
      { id: 'sl-1', label: 'Save System', prompt: 'Create a save game system using USaveGame with serialization for player data, world state, and progress.' },
      { id: 'sl-2', label: 'Auto-Save', prompt: 'Implement auto-save with configurable intervals, checkpoint triggers, and async saving.' },
      { id: 'sl-3', label: 'Save Slots', prompt: 'Build a save slot system with slot management UI, metadata display, and delete confirmation.' },
    ],
    knowledgeTips: [
      { title: 'USaveGame is simple', content: 'USaveGame handles serialization for you. Mark properties with UPROPERTY(SaveGame) for automatic inclusion.', source: 'best-practice' },
    ],
  },
  {
    id: 'input-handling',
    label: 'Input Handling',
    description: 'Enhanced Input, rebinding, gamepad',
    categoryId: 'game-systems',
    icon: Joystick,
    feasibilityRating: 'strong',
    quickActions: [
      { id: 'ih-1', label: 'Input Setup', prompt: 'Set up Enhanced Input System with actions for movement, camera, interact, and abilities.' },
      { id: 'ih-2', label: 'Key Rebinding', prompt: 'Implement key rebinding system with save/load of custom bindings and conflict detection.' },
      { id: 'ih-3', label: 'Gamepad Support', prompt: 'Add gamepad support with proper dead zones, aim assist, and input device detection/switching.' },
    ],
    knowledgeTips: [
      { title: 'Enhanced Input is the standard', content: 'UE5 uses Enhanced Input by default. The old InputComponent system is deprecated.', source: 'best-practice' },
    ],
  },
  {
    id: 'dialogue-quests',
    label: 'Dialogue & Quests',
    description: 'Data-driven dialogue, quest tracker',
    categoryId: 'game-systems',
    icon: MessageSquare,
    feasibilityRating: 'strong',
    quickActions: [
      { id: 'dq-1', label: 'Dialogue System', prompt: 'Create a data-driven dialogue system with branching conversations, conditions, and consequence triggers.' },
      { id: 'dq-2', label: 'Quest System', prompt: 'Implement a quest system with objectives, tracking, rewards, and quest log UI.' },
      { id: 'dq-3', label: 'NPC Interaction', prompt: 'Build an NPC interaction system with proximity detection, interaction prompts, and dialogue triggering.' },
    ],
    knowledgeTips: [
      { title: 'Data tables for dialogue', content: 'Use UE5 Data Tables or custom JSON for dialogue data. Keep content separate from logic for easy iteration.', source: 'best-practice' },
    ],
  },
  {
    id: 'packaging',
    label: 'Packaging',
    description: 'Build config, automation, versioning',
    categoryId: 'game-systems',
    icon: Package,
    feasibilityRating: 'strong',
    quickActions: [
      { id: 'pk-1', label: 'Build Config', prompt: 'Set up build configuration for shipping with proper cooking settings, compression, and platform configs.' },
      { id: 'pk-2', label: 'Build Automation', prompt: 'Create build automation scripts for packaging, testing, and deployment workflows.' },
      { id: 'pk-3', label: 'Version System', prompt: 'Implement a version numbering system with build info display and update checking.' },
    ],
    knowledgeTips: [
      { title: 'Test shipping builds early', content: 'Package a shipping build early in development to catch packaging issues before they accumulate.', source: 'best-practice' },
    ],
  },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c])) as Record<string, CategoryDefinition>;
export const SUB_MODULE_MAP = Object.fromEntries(SUB_MODULES.map(m => [m.id, m])) as Record<string, SubModuleDefinition>;

export function getSubModulesForCategory(categoryId: string, genre?: GameGenre | null): SubModuleDefinition[] {
  if (categoryId === 'core-engine') {
    return getGenreSubModules(genre ?? null);
  }
  const category = CATEGORY_MAP[categoryId];
  if (!category) return [];
  return category.subModules.map(id => SUB_MODULE_MAP[id]).filter(Boolean);
}

export function getCategoryForSubModule(subModuleId: string): CategoryDefinition | undefined {
  const subModule = SUB_MODULE_MAP[subModuleId];
  if (!subModule) return undefined;
  return CATEGORY_MAP[subModule.categoryId];
}
