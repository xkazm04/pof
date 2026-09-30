/**
 * One scene-decompose route response (`data`), shaped exactly as the route returns it:
 * 1 table + 2 barrels + 2 bottles, where the solver placed one bottle on the table and
 * could not place the second. Shared by the plan, blockout and store tests.
 */
import type { SceneDecomposeData } from '@/lib/visual-gen/scene-dress-plan';

export const DRESS_FIXTURE: SceneDecomposeData = {
  props: [
    { id: 'trading-post-table', name: 'trading post table', box: { x0: 0.3, y0: 0.48, x1: 0.72, y1: 0.86 }, longestCm: 170, count: 1, material: 'wood' },
    { id: 'wooden-barrel', name: 'wooden barrel', box: { x0: 0.1, y0: 0.55, x1: 0.26, y1: 0.92 }, longestCm: 90, count: 2, material: 'wood' },
    { id: 'clay-bottle', name: 'clay bottle', box: { x0: 0.44, y0: 0.4, x1: 0.49, y1: 0.5 }, longestCm: 28, count: 2, material: 'glass' },
  ],
  assets: [
    { id: 'trading-post-table', name: 'trading post table', size: [170, 170, 95], affordance: { place: 'floor', stackable: true, copies: 1, maxStack: 2 } },
    { id: 'wooden-barrel', name: 'wooden barrel', size: [60, 60, 90], affordance: { place: 'any', stackable: true, copies: 2, maxStack: 3 } },
    { id: 'clay-bottle', name: 'clay bottle', size: [10, 10, 28], affordance: { place: 'any', stackable: false, copies: 2, maxStack: 1 } },
  ],
  composition: {
    props: [
      { id: 'trading-post-table_0', assetId: 'trading-post-table', x: 0, y: 0, z: 0, yaw: 3, stackIndex: 0, supportedBy: null, ueActorTags: ['place_floor', 'stack_true', 'copy_1', 'max_stack_2', 'phys_wood', 'sim_false', 'mass_kg_120'] },
      { id: 'wooden-barrel_0', assetId: 'wooden-barrel', x: -150, y: 40, z: 0, yaw: -4, stackIndex: 0, supportedBy: null, ueActorTags: ['place_any', 'stack_true', 'copy_2', 'max_stack_3', 'phys_wood', 'sim_true', 'mass_kg_45.5'] },
      { id: 'wooden-barrel_1', assetId: 'wooden-barrel', x: 140, y: -60, z: 0, yaw: 6, stackIndex: 0, supportedBy: null, ueActorTags: ['place_any', 'stack_true', 'copy_2', 'max_stack_3', 'phys_wood', 'sim_true', 'mass_kg_45.5'] },
      { id: 'clay-bottle_0', assetId: 'clay-bottle', x: 20, y: 10, z: 95, yaw: 0, stackIndex: 1, supportedBy: 'trading-post-table_0', ueActorTags: ['place_any', 'stack_false', 'copy_2', 'max_stack_1', 'phys_glass', 'sim_true', 'mass_kg_0.4'] },
    ],
    unplaced: [{ assetId: 'clay-bottle', reason: 'no support surface with room left' }],
  },
  gate: [],
};
