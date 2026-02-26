/**
 * Skeleton rig presets for UE5 character rigging.
 * Defines bone hierarchies and mappings for common target skeletons.
 */

export interface BoneMapping {
  sourceBone: string;
  targetBone: string;
}

export interface RigPreset {
  id: string;
  name: string;
  description: string;
  boneCount: number;
  hasFingers: boolean;
  hasFaceRig: boolean;
  rootBone: string;
  ikChains: Array<{
    name: string;
    startBone: string;
    endBone: string;
  }>;
  /** Bone name mapping from Mixamo to this rig's naming convention */
  mixamoMapping: BoneMapping[];
}

export const RIG_PRESETS: RigPreset[] = [
  {
    id: 'ue5-mannequin',
    name: 'UE5 Mannequin',
    description: 'Standard UE5 skeleton. Compatible with Marketplace animations and Mannequin animation set.',
    boneCount: 67,
    hasFingers: true,
    hasFaceRig: false,
    rootBone: 'root',
    ikChains: [
      { name: 'Spine', startBone: 'pelvis', endBone: 'head' },
      { name: 'LeftArm', startBone: 'clavicle_l', endBone: 'hand_l' },
      { name: 'RightArm', startBone: 'clavicle_r', endBone: 'hand_r' },
      { name: 'LeftLeg', startBone: 'thigh_l', endBone: 'foot_l' },
      { name: 'RightLeg', startBone: 'thigh_r', endBone: 'foot_r' },
    ],
    mixamoMapping: [
      { sourceBone: 'mixamorig:Hips', targetBone: 'pelvis' },
      { sourceBone: 'mixamorig:Spine', targetBone: 'spine_01' },
      { sourceBone: 'mixamorig:Spine1', targetBone: 'spine_02' },
      { sourceBone: 'mixamorig:Spine2', targetBone: 'spine_03' },
      { sourceBone: 'mixamorig:Neck', targetBone: 'neck_01' },
      { sourceBone: 'mixamorig:Head', targetBone: 'head' },
      { sourceBone: 'mixamorig:LeftShoulder', targetBone: 'clavicle_l' },
      { sourceBone: 'mixamorig:LeftArm', targetBone: 'upperarm_l' },
      { sourceBone: 'mixamorig:LeftForeArm', targetBone: 'lowerarm_l' },
      { sourceBone: 'mixamorig:LeftHand', targetBone: 'hand_l' },
      { sourceBone: 'mixamorig:RightShoulder', targetBone: 'clavicle_r' },
      { sourceBone: 'mixamorig:RightArm', targetBone: 'upperarm_r' },
      { sourceBone: 'mixamorig:RightForeArm', targetBone: 'lowerarm_r' },
      { sourceBone: 'mixamorig:RightHand', targetBone: 'hand_r' },
      { sourceBone: 'mixamorig:LeftUpLeg', targetBone: 'thigh_l' },
      { sourceBone: 'mixamorig:LeftLeg', targetBone: 'calf_l' },
      { sourceBone: 'mixamorig:LeftFoot', targetBone: 'foot_l' },
      { sourceBone: 'mixamorig:RightUpLeg', targetBone: 'thigh_r' },
      { sourceBone: 'mixamorig:RightLeg', targetBone: 'calf_r' },
      { sourceBone: 'mixamorig:RightFoot', targetBone: 'foot_r' },
    ],
  },
  {
    id: 'metahuman',
    name: 'MetaHuman',
    description: 'Full MetaHuman rig with face bones. For high-fidelity characters with facial animation.',
    boneCount: 584,
    hasFingers: true,
    hasFaceRig: true,
    rootBone: 'root',
    ikChains: [
      { name: 'Spine', startBone: 'pelvis', endBone: 'head' },
      { name: 'LeftArm', startBone: 'clavicle_l', endBone: 'hand_l' },
      { name: 'RightArm', startBone: 'clavicle_r', endBone: 'hand_r' },
      { name: 'LeftLeg', startBone: 'thigh_l', endBone: 'foot_l' },
      { name: 'RightLeg', startBone: 'thigh_r', endBone: 'foot_r' },
    ],
    mixamoMapping: [],  // MetaHuman requires custom retargeting workflow
  },
  {
    id: 'minimal-humanoid',
    name: 'Minimal Humanoid',
    description: 'Simplified 25-bone skeleton for indie games. Lower overhead, easier to animate.',
    boneCount: 25,
    hasFingers: false,
    hasFaceRig: false,
    rootBone: 'Root',
    ikChains: [
      { name: 'Spine', startBone: 'Pelvis', endBone: 'Head' },
      { name: 'LeftArm', startBone: 'LeftShoulder', endBone: 'LeftHand' },
      { name: 'RightArm', startBone: 'RightShoulder', endBone: 'RightHand' },
      { name: 'LeftLeg', startBone: 'LeftThigh', endBone: 'LeftFoot' },
      { name: 'RightLeg', startBone: 'RightThigh', endBone: 'RightFoot' },
    ],
    mixamoMapping: [
      { sourceBone: 'mixamorig:Hips', targetBone: 'Pelvis' },
      { sourceBone: 'mixamorig:Spine2', targetBone: 'Spine' },
      { sourceBone: 'mixamorig:Neck', targetBone: 'Neck' },
      { sourceBone: 'mixamorig:Head', targetBone: 'Head' },
      { sourceBone: 'mixamorig:LeftShoulder', targetBone: 'LeftShoulder' },
      { sourceBone: 'mixamorig:LeftArm', targetBone: 'LeftUpperArm' },
      { sourceBone: 'mixamorig:LeftForeArm', targetBone: 'LeftLowerArm' },
      { sourceBone: 'mixamorig:LeftHand', targetBone: 'LeftHand' },
      { sourceBone: 'mixamorig:RightShoulder', targetBone: 'RightShoulder' },
      { sourceBone: 'mixamorig:RightArm', targetBone: 'RightUpperArm' },
      { sourceBone: 'mixamorig:RightForeArm', targetBone: 'RightLowerArm' },
      { sourceBone: 'mixamorig:RightHand', targetBone: 'RightHand' },
      { sourceBone: 'mixamorig:LeftUpLeg', targetBone: 'LeftThigh' },
      { sourceBone: 'mixamorig:LeftLeg', targetBone: 'LeftShin' },
      { sourceBone: 'mixamorig:LeftFoot', targetBone: 'LeftFoot' },
      { sourceBone: 'mixamorig:RightUpLeg', targetBone: 'RightThigh' },
      { sourceBone: 'mixamorig:RightLeg', targetBone: 'RightShin' },
      { sourceBone: 'mixamorig:RightFoot', targetBone: 'RightFoot' },
    ],
  },
];

export function getRigPreset(id: string): RigPreset | undefined {
  return RIG_PRESETS.find((p) => p.id === id);
}
