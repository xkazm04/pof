/**
 * Real UE asset paths the project already has (or a documented fallback), so
 * generation prompts reference exact paths instead of inventing them.
 * Ground-truthed by the vertical-slice Characters sub-project + the enemy-AI
 * deliverable. Mirrors the `ue-gotchas.ts` pattern.
 */
export interface KnownAsset {
  id: string;
  /** Exact UE content path. */
  path: string;
  /** Asset type, e.g. 'SkeletalMesh', 'AnimBlueprint', 'MaterialInstance'. */
  type: string;
  description: string;
  /** Where it comes from, e.g. 'MoverTests plugin', 'project'. */
  source: string;
  /** Relevance tags so a prompt only carries the assets its domain needs. */
  domains: string[];
}

export const UE_KNOWN_ASSETS: KnownAsset[] = [
  {
    id: 'skm-manny',
    path: '/MoverTests/Characters/Mannequins/Meshes/SKM_Manny',
    type: 'SkeletalMesh',
    description:
      'Rigged player mannequin (UE 5.7 MoverTests plugin). No download — enable the plugin.',
    source: 'MoverTests plugin',
    domains: ['character', 'animation'],
  },
  {
    id: 'skm-manny-simple',
    path: '/MoverTests/Characters/Mannequins/Meshes/SKM_Manny_Simple',
    type: 'SkeletalMesh',
    description: 'Simplified mannequin used for the enemy in the vertical slice.',
    source: 'MoverTests plugin',
    domains: ['character', 'animation'],
  },
  {
    id: 'sk-mannequin',
    path: '/MoverTests/Characters/Mannequins/Meshes/SK_Mannequin',
    type: 'Skeleton',
    description: 'Target skeleton for Mixamo retargeting (mixamo_pipeline.py default).',
    source: 'MoverTests plugin',
    domains: ['character', 'animation'],
  },
  {
    id: 'abp-manny',
    path: '/MoverTests/Characters/Mannequins/Animations/ABP_Manny',
    type: 'AnimBlueprint',
    description:
      'Ready-made locomotion AnimBP (idle/walk/run) — avoids the AnimBP-authoring wall. Generated class: ABP_Manny_C.',
    source: 'MoverTests plugin',
    domains: ['character', 'animation'],
  },
  {
    id: 'mi-manny-01',
    path: '/MoverTests/Characters/Mannequins/Materials/Instances/Manny/MI_Manny_01',
    type: 'MaterialInstance',
    description: 'Default mannequin material instance (player).',
    source: 'MoverTests plugin',
    domains: ['character'],
  },
  {
    id: 'mi-manny-02',
    path: '/MoverTests/Characters/Mannequins/Materials/Instances/Manny/MI_Manny_02',
    type: 'MaterialInstance',
    description:
      'Alternate mannequin MI — TOO SUBTLE for visual enemy distinction; prefer M_EnemyRed.',
    source: 'MoverTests plugin',
    domains: ['character'],
  },
  {
    id: 'm-enemy-red',
    path: '/Game/VerticalSlice/M_EnemyRed',
    type: 'Material',
    description:
      'Strong-red enemy material (base + emissive) — the enemy-distinction default, clearly distinct from the silver player mannequin.',
    source: 'project',
    domains: ['character'],
  },
  {
    id: 'thirdperson-mannequin-fallback',
    path: '/Game/Characters/Mannequins/ (ThirdPerson template — only if migrated)',
    type: 'SkeletalMesh + AnimBlueprint',
    description:
      'FALLBACK only: the ACharacter-based ThirdPerson mannequin + ABP_Manny/ABP_Quinn, to migrate into /Game/Characters/ if MoverTests ABP_Manny is ever found Mover-coupled. Documented, not the default.',
    source: 'ThirdPerson template',
    domains: ['character', 'animation'],
  },
];

/**
 * Strongly-contrasting enemy materials for the "create enemy variant" flow.
 *
 * Lesson from the Characters sub-project: `MI_Manny_02` was TOO SUBTLE to tell
 * the enemy apart from the player, so the slice switched to a strong-red
 * `M_EnemyRed`. The variant flow therefore defaults to a high-contrast colour
 * (red / blue / green), never a mannequin material instance.
 */
export interface EnemyContrastMaterial {
  id: string;
  label: string;
  /** Plain colour name (not a hex literal) — the visual-distinction intent. */
  color: string;
  /** Suggested project material path to create / reuse. */
  path: string;
  isDefault?: boolean;
  description: string;
}

export const ENEMY_CONTRAST_MATERIALS: EnemyContrastMaterial[] = [
  {
    id: 'enemy-red',
    label: 'Red (default)',
    color: 'red',
    path: '/Game/VerticalSlice/M_EnemyRed',
    isDefault: true,
    description:
      'Strong red base + emissive — the proven enemy-distinction default, clearly distinct from the silver player mannequin.',
  },
  {
    id: 'enemy-blue',
    label: 'Blue',
    color: 'blue',
    path: '/Game/VerticalSlice/M_EnemyBlue',
    description: 'Strong blue alternative for a second enemy faction / archetype.',
  },
  {
    id: 'enemy-green',
    label: 'Green',
    color: 'green',
    path: '/Game/VerticalSlice/M_EnemyGreen',
    description: 'Strong green alternative for a third enemy faction / archetype.',
  },
];

/**
 * Render the known assets whose `domains` intersect `domains` as a markdown
 * block. Returns '' when `domains` is empty or nothing matches — so prompts
 * that don't opt in (or aren't character/animation) are unaffected.
 */
export function formatKnownAssets(domains: string[]): string {
  if (!domains || domains.length === 0) return '';
  const relevant = UE_KNOWN_ASSETS.filter((a) =>
    a.domains.some((d) => domains.includes(d)),
  );
  if (relevant.length === 0) return '';
  const lines = relevant.map(
    (a) => `- **${a.path}** (${a.type}, ${a.source}) — ${a.description}`,
  );
  return `## Known Project Assets (use these EXACT paths — do not invent paths)\n${lines.join('\n')}`;
}

/**
 * Map a PoF module id to the known-asset domains its generation prompts should
 * carry. Returns [] for modules that don't deal with characters/animation, so
 * `formatKnownAssets([])` injects nothing.
 */
export function knownAssetDomainsForModule(moduleId: string): string[] {
  switch (moduleId) {
    case 'arpg-character':
    case 'arpg-animation':
      return ['character', 'animation'];
    case 'arpg-enemy-ai':
      return ['character'];
    default:
      return [];
  }
}
