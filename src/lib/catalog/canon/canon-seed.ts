import type { ProjectRule } from './types';

export const CANON_SEED: ProjectRule[] = [
  // ── GAME ──
  { id: 'game-genre', category: 'game', scope: 'global', title: 'Genre', body: 'PoF is a single-player Action RPG (ARPG) built in UE5.7.' },
  { id: 'game-pillars', category: 'game', scope: 'global', title: 'Pillars', body: 'Disciplined, rhythmic melee (weave light/heavy, never button-mash); power is earned, not gifted; grounded dark fantasy over high fantasy.' },
  { id: 'game-tone', category: 'game', scope: 'global', title: 'Tone', body: "Grim, weathered, earned — a soldier's world, not a hero's fantasy. Restraint over spectacle; items and enemies feel used and real." },
  { id: 'game-setting', category: 'game', scope: 'global', title: 'Setting', body: 'Post-Sundering dark fantasy; militant factions such as the Ashen Order. Magic is dangerous and costly.' },
  // ── ART ──
  { id: 'art-identity', category: 'art', scope: 'global', title: 'Visual identity', body: 'Painterly-realistic, weathered, grounded. Muted earthen palette; saturation reserved for rarity and elemental accents.' },
  { id: 'art-icons', category: 'art', scope: 'global', title: 'Icon style', body: '256px, 3/4 view, strong readable silhouette, rarity-framed; consistent light from the upper-left.' },
  { id: 'art-3d', category: 'art', scope: 'global', title: '3D style', body: 'PBR and Nanite-friendly; respect per-class LOD0 tri budgets; grounded real-world scale.' },
  { id: 'art-material', category: 'art', scope: 'global', title: 'Material style', body: 'Author as master-material instances; expose wear/tint params; Albedo/Normal/ORM are required maps.' },
  { id: 'art-vfx', category: 'art', scope: 'global', title: 'VFX style', body: 'Niagara; restrained and readable; keyed to anim notifies; stay within the per-class GPU budget.' },
  // ── PROJECT ──
  { id: 'proj-naming', category: 'project', scope: 'global', title: 'Asset naming', body: 'UE prefixes: T_ texture, SM_ static mesh, MI_ material instance, A_ anim, NS_ Niagara, SC_ SoundCue, GE_/GA_ GAS, DT_ DataTable. PascalCase, space-free slugs.' },
  { id: 'proj-sot', category: 'project', scope: 'global', title: 'Source of truth', body: 'Attributes come from UARPGAttributeSet; row schemas from the F*Row structs; ability math from ARPGDamageExecution. The app validates against UE and never re-authors schema (schema-down, content-up).' },
  { id: 'proj-balance', category: 'project', scope: 'global', title: 'Balance envelopes', body: 'Tier power target ≈ 100 (±10%). Price/power ratio 0.8–1.2×. Document any intentional outlier.' },
  { id: 'proj-links', category: 'project', scope: 'global', title: 'Cross-catalog links', body: 'bestiary→abilities + loot; loot→items; vendor→items + economy; currency defines caps + sinks. Reference upstream entities via CatalogLink (they may still be deferred).' },
  { id: 'proj-quality', category: 'project', scope: 'global', title: 'Quality bar', body: 'config-complete (the parallel-dev done bar) = every step passes at L0–L2 or is deferred at L3/L4. Brief ≥ 300 chars; all schema fields populated; an icon selected.' },
  { id: 'proj-economy', category: 'project', scope: 'currency', title: 'Economy laws', body: 'Every currency must define at least one sink; caps prevent runaway inflation; the per-hour faucet and sink should stay balanced within ±15%. Premium and soft currencies never inter-convert freely.' },
  { id: 'art-icon-family', category: 'art', scope: 'icon-sets', title: 'Icon family coherence', body: 'Icons within a set share silhouette weight, line treatment, palette, rarity-frame, and light direction — the set reads as one family across every member.' },
  { id: 'art-icon-a11y', category: 'art', scope: 'global', title: 'Icon accessibility', body: 'Icons must hold AA contrast on the dark HUD, use colorblind-safe hue separation, and remain legible at 32px.' },
  { id: 'game-creature-design', category: 'game', scope: 'bestiary', title: 'Creature design', body: 'Enemies read by archetype (tank / skirmisher / caster / boss); attacks are telegraphed and counterable; difficulty comes from legible, learnable patterns — never stat inflation.' },
  { id: 'game-lore-canon', category: 'game', scope: 'global', title: 'Lore canon', body: 'All lore aligns to the post-Sundering setting and established factions with no contradictions; codex entries keep spoilers behind unlocks.' },
  { id: 'proj-hud-binding', category: 'project', scope: 'global', title: 'HUD binding contract', body: 'Any entity that surfaces in the HUD (currency, status, objective tracker) must declare its widget, a display-format string, and a HUD anchor; bind to a hud-elements presentation entry — never hard-code placement.' },
];
