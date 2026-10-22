/**
 * Tripo text-to-3D prompt packs (mirrors `audioPrompts.ts` / `iconPrompts.ts`). Each pack is a
 * subject-agnostic craft clause expressing the game-ready dark-fantasy ARPG mesh direction per
 * `AssetClass` — closed geometry, clean topology, even UVs, plausible PBR, neutral presentation —
 * plus one shared negative/quality tail. `meshPromptFor(assetClass, subject)` composes
 * subject → class clause → shared tail.
 *
 * Consumed by `src/app/api/visual-gen/generate/route.ts`, which composes only for `text-to-3d`
 * AFTER shape routing has seen the RAW prompt, so the runner still receives a single prompt string.
 * An absent or unrecognised assetClass has no pack: `meshPromptFor` returns null and the caller
 * keeps the prompt byte-identical to what it sent before the pack existed.
 *
 * NOTE (not measured): these clauses have NO measured ceiling. Nothing has scored generated meshes
 * against them yet, so there is no evidence they lift output quality. They are a first-draft craft
 * direction, to be validated by the Tier-1 mesh critique / judging before being trusted.
 */
import { resolveAssetClass, type AssetClass } from '@/lib/visual-gen/polycount-presets';

/** Failure modes to steer text-to-3D away from, appended to every packed prompt. */
export const MESH_NEG_TAIL =
  'Single closed watertight shell, no holes, no floating or detached fragments. ' +
  'No base plinth, no pedestal, no ground plane, no background, no scene dressing. ' +
  'No text, no watermark, no logo. Game-ready asset, even texel density, PBR-plausible materials.';

interface MeshPack {
  /** Subject-agnostic craft direction for the class. Composed after the subject. */
  clause: string;
}

/** One pack per `AssetClass` the polycount presets define. */
export const MESH_PACKS: Record<AssetClass, MeshPack> = {
  character: {
    clause:
      'Dark-fantasy action-RPG character, full body in a neutral A-pose, standing upright and symmetric, ' +
      'arms clear of the torso and legs slightly apart so limbs are separable for rigging. Clean ' +
      'quad-dominant topology with edge loops at joints, worn leather, dull steel and weathered cloth, ' +
      'grim and grounded, not cartoonish.',
  },
  weapon: {
    clause:
      'Dark-fantasy action-RPG hand-held weapon, a single object presented upright and straight in a ' +
      'neutral pose, readable silhouette from the side. Clean quad-dominant topology, crisp bevelled ' +
      'edges, worn forged iron and steel, wrapped leather grip, nicked and weathered, no glow effects.',
  },
  prop: {
    clause:
      'Dark-fantasy action-RPG environment prop, a single standalone object presented upright in its ' +
      'natural orientation, readable silhouette. Clean quad-dominant topology, chunky readable forms, ' +
      'aged wood, rusted iron, cracked stone, moss and grime kept in the material rather than modelled.',
  },
  environment: {
    clause:
      'Dark-fantasy action-RPG environment piece, a single self-contained structure or set-piece with a ' +
      'clear silhouette, viewed in a neutral upright orientation. Clean quad-dominant topology, ' +
      'weathered stone, rotting timber and rusted metal, large readable forms over fine clutter.',
  },
  'modular-part': {
    clause:
      'Dark-fantasy action-RPG modular kit piece, a single tileable building part (wall, floor, arch or ' +
      'pillar) presented upright and axis-aligned with flat, square-cut edges that snap to a grid. Clean ' +
      'quad-dominant topology, even UVs, worn stone or timber, no surrounding structure.',
  },
};

/**
 * Compose the prompt sent to Tripo. Pure: never mutates its input. Returns null for an absent or
 * unrecognised assetClass so the caller can keep its prompt byte-identical.
 */
export function meshPromptFor(assetClass: string | undefined, subject: string): string | null {
  const resolved = resolveAssetClass(assetClass).assetClass;
  if (!resolved) return null;
  return `${subject.trim().replace(/\.$/, '')}. ${MESH_PACKS[resolved].clause} ${MESH_NEG_TAIL}`;
}
