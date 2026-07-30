/**
 * Current version per craft lens — the invalidation switch for the A-axis.
 *
 * A craft verdict records the `lensVersion` it was gauged under; `craftOf`
 * (src/lib/status/craft.ts) projects any verdict scored under an OLDER version as
 * A0 UNGAUGED. So "the lens changed" is expressed by bumping the number here (and in
 * the lens file's frontmatter — a test pins the two together), never by silently
 * re-meaning existing scores.
 *
 * Bump when a lens's criteria, anchors, or level boundaries change in a way that
 * could move a score. Typo fixes don't bump.
 */
import type { LensId } from './lens-map';

export const LENS_VERSIONS: Record<LensId, number> = {
  'game-systems-code': 1,
  narrative: 1,
  dialogue: 1,
  voiceover: 1,
  audio: 1,
  vfx: 1,
  '2d-art': 1,
  '3d-art': 1,
  animation: 1,
  'production-process': 1,
};
