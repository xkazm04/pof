import { RIG_PRESETS, type RigPreset } from '@/lib/visual-gen/rig-presets';
import type { BoneDefinition } from '@/lib/blender-mcp/scripts/create-armature';

/** Convert an IK chain from a rig preset into BoneDefinition[] for Blender. */
export function presetToBones(preset: RigPreset): BoneDefinition[] {
  const bones: BoneDefinition[] = [];
  const spacing = 0.15;

  // Root bone
  bones.push({
    name: preset.rootBone,
    head: [0, 0, 0],
    tail: [0, 0, spacing],
  });

  // Build a simplified humanoid skeleton from the IK chains
  const spineChain = preset.ikChains.find((c) => c.name === 'Spine');
  if (spineChain) {
    bones.push(
      { name: spineChain.startBone, head: [0, 0, spacing], tail: [0, 0, spacing * 4], parent: preset.rootBone },
      { name: spineChain.endBone, head: [0, 0, spacing * 4], tail: [0, 0, spacing * 5], parent: spineChain.startBone },
    );
  }

  const armChains = preset.ikChains.filter((c) => c.name.includes('Arm'));
  armChains.forEach((chain) => {
    const side = chain.name.includes('Left') ? -1 : 1;
    const parentBone = spineChain?.endBone ?? preset.rootBone;
    bones.push(
      { name: chain.startBone, head: [side * spacing * 2, 0, spacing * 4], tail: [side * spacing * 4, 0, spacing * 4], parent: parentBone },
      { name: chain.endBone, head: [side * spacing * 4, 0, spacing * 4], tail: [side * spacing * 6, 0, spacing * 4], parent: chain.startBone },
    );
  });

  const legChains = preset.ikChains.filter((c) => c.name.includes('Leg'));
  legChains.forEach((chain) => {
    const side = chain.name.includes('Left') ? -1 : 1;
    const parentBone = spineChain?.startBone ?? preset.rootBone;
    bones.push(
      { name: chain.startBone, head: [side * spacing, 0, spacing], tail: [side * spacing, 0, -spacing * 2], parent: parentBone },
      { name: chain.endBone, head: [side * spacing, 0, -spacing * 2], tail: [side * spacing, 0, -spacing * 3], parent: chain.startBone },
    );
  });

  return bones;
}

export const MAX_BONE_COUNT = Math.max(...RIG_PRESETS.map((p) => p.boneCount));

export function boneComplexityColor(count: number): string {
  if (count < 50) return 'bg-emerald-500';
  if (count <= 200) return 'bg-amber-500';
  return 'bg-rose-500';
}
