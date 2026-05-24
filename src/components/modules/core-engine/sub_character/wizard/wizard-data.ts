import type { LucideIcon } from 'lucide-react';
import { User, Download, Boxes } from 'lucide-react';
import type { CharacterSource } from '@/lib/cli-task';
import { UE_KNOWN_ASSETS, ENEMY_CONTRAST_MATERIALS } from '@/lib/knowledge/ue-known-assets';

const knownPath = (id: string) => UE_KNOWN_ASSETS.find((a) => a.id === id)?.path ?? '';
const ENEMY_RED = ENEMY_CONTRAST_MATERIALS.find((m) => m.isDefault)?.path ?? '/Game/VerticalSlice/M_EnemyRed';

export interface SourceOption {
  id: CharacterSource;
  label: string;
  icon: LucideIcon;
  blurb: string;
}

export const SOURCES: SourceOption[] = [
  { id: 'mannequin', label: 'UE Mannequin', icon: User, blurb: 'Free, no download — the MoverTests engine plugin. Fastest path.' },
  { id: 'mixamo', label: 'Mixamo', icon: Download, blurb: 'Manual FBX download + retarget. Library of attack/locomotion anims.' },
  { id: 'blender', label: 'Custom (Blender)', icon: Boxes, blurb: 'Procedural / authored mesh. Hardest — author at unit scale 1.0.' },
];

export interface SetupAssets {
  playerMesh: string;
  enemyMesh: string;
  animBlueprint: string;
  enemyMaterial: string;
}

export const SOURCE_DEFAULTS: Record<CharacterSource, SetupAssets> = {
  mannequin: {
    playerMesh: knownPath('skm-manny'),
    enemyMesh: knownPath('skm-manny-simple'),
    animBlueprint: knownPath('abp-manny'),
    enemyMaterial: ENEMY_RED,
  },
  mixamo: {
    playerMesh: '/Game/Characters/Mixamo/SK_Player',
    enemyMesh: '/Game/Characters/Mixamo/SK_Enemy',
    animBlueprint: '/Game/Characters/ABP_ARPGCharacter',
    enemyMaterial: ENEMY_RED,
  },
  blender: {
    playerMesh: '/Game/Characters/Custom/SK_Player',
    enemyMesh: '/Game/Characters/Custom/SK_Enemy',
    animBlueprint: '/Game/Characters/ABP_ARPGCharacter',
    enemyMaterial: ENEMY_RED,
  },
};

export const ENABLE_PROMPT: Record<CharacterSource, string> = {
  mannequin: 'Prepare the UE Mannequin character source: enable the experimental MoverTests engine plugin in the .uproject if it is not already enabled, regenerate project files, and trigger an asset-registry rescan of the /MoverTests mount so SKM_Manny, SKM_Manny_Simple and ABP_Manny become referenceable (newly-enabled plugin content is invisible until rescanned). Confirm the asset paths resolve.',
  mixamo: 'Prepare the Mixamo character source: confirm the target skeleton (SK_Mannequin) exists, then use the Mixamo Import workflow (Animations module / mixamo_pipeline.py) to import + retarget the downloaded FBX animations. Report the resulting skeletal mesh + skeleton content paths.',
  blender: 'Prepare the Custom (Blender) character source: author/export the character mesh from Blender at unit scale 1.0 and import it into UE under /Game/Characters/Custom (import_uniform_scale = 1.0). Report the imported skeletal mesh + skeleton content paths.',
};

export const ASSET_LABELS: Record<keyof SetupAssets, string> = {
  playerMesh: 'Player skeletal mesh',
  enemyMesh: 'Enemy skeletal mesh',
  animBlueprint: 'Animation Blueprint',
  enemyMaterial: 'Enemy material (strong contrast)',
};
