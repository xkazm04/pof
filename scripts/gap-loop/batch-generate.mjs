/**
 * gap-loop — batch-generate real Lucid Origin images for 2D-art steps from a targets
 * manifest, save jpgs, and emit a gate manifest for the batch Qwen critique
 * (scripts/visual-gen/pof_vlm_batch.py — one model load for N images).
 *
 * Promoted from the batch-3 scratchpad (2026-07-13) with Style DNA wired in: every
 * generation passes `applyStyleDna: true` so the whole batch inherits the project's
 * active style profile. Set POF_STYLE_DNA=off for a style-neutral batch.
 *
 *   node scripts/gap-loop/batch-generate.mjs <targets.json> [gate-manifest.json]
 * targets.json = [{catalogId, entityId, step}, ...]
 * env: POF_ORIGIN (default http://localhost:3001), POF_STYLE_DNA=off
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ORIGIN = process.env.POF_ORIGIN || 'http://localhost:3001';
const APPLY_STYLE = process.env.POF_STYLE_DNA !== 'off';
const OUTDIR = join(process.cwd(), 'generated', 'icons');
mkdirSync(OUTDIR, { recursive: true });

const targetsPath = process.argv[2];
if (!targetsPath) { console.error('usage: node batch-generate.mjs <targets.json> [gate-manifest.json]'); process.exit(1); }
const manifestPath = process.argv[3] || join(dirname(targetsPath), 'gate-manifest.json');
const targets = JSON.parse(readFileSync(targetsPath, 'utf8'));

// tailored prompt + Qwen subject per (catalog, step). Fallbacks build a generic icon.
const ICON = (what) => ({
  prompt: `game UI icon of ${what}, centered single subject, dark neutral background, painterly dark-fantasy ARPG art, crisp readable silhouette, no text, no watermark`,
  subject: `a clean centered game UI icon of ${what}, usable in a dark-fantasy ARPG interface, crisp silhouette, no text/watermark`,
});
const SPECIAL = {
  'character-pipeline|Concept 2D': { prompt: 'character concept art, full-body dark-fantasy rogue with dual pistols and blue braids, dynamic hero pose, painterly game concept, neutral studio background, no text', subject: 'full-body dark-fantasy character concept art of a rogue hero, clear anatomy and readable silhouette, no text/watermark' },
  'factions|Heraldry Icon': ICON('a faction heraldry sigil: a stylized ash-ring emblem, emblematic and symmetrical, metallic and ember tones'),
  'hud-elements|Wireframe': { prompt: 'clean UI wireframe mockup of a game health bar HUD element, flat schematic line-art, greybox, labeled anchor box, minimal, no color fill', subject: 'a schematic UI wireframe of a health-bar HUD element, clean line-art layout, no photographic content' },
  'input-schemes|Input Glyphs': { prompt: 'set of gamepad button glyph icons (A B X Y bumpers triggers dpad), clean flat UI glyph sheet, dark background, crisp vector-style, no text labels', subject: 'a sheet of clean gamepad button glyph icons, flat UI style, crisp and readable' },
  // Defect-informed (2026-08-04): the strict judge scored the previous draw 56 — "tonally flat
  // and muddy in the mid-grey range, with no deliberate value structure to guide the eye".
  'materials|Maps': { prompt: 'seamless PBR albedo texture of weathered grey stone, tileable, flat orthographic top-down, even lighting, DELIBERATE VALUE STRUCTURE with distinct dark recessed mortar joints and bright chipped highlight edges, wide tonal range from near-black crevices to pale worn faces, crisp high-frequency granite grain, no object, no text', subject: 'a seamless tileable PBR albedo texture of weathered stone, flat and evenly lit, wide deliberate value range (dark joints, bright chipped edges), no 3D object' },
  // Judge scored 45 — "four distinct sub-shapes, not one glyph, and the top finial is detached".
  'hud-elements|Icon 2D Art': { prompt: 'a single unified game HUD health emblem: ONE continuous heart-vial silhouette, no separate frame, no wings, no spikes, no floating finial, no detached parts, one solid connected shape, crimson glass with a bright rim light, flat dark background, crisp readable at 32px, no text, no watermark', subject: 'a single unified HUD health icon: exactly ONE connected shape (no frame, wings, spikes or detached pieces), crisp and legible at 32px, no text/watermark' },
  // Judge scored 71 — "flat orange-to-yellow gradient glow ... lacks the material weight".
  'music|Icon 2D Art': { prompt: 'a game UI music-track emblem: a single musical note as a SOLID FORGED METAL object with real material weight, brushed bronze body, dark bevelled edges, molten ember light glowing from within the note core casting warm rim light, clear specular highlights, deep dark plaque background, painterly dark-fantasy ARPG, crisp silhouette, no text, no watermark', subject: 'a music-track UI icon whose note reads as a solid forged metal object with real material weight and internal ember glow, not a flat gradient, no text/watermark' },
  'vfx|Material': { prompt: 'seamless additive VFX texture sheet of a fire impact burst, radial ember and smoke, black background for additive blending, tileable particle art, no text', subject: 'an additive VFX texture for a fire-impact particle, radial burst on black background, usable as a game particle sprite' },
  'tutorial-beats|Pointer / Highlight 2D': ICON('a tutorial pointer/highlight indicator: a glowing directional arrow and highlight ring, clean UI overlay art'),
};
const WHAT = {
  'dialog-trees': 'a dialogue/conversation marker (speech bubble with a rune)',
  'hud-elements': 'a health-bar HUD emblem (a heart/vial motif)',
  'icon-sets': 'a generic ability icon emblem',
  'loot-tables': 'a loot/treasure drop emblem (coins and a gem)',
  'materials': 'a material swatch orb of weathered stone',
  'music': 'a music track emblem (a glowing musical note over a combat motif)',
  'progression-curves': 'a level-up / XP progression emblem (an ascending rune arc)',
  'props': 'a reinforced wooden crate prop',
  'quests': 'a quest emblem (an ember pact seal / burning oath sigil)',
  'save-points': 'a save-point bonfire',
  'screen-flow': 'a UI screen-flow emblem (linked window panels)',
  'spellbook': 'an arcane firebolt spell ability icon',
  'state-graph': 'an attack-combo animation state emblem (motion arcs of a sword combo)',
  'status-effects': 'a burning status-effect icon (flame over a target)',
  'tutorial-beats': 'a dodge/roll tutorial emblem',
  'vendors': 'a wandering-merchant vendor emblem (a coin purse and scales)',
  'vfx': 'a fire-impact VFX emblem',
  'zone-map': 'a zone map emblem (a stylized region map marker)',
};

let styleApplied = null;

async function gen(prompt, w = 512, h = 512) {
  const r = await fetch(`${ORIGIN}/api/leonardo`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'image', prompt, opts: { width: w, height: h }, applyStyleDna: APPLY_STYLE }) });
  const j = await r.json();
  if (j.success === false) throw new Error(j.error);
  styleApplied = j.data?.styleDnaApplied ?? null;
  return j.data?.imageBase64;
}

console.log(`Batch of ${targets.length} targets (styleDna=${APPLY_STYLE ? 'on' : 'off'})`);
const manifest = [];
for (const t of targets) {
  const key = `${t.catalogId}|${t.step}`;
  const s = SPECIAL[key] || ICON(WHAT[t.catalogId] || `${t.catalogId} ${t.step}`);
  const id = `${t.catalogId}__${t.step}`.replace(/[^a-z0-9]+/gi, '_');
  const isMap = /Maps|Material|Wireframe|Concept 2D/.test(t.step);
  try {
    const b64 = await gen(s.prompt, isMap ? 768 : 512, isMap ? 768 : 512);
    const file = join(OUTDIR, `${id}.jpg`);
    writeFileSync(file, Buffer.from(b64, 'base64'));
    manifest.push({ id, file, subject: s.subject, catalogId: t.catalogId, step: t.step, entityId: t.entityId, prompt: s.prompt, styleDna: styleApplied });
    console.log(`OK  ${t.catalogId}::${t.step}${styleApplied ? ` (style: ${styleApplied})` : ''}`);
  } catch (e) {
    console.log(`ERR ${t.catalogId}::${t.step} -> ${String(e).slice(0, 120)}`);
  }
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`\nGENERATED ${manifest.length} images -> ${manifestPath}${styleApplied ? ` (project style: "${styleApplied}")` : ''}`);
