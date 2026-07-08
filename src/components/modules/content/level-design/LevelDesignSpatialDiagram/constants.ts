import { Dice5, ArrowLeftRight, Target } from 'lucide-react';
import type { SystemNode } from './types';

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
    id: 'ld-2',
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
    id: 'ld-3',
    label: 'Spawn System',
    subtitle: 'Entities',
    description: 'Spawn points, waves, scaling',
    icon: Target,
    prompt: 'Create a flexible spawn system with spawn points, waves, difficulty scaling, and spawn rules.',
    x: 82,
    y: 72,
    dependencies: ['ld-1', 'ld-2'],
  },
];

/** SVG arrow dependency paths */
export const DEPENDENCY_ARROWS: { from: string; to: string }[] = [
  { from: 'ld-1', to: 'ld-2' },
  { from: 'ld-1', to: 'ld-3' },
  { from: 'ld-2', to: 'ld-3' },
];

export const EMPTY_PROGRESS: Record<string, boolean> = {};

// Node card dimensions (px) — used for arrow endpoint calculations
export const NODE_W = 168;
export const NODE_H = 88;
