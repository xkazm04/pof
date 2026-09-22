/**
 * The `diablo1` canon profile — Diablo I (1996)'s world and art direction, for the /diablo
 * replication loop (W01, operator decision D5). WORLD + STYLE ONLY: no balance thresholds — every
 * PoF balance law is deliberately NOT inherited (see the vault's W01 note for the full conflict list).
 *
 * Drafted by gpt-6-astra (codex task cx-002, visual/design tier) from public references, reviewed by
 * the overseer and adopted with ONE edit: `d1-world` no longer names PoF's own lore in its exclusion list
 * (an image model cannot know what "post-Sundering symbols" are, and naming what to avoid invites it). Its own uncertainties (exact palettes, Hell's appearance,
 * costume details — it could not visually inspect screenshots) and each rule's CHECKABLE review
 * criterion live in the Obsidian vault (Diablo/Waves/W01-…), not here: they are review material for
 * W02's judge, not text for a producer. Citation URLs are carried as `refs`.
 *
 * This file is part of the reference-replication exercise and is deleted with it.
 */
import type { ProjectRule } from '../types';

/** PoF rules that are world-neutral ENGINEERING contracts, adopted unchanged under this profile. */
export const DIABLO1_INHERITS_POF: readonly string[] = [
  "proj-naming",
  "proj-sot",
  "proj-links",
  "proj-quality",
  "proj-hud-binding",
  "quest-reward-binding",
  "char-config-not-cpp",
  "input-remap-conflict",
  "input-a11y",
  "tutorial-telemetry",
  "arpg-affix-is-ge",
  "arpg-wiring-contract",
  "screen-flow-nav-contract",
];

export const DIABLO1_CANON: readonly ProjectRule[] = [
  // ── LAWS derived from the reference (W02 onward). Balance numbers come from the engine or the tables,
  //    never from PoF's canon; a checker or seeder PARSES them from these bodies (one statement per law).
  { id: 'd1-resistance-law', profile: 'diablo1', category: 'game', scope: 'bestiary', title: 'Monster resistance law (engine-derived)',
    body: "Monster resistance, derived from the engine: a RESIST flag for an element cuts that element's damage to one quarter, a 75% reduction; an IMMUNE flag means the hit does not land, a 100% reduction. Elements are magic, fire and lightning; the base game has no cold or chaos damage. There is no scale between: a monster is normal (0%), resistant (75%) or immune (100%) to each element.",
    refs: ["https://github.com/diasurgical/devilutionX/blob/4138a82/Source/missiles.cpp (MonsterMHit: resist -> dam >>= 2; isImmune -> no hit)", "https://github.com/diasurgical/devilutionX/blob/4138a82/Source/monster.cpp (Monster::isResistant / isImmune)"] },
  { id: "d1-world", profile: 'diablo1', category: "game", scope: "global", title: "Tristram and the corruption below",
    body: "Depict the medieval town of Tristram in Khanduras and the demonic corruption beneath its cathedral: church masonry, graves, hand tools, blades, books and occult shrines. Exclude firearms, machinery and later-series locations.",
    refs: ["https://hoffmeister.li/downloads/games/diablo_1/D1_manual_en.pdf"], },
  { id: "d1-tone", profile: 'diablo1', category: "game", scope: "global", title: "Personal-scale religious horror",
    body: "Stage personal-scale religious horror: isolated people, enclosing architecture, corpses, blood and violated sacred spaces. Heroes face danger in guarded working poses. Avoid victory parades, comic expressions, clean heroic pageantry and crowds posed like an army.", },
  { id: "d1-visual-identity", profile: 'diablo1', category: "art", scope: "global", title: "Prerendered volume at sprite resolution",
    body: "Match a 1996 prerendered sprite image: modeled volume reduced to coarse pixels, compact highlight clusters and stepped shadow ramps. Review gameplay at 640x480 before enlargement. No painterly brushwork, cartoon outlines, smooth vector surfaces, photographic pores or cinematic depth of field.", },
  { id: "d1-palette", profile: 'diablo1', category: "art", scope: "global", title: "Dark bases with selective strong color",
    body: "Use charcoal shadows, slate blue-gray stone, dirty brown earth, dull iron and aged bone as the base. Permit strong red, blue, green and gold on referenced creatures, gear, potions and magic; saturation is not reserved for rarity. For dungeon scenes, keep most non-emissive surfaces below middle gray.", },
  { id: "d1-lighting", profile: 'diablo1', category: "art", scope: "global", title: "Local visibility surrounded by darkness",
    body: "In dungeons, surround the hero with a local pool of visibility that falls through darker steps into black; torches, lava and spells create additional local light. Keep sprite volume legible without a universal sun direction. Avoid lifted black levels, broad bloom, cinematic rim lights and sunbeams through every room.", },
  { id: "d1-camera", profile: 'diablo1', category: "art", scope: "global", title: "Fixed diagonal gameplay projection",
    body: "For gameplay assets, use a fixed elevated diagonal view with parallel ground axes and a 2:1 diamond footprint. Show top surfaces and two sides without perspective convergence. Match the same projection for actors, props and floors; no horizon, vanishing point, camera roll or camera-facing portrait pose.", },
  { id: "d1-sprite-read", profile: 'diablo1', category: "art", scope: "global", title: "Directional silhouettes and stable feet",
    body: "Review actors at gameplay size with discrete eight-direction facing coverage, consistent scale and a stable foot pivot. Separate head, torso, weapon and feet through silhouette or value. Use short, distinct action poses; no motion-blur trails, smeared interpolation or dependence on facial microdetail.", },
  { id: "d1-materials", profile: 'diablo1', category: "art", scope: "global", title: "Coarse material cues and selective wear",
    body: "Describe stone with chipped edges and broad cracks, iron with dark faces and small bright edges, wood with coarse grain, and cloth with broad folds. Keep wear readable at sprite scale. Permit polished weapon highlights and jewels; avoid covering every material in identical rust, fine scratches or wet gloss.", },
  { id: "d1-monsters", profile: 'diablo1', category: "game", scope: "bestiary", title: "Anatomically distinct horror families",
    body: "Give each creature a recognizable anatomical family: exposed rib cage for skeletons, heavy slack flesh for zombies, hunched small demons, horned goat-headed humanoids, broad beasts or armored infernal fighters. Exaggerate the identifying mass or appendage. Avoid cute faces, generic armored soldiers and decorative antlers on every species.",
    refs: ["https://hoffmeister.li/downloads/games/diablo_1/D1_manual_en.pdf"], },
  { id: "d1-monster-variants", profile: 'diablo1', category: "art", scope: "bestiary", title: "Variants preserve family identity",
    body: "Within an established monster family, preserve anatomy, silhouette and action poses while varying its referenced color treatment. Named monsters retain their identifiable body plan. Do not invent rarity crowns, floating badges, extra armor tiers or obligatory multiphase boss silhouettes.", },
  { id: "d1-player-heroes", profile: 'diablo1', category: "game", scope: "global", title: "The three original mortal heroes",
    body: "Use the original three hero identities: a broad male Warrior, a lean female Rogue, and a male Sorcerer. Establish sword-and-shield, bow, and staff silhouettes respectively when no equipment override is specified. Keep them human-sized and mortal; exclude later classes, oversized shoulder armor, angel wings and permanent power auras.",
    refs: ["https://hoffmeister.li/downloads/games/diablo_1/D1_manual_en.pdf"], },
  { id: "d1-hero-equipment", profile: 'diablo1', category: "art", scope: "global", title: "Armor changes broad material masses",
    body: "For the requested equipment state, distinguish light clothing or leather, linked metal armor, and solid plate with broad material masses. Keep class stature and pose recognizable after an armor change. Weapons remain separable from the torso. Do not invent a new visible costume attachment for every numerical item modifier.", },
  { id: "d1-env-tristram", profile: 'diablo1', category: "art", scope: "global", title: "Tristram: a surviving, subdued village",
    body: "When depicting Tristram, use a sparsely populated, still-standing village: timber-and-plaster houses, stone walls, pitched roofs, worn paths, grass, a well, smithy and cathedral graveyard. Use subdued outdoor illumination with local hearth warmth. Exclude the sequel's burned ruin, a bustling capital and permanent lava or dungeon-black darkness.", },
  { id: "d1-env-cathedral", profile: 'diablo1', category: "art", scope: "global", title: "Cathedral: levels 1-4",
    body: "For Cathedral levels 1-4, use cool gray-blue masonry, square flagstones, repeated Gothic arches, columns, barred openings and wooden doors. Arrange rectangular rooms and corridors; add braziers, book stands, sarcophagi and isolated blood. Keep built church architecture dominant; no cave walls or bone-built halls.",
    refs: ["https://www.boristhebrave.com/2019/07/14/dungeon-generation-in-diablo-1/", "https://www.ladyofthecake.com/diablo/dungeon.htm"], },
  { id: "d1-env-catacombs", profile: 'diablo1', category: "art", scope: "global", title: "Catacombs: levels 5-8",
    body: "For Catacombs levels 5-8, use darker brown rough masonry, earthen-looking floors, thick piers and broad stone openings. Wrap winding passages around enclosed rooms; use shrines, barrels and funerary debris sparingly. Make the space lower, rougher and more enclosed than Cathedral; no repeated blue Gothic nave or lava-dominated cavern.",
    refs: ["https://www.ladyofthecake.com/diablo/dungeon.htm"], },
  { id: "d1-env-caves", profile: 'diablo1', category: "art", scope: "global", title: "Caves: levels 9-12",
    body: "For Caves levels 9-12, use irregular rock walls, rough earth, open cavern pockets, narrow land connections and orange-red lava pools or channels. Include crude wooden fences, gates and short crossings where appropriate. Preserve dark rock against hot lava; exclude orderly church colonnades, ice caves and luminous crystal gardens.",
    refs: ["https://www.ladyofthecake.com/diablo/dungeon.htm"], },
  { id: "d1-env-hell", profile: 'diablo1', category: "art", scope: "global", title: "Hell: levels 13-16",
    body: "For Hell levels 13-16, use dark tiled floors, skeletal walls, rib-like arches, skull masses, fire and impaled bodies. Compose broad constructed chambers and passages in bone, charcoal and blood-red tones. Keep this infernal architecture distinct from the Caves' natural rock and lava; no clean obsidian palace or abstract cosmic void.",
    refs: ["https://www.ladyofthecake.com/diablo/dungeon.htm"], },
  { id: "d1-props", profile: 'diablo1', category: "art", scope: "props", title: "Readable dungeon objects",
    body: "Make doors, chests, barrels, book stands, shrines and torture fixtures compact objects with a clear base and usable face. Use iron bands, rough boards, carved stone, candles and bone details. Keep blood and debris as discrete readable patches; no quest-marker beams, hovering interaction labels or ornamental clutter hiding the floor.", },
  { id: "d1-inventory-icons", profile: 'diablo1', category: "art", scope: "global", title: "Inventory objects, not framed cards",
    body: "For inventory art, render one object as a compact shaded sprite with a crisp silhouette, dark contour and small material highlights. Use a view that exposes its defining parts; long weapons and armor may occupy several grid cells. Composite over the inventory's dark reddish-brown field. No scenery, baked labels, rarity frame or square-card crop.", },
  { id: "d1-item-color", profile: 'diablo1', category: "art", scope: "items", title: "Material color and original potion cues",
    body: "Use ordinary steel, wood, leather and cloth for equipment, with small jewel or gold accents where appropriate. Potion contents distinguish red life, blue mana and yellow rejuvenation. Do not add socket-gem displays, crafting-orb families, legendary loot beams or glowing rarity borders.",
    refs: ["https://www.purediablo.com/strategy/diablo-1-guide-multiplayer-rogue-guide"], },
  { id: "d1-icon-family", profile: 'diablo1', category: "art", scope: "icon-sets", title: "Coherent object and spell icon families",
    body: "For an icon family, keep pixel density, shadow depth, highlight size and edge treatment consistent. Item icons show objects; spell icons use compact pictorial symbols, not miniature inventory weapons. Check the whole sheet at intended display size. No vector glyph packs, rarity frames or per-icon studio backgrounds.", },
  { id: "d1-spell-identity", profile: 'diablo1', category: "art", scope: "global", title: "Distinct, compact spell imagery",
    body: "Depict fire as orange-yellow tongues or compact bursts, lightning as pale blue-white jagged streams, and Town Portal as an upright blue opening. Use discrete animated shapes with bright cores and short-lived edges. Keep each named spell's footprint recognizable; no universal purple smoke, particle confetti or elaborate glyph circles added to every cast.", },
  { id: "d1-vfx-read", profile: 'diablo1', category: "art", scope: "vfx", title: "Bright effects with readable footprints",
    body: "Keep moving missiles, impacts and persistent effects distinguishable in a sprite sequence. Fire Wall remains a row of visible flames and lightning a narrow directional effect. Allow bright magic against dark terrain while preserving nearby actor outlines. Exclude screen-filling bloom, lens flares, cinematic shockwaves and modern warning decals.", },
  { id: "d1-hud", profile: 'diablo1', category: "art", scope: "hud-elements", title: "Stone panel and paired resource globes",
    body: "Use a heavy carved gray-stone control panel along the bottom, a red life globe on the left and blue mana globe on the right, sculpted supports, small inset buttons and a central information area. Keep potion belt and selected-spell control integrated into the panel. No floating minimalist bars, glass panels or modern action ribbons.",
    refs: ["https://hoffmeister.li/downloads/games/diablo_1/D1_manual_en.pdf"], },
  { id: "d1-ui", profile: 'diablo1', category: "art", scope: "global", title: "Dense stone-framed panels and line automap",
    body: "Use dark stone-framed character, inventory and spell panels, compact Gothic or serif lettering and pixel-shaded inset controls. Inventory must read as a grid plus equipment slots. Show dungeon mapping as thin lines over the playfield. No parchment full-screen atlas, rounded mobile cards, sans-serif dashboard styling or persistent overhead health bars.", },
  { id: "d1-music-town", profile: 'diablo1', category: "art", scope: "music", title: "Tristram's melancholy acoustic foreground",
    body: "For Tristram, foreground a recorded acoustic-guitar timbre with repeating picked figures, resonant strings and a melancholy, unsettled harmonic bed. Leave space between phrases. Compose new music; do not reproduce the original melody. Exclude jaunty tavern dance, heroic brass fanfare and an exclusively chiptune arrangement.",
    refs: ["https://www.shacknews.com/article/60997/from-tristram-to-torchlight-an"], },
  { id: "d1-music-dungeons", profile: 'diablo1', category: "art", scope: "music", title: "Dungeon texture, percussion and unease",
    body: "For dungeons, combine dark sustained textures, dissonant fragments, heavy percussion and processed guitar or metallic sounds. Use repetition and uneasy gaps; deeper tiers may feel harsher without becoming a victory anthem. Compose continuous zone pieces rather than mandatory combat-intensity stems. Do not copy recorded music or themes.",
    refs: ["https://www.shacknews.com/article/60997/from-tristram-to-torchlight-an"], },
  { id: "d1-audio-space", profile: 'diablo1', category: "art", scope: "ambient", title: "Sparse cues that expose nearby threats",
    body: "Use sparse, identifiable cues: footfalls, creaking doors, metal hits, creature cries, fire and occasional distant moans. Leave audible gaps so a nearby threat cuts through the bed. Keep voices close and intelligible, with environmental reverberation where useful. Avoid constant battle crowds, comedy effects and a continuous cinematic sub-bass wash.", },
  { id: "d1-ue-translation", profile: 'diablo1', category: "art", scope: "global", title: "Explicit modern UE presentation translation",
    body: "Explicit modern translation, only for UE deliverables: meshes, materials and Niagara may implement this profile, but judge their output through the fixed gameplay camera at 640x480. Keep stepped shading, compact textures and bounded light; disable depth of field, motion blur and broad bloom. Technical fidelity cannot replace the required sprite-scale silhouette.", },
];
