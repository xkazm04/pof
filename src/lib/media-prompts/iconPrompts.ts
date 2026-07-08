/**
 * Hardened icon image-prompt packs (Quality Program WS1 — banked from the wave-2 Lucid Origin
 * hardening agents). Each family's clause is the transferable, subject-agnostic technique that
 * lifted a representative icon +16 to +45 points on Leonardo Lucid Origin (the pipeline's model).
 * `iconPromptFor(catalogId, subject)` composes the Leonardo prompt: subject → family style/material
 * clause → shared negative tail.
 *
 * NOTE (validated ceiling): these clauses reliably reach ~66-73 on Lucid Origin — competent
 * placeholder, not shippable-90. The wall is Lucid's materialRendering/edgeQuality fidelity, not
 * the prompt (see .claude/quality-hardening/*.json). Reaching 90 needs a refinement stage
 * (img2img / style-reference / upscale) or a higher-fidelity model — a deliberate, deferred call.
 */

export type IconFamily = 'ability-fx' | 'character-2d' | 'emblem-system' | 'item-object' | 'environment-scene' | 'hud-ui';

/** The failure modes every agent converged on banning (Lucid stamps fake text on brand tokens,
 *  renders infographics literally, and defaults to flat vector). Appended to every icon prompt. */
export const NEG_TAIL =
  'NOT a flat vector emoji, NOT a smooth sticker, NOT a cel-shaded outline, NOT a photographic render, ' +
  'NOT soft blurry mush. No text, no letters, no numbers, no watermark, no signature, no logo, no border frame, no icon grid.';

interface FamilyPack {
  catalogs: string[];
  /** Best strict-judge score reached on Lucid Origin (documents the honest ceiling). */
  ceiling: number;
  /** Subject-agnostic framing + art-style + material direction. Composed after the subject. */
  clause: string;
}

export const ICON_FAMILIES: Record<IconFamily, FamilyPack> = {
  'ability-fx': {
    catalogs: ['status-effects', 'spellbook', 'vfx', 'icon-sets'],
    ceiling: 72,
    clause:
      'Fill a square icon frame edge-to-edge as ONE bold chunky emblem on a near-black field, legible at 32px, no border. ' +
      'Grim painterly buff-icon craft of Path of Exile 2, Diablo IV and Hades II: sculpted hand-painted rendering with real ' +
      'material weight and tactile texture. Give the effect a TEXTURED MATERIAL SUBSTRATE (Lucid renders a bare effect as flat ' +
      'cel-shading) — e.g. charred cracked embers, cracked stone, frosted rime. Tight continuous value ramp from a searing ' +
      'bright core to deep cool edges; strong specular rim-light sculpting the form so it snaps off the dark field with a crisp ' +
      'hard silhouette, no fuzzy halo. Scatter a few bright particulate sparks for an active read.',
  },
  'character-2d': {
    catalogs: ['characters', 'character-pipeline', 'bestiary'],
    ceiling: 73,
    clause:
      'Tight three-quarter BUST, head-and-shoulders, a distinctive dark-fantasy hero identity. Warm directional key from upper ' +
      'left with a bright COOL rim-light tracing the far cheek, jaw and shoulder to cut a crisp silhouette off a dark graphite ' +
      'background (the figure\'s lower mass must NOT collapse into black). Painterly AAA key-art in the hand-painted style of ' +
      'Diablo IV / Path of Exile 2 class-select splash and Hades II portraits — confident visible oil brushwork, thick impasto, ' +
      'rich continuous value, art-directed HARD edges. Physically grounded materials: subsurface skin, sharp bright specular on ' +
      'metal, sculptural cloth folds. Cinematic chiaroscuro, muted desaturated palette with ember accents.',
  },
  'emblem-system': {
    catalogs: ['progression-curves', 'state-graph', 'achievements', 'factions', 'quests', 'vendors', 'codex', 'music', 'materials'],
    ceiling: 70,
    clause:
      'ONE bold clean crest, BOLD chunky forms with generous negative space and MINIMAL fine filigree (Lucid blurs dense detail ' +
      'into mush — keep forms large), one strong shape legible at 64px, frontal and symmetric. Sculpted metalwork emblem language ' +
      'of Path of Exile 2 and Diablo IV: each metal form a modeled bevel with a warm bright highlight edge top-left and a cool ' +
      'reflected shadow bottom-right, and a hard DARK RIM-LINE separating every element from its neighbour and from the near-black ' +
      'field so edges stay razor crisp. Hand-painted volumetric impasto, maximum contrast. NO bar chart, NO graph, NO arrow, NO infographic.',
  },
  'item-object': {
    catalogs: ['items', 'currencies', 'loot-tables', 'crafting-recipes'],
    ceiling: 68,
    clause:
      'Single hero object angled DIAGONALLY about 35 degrees corner-to-corner, scaled large to fill the square loot-grid cell. ' +
      'Bold painterly digital illustration in the flat, saturated, punchy high-contrast finish of Diablo IV and Path of Exile 2 ' +
      'item icons, confident visible brushwork. Hard beveled material with a crisp bright cool-white specular edge line down the ' +
      'lit bevel and the opposite bevel dropping to deep near-black core shadow — a full black-to-white value range, NOT a flat ' +
      'mid-grey gradient. Worn surface detail (planished facets, grind lines, pitting, edge nicks). Controlled top-left key light, ' +
      'cleanly separated from a flat dark charcoal background. No magic glow, no rim halo, no colour wash.',
  },
  'environment-scene': {
    catalogs: ['cutscenes', 'ambient', 'combat-map', 'zone-map', 'tutorial-beats'],
    ceiling: 66,
    clause:
      'Cinematic ARPG key frame with THREE-PLANE depth: dark foreground framing → a small sharply rim-lit hero as the mid-ground ' +
      'focal point → hazy atmospheric background. Hand-painted fully-rendered concept art, crisp intentional edges; every form ' +
      'carries rendered material and light, not flat silhouettes. Dramatic key and rim lighting, one volumetric god-ray shaft, ' +
      'drifting fog and embers. Moody teal-and-orange grade, deep shadows, high-contrast value hierarchy, diagonal composition. ' +
      'Sharp focal detail on the hero, softer distant haze. Do NOT name "title card" or "cinematics" (Lucid stamps fake typography). Clean unmarked frame.',
  },
  'hud-ui': {
    catalogs: ['input-schemes', 'hud-elements', 'screen-flow', 'save-points'],
    ceiling: 61,
    clause:
      'ONE clean centered game-HUD glyph, premium AAA UI iconography (Path of Exile 2 / Diablo IV / Hades II), front-on ' +
      'orthographic, tightly centered and symmetric, reads instantly. Rendered as a physically-lit element with RESTRAINED real ' +
      'material — a smooth dark satin-metal face (ONE face, no competing concentric rings), a crisp top rim light, soft ambient ' +
      'occlusion in the lower edge, a defined three-value structure. The primary symbol is the single brightest, highest-contrast ' +
      'shape. Crisp intentional edges, legible at 40px, on a plain dark charcoal background. Avoid emboss / gloss / bloom (Lucid ghosts and blooms them).',
  },
};

/** catalogId → family (first family that lists the catalog). */
export const CATALOG_TO_FAMILY: Record<string, IconFamily> = Object.entries(ICON_FAMILIES).reduce(
  (m, [fam, pack]) => { for (const c of pack.catalogs) m[c] = fam as IconFamily; return m; },
  {} as Record<string, IconFamily>,
);

/** Compose the hardened Lucid Origin icon prompt for a catalog's subject, or null if no pack. */
export function iconPromptFor(catalogId: string, subject: string): string | null {
  const fam = CATALOG_TO_FAMILY[catalogId];
  if (!fam) return null;
  return `${subject.trim().replace(/\.$/, '')}. ${ICON_FAMILIES[fam].clause} ${NEG_TAIL}`;
}
