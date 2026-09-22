/**
 * Diablo I's generation-ready style (/diablo W03, decisions D13 + D13b).
 *
 * The diablo1 ART canon pasted into an image prompt as prose (W02d) produced a painterly frontal
 * skeleton/goat hybrid with a fabricated "© Diablo II" mark: the canon's subject words (monster
 * family names) contaminated the subject and the franchise name invited a watermark. This is the
 * canon DISTILLED for generation — style only, appended to every diablo1 entity's image/3D prompt
 * through `styleDnaForProfile` when no Style DNA is bound to the profile in the DB.
 *
 * Distilled by codex task cx-006 (GPT Astra, read-only) from d1-visual-identity, d1-palette,
 * d1-lighting, d1-camera, d1-sprite-read, d1-materials, d1-monsters and d1-ue-translation; reviewed
 * by the overseer. Laws: no franchise/studio/product/character names, no subject nouns, at most
 * four items per list (the fragment renderer's cap). The rules a prompt CANNOT enforce (native
 * resolution, the 2:1 projection, the sub-midgray value share) need instruments, not words.
 */
import type { StyleDna } from '@/lib/visual-gen/style-dna';

export const DIABLO1_STYLE_DNA: StyleDna = {
  palette: [
    "charcoal blacks and desaturated slate blue-gray",
    "dirty umber, dull metallic gray and aged ivory",
    "selective saturated red, blue, green and gold",
    "in dark interiors, predominantly sub-midgray non-emissive values",
  ],
  materials: [
    "chipped mineral surfaces with broad cracks",
    "dark metal faces with small bright edges and selective polish",
    "coarse fibrous grain and broad fabric folds",
    "selective coarse wear and isolated jewel-like glints",
  ],
  mood: [
    "oppressive darkness and grim decay",
    "bounded pools of light falling in steps to black",
    "legible volume under localized illumination",
    "restrained glow and deep unlifted blacks",
  ],
  render: [
    "modeled volume reduced to coarse sprite pixels",
    "compact highlight clusters and stepped shadow ramps",
    "for gameplay, elevated parallel projection with a 2:1 ground diamond",
    "crisp unoutlined forms, sharp focus and unblurred edges",
  ],
  motifs: [
    "bold asymmetric silhouettes",
    "exaggerated identifying masses",
    "large forms separated by value",
    "sparse angular surface breaks",
  ],
};
