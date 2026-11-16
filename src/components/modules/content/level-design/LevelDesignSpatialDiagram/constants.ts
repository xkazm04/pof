import { Dice5, ArrowLeftRight, Target } from 'lucide-react';
import type { SystemNode } from './types';

/**
 * Node ids ARE level-design checklist ids: a confirmed run ticks
 * `checklistProgress['level-design'][id]`, so each id must be the checklist item
 * for the same system (ld-3 = 'Implement level streaming', ld-2 = 'Place spawn
 * points and triggers'). ld-1 ('Create blockout geometry') is the nearest item
 * to procedural room layout; the checklist has no procgen item of its own.
 */
export const NODES: SystemNode[] = [
  {
    id: 'ld-1',
    label: 'Procedural Gen',
    subtitle: 'Foundation',
    description: 'Rooms, corridors, connectivity',
    icon: Dice5,
    prompt: 'Implement a procedural level generation system with rooms, corridors, and proper connectivity.',
    x: 50,
    y: 8,
    dependencies: [],
  },
  {
    id: 'ld-3',
    label: 'Level Streaming',
    subtitle: 'Spatial',
    description: 'Load/unload, seamless transitions',
    icon: ArrowLeftRight,
    prompt: 'Set up level streaming with proper loading/unloading triggers and seamless transitions.',
    x: 18,
    y: 72,
    dependencies: ['ld-1'],
  },
  {
    id: 'ld-2',
    label: 'Spawn System',
    subtitle: 'Entities',
    description: 'Spawn points, waves, scaling',
    icon: Target,
    prompt: 'Create a flexible spawn system with spawn points, waves, difficulty scaling, and spawn rules.',
    x: 82,
    y: 72,
    dependencies: ['ld-1', 'ld-3'],
  },
];

/** SVG arrow dependency paths - derived from each node's `dependencies`, never a second list. */
export const DEPENDENCY_ARROWS: { from: string; to: string }[] = NODES.flatMap((n) =>
  n.dependencies.map((from) => ({ from, to: n.id })),
);

export const EMPTY_PROGRESS: Record<string, boolean> = {};

// Node card dimensions (px) — used for arrow endpoint calculations
export const NODE_W = 168;
export const NODE_H = 88;
