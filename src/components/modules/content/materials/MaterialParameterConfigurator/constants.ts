import { Gem, Shirt, User, Droplets, Flame, Leaf, Blocks } from 'lucide-react';
import { ACCENT_VIOLET, STATUS_BLOCKER, STATUS_IMPROVED, ACCENT_ORANGE, STATUS_SUCCESS, STATUS_WARNING, STATUS_MUTED, ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import type { SurfaceDef, FeatureDef, ParamDef, GlossaryEntry } from './types';

// ── Static Data ──

export const SURFACES: SurfaceDef[] = [
  { id: 'metal',    label: 'Metal',    icon: Gem,       color: STATUS_MUTED, description: 'PBR metallic: high metallic, low roughness, sharp reflections', defaultFeatures: [], plain: 'A shiny, reflective surface — think steel, gold, or polished armor.' },
  { id: 'cloth',    label: 'Cloth',    icon: Shirt,     color: ACCENT_VIOLET, description: 'Fabric shading with fuzz, thread detail, anisotropy', defaultFeatures: ['subsurface'], plain: 'Fabric that looks soft and threaded — capes, banners, upholstery.' },
  { id: 'skin',     label: 'Skin',     icon: User,      color: STATUS_BLOCKER, description: 'Subsurface skin: SSS profile, pore detail, translucency', defaultFeatures: ['subsurface'], plain: 'Skin that lets a little light pass through, the way a real face does.' },
  { id: 'glass',    label: 'Glass',    icon: Droplets,  color: STATUS_IMPROVED, description: 'Translucent glass with refraction, IOR, tint color', defaultFeatures: ['refraction'], plain: 'Clear or tinted glass that bends what you see behind it.' },
  { id: 'water',    label: 'Water',    icon: Droplets,  color: ACCENT_CYAN_LIGHT, description: 'Animated water surface with depth fade, caustics', defaultFeatures: ['refraction', 'worldPositionOffset'], plain: 'A living water surface — ripples, refraction, depth fade in the shallows.' },
  { id: 'emissive', label: 'Emissive', icon: Flame,     color: ACCENT_ORANGE, description: 'Self-illuminating surfaces: neon, lava, magic effects', defaultFeatures: ['emissive'], plain: 'A surface that gives off its own light — runes, lava, magic, neon signs.' },
  { id: 'foliage',  label: 'Foliage',  icon: Leaf,      color: STATUS_SUCCESS, description: 'Two-sided foliage with subsurface, wind animation', defaultFeatures: ['subsurface', 'worldPositionOffset'], plain: 'Leaves and grass that glow gently when the sun is behind them and sway in wind.' },
  { id: 'stone',    label: 'Stone',    icon: Blocks,    color: '#78716c', description: 'Rock/brick with parallax occlusion depth detail', defaultFeatures: ['parallax'], plain: 'Rocky, chiseled surface with real-feeling cracks and depth.' },
];

export const FEATURES: FeatureDef[] = [
  { id: 'subsurface',          label: 'Subsurface Scattering', shortLabel: 'SSS',       description: 'Light passes through material (skin, wax, leaves)', color: STATUS_BLOCKER,
    plain: { label: 'Light passes through', explanation: 'Lets a little light shine through the surface — what makes ears glow red against a sunset.' } },
  { id: 'parallax',            label: 'Parallax Occlusion',    shortLabel: 'Parallax',   description: 'Depth illusion from heightmap without extra geometry', color: '#78716c',
    plain: { label: 'Fake depth in cracks', explanation: "Makes cracks and bricks look properly deep without adding real geometry. Expensive — use it on hero stones only." } },
  { id: 'emissive',            label: 'Emissive',              shortLabel: 'Emissive',   description: 'Self-illumination channel for glowing regions', color: STATUS_WARNING,
    plain: { label: 'Glows on its own', explanation: 'The surface emits light by itself — runes, screens, lava cracks. Works even in pitch dark.' } },
  { id: 'refraction',          label: 'Refraction',            shortLabel: 'Refract',    description: 'Light bending through translucent surfaces', color: STATUS_IMPROVED,
    plain: { label: 'Bends what is behind', explanation: "Distorts what you see through the surface, like glass or water. Costs more than plain transparency." } },
  { id: 'tessellation',        label: 'Tessellation / Nanite', shortLabel: 'Tess',       description: 'Subdivide mesh for displacement detail (UE5.4+ Nanite)', color: ACCENT_VIOLET,
    plain: { label: 'Sculpts real bumps', explanation: 'Adds real geometry along the surface so bumps cast shadows. Heaviest option — Nanite handles most cases now.' } },
  { id: 'worldPositionOffset', label: 'World Position Offset', shortLabel: 'WPO',        description: 'Vertex animation: wind, waves, breathing', color: STATUS_SUCCESS,
    plain: { label: 'Wobbles / sways', explanation: 'Wiggles the surface in real time — wind on grass, breathing chests, lapping waves.' } },
];

export const BASE_PARAMS: ParamDef[] = [
  { name: 'Roughness',  label: 'Roughness',  min: 0, max: 1, defaultValue: 0.5, step: 0.05,
    plain: { label: 'Polish', explanation: 'How polished or weathered the surface looks. Low = a mirror; high = sandpaper.', cue: 'level', lowLabel: 'Mirror', highLabel: 'Sandpaper' } },
  { name: 'Metallic',   label: 'Metallic',   min: 0, max: 1, defaultValue: 0,   step: 0.1,
    plain: { label: 'Looks like metal', explanation: 'How much the surface behaves like metal (sharp, tinted reflections) vs plastic/cloth/skin.', cue: 'level', lowLabel: 'Plastic', highLabel: 'Steel' } },
  { name: 'Opacity',    label: 'Opacity',    min: 0, max: 1, defaultValue: 1,   step: 0.05, surfaces: ['glass', 'water'],
    plain: { label: 'How see-through', explanation: 'How transparent the surface is. Low = ghostly; high = solid.', cue: 'level', lowLabel: 'See through', highLabel: 'Solid' } },
  { name: 'IOR',        label: 'IOR',        min: 1, max: 2.5, defaultValue: 1.5, step: 0.1, surfaces: ['glass', 'water'],
    plain: { label: 'How much light bends', explanation: 'How sharply light bends as it enters the surface. Air ≈ 1, water ≈ 1.33, glass ≈ 1.5, diamond ≈ 2.4.', cue: 'distance', lowLabel: 'No bend', highLabel: 'Strong bend' } },
  { name: 'EmissiveIntensity', label: 'Emissive Intensity', min: 0, max: 20, defaultValue: 5, step: 0.5, surfaces: ['emissive'],
    plain: { label: 'Glow strength', explanation: 'How brightly the surface glows. High values bloom and tint nearby objects.', cue: 'glow', lowLabel: 'Dim', highLabel: 'Blinding' } },
  { name: 'SubsurfaceRadius',  label: 'SSS Radius',        min: 0.1, max: 5, defaultValue: 1.2, step: 0.1, surfaces: ['skin', 'cloth', 'foliage'],
    plain: { label: 'Light bleed', explanation: 'How far light spreads under the surface — skin looks waxy when this is high.', cue: 'glow', lowLabel: 'Sharp', highLabel: 'Waxy' } },
  { name: 'ParallaxDepth',     label: 'Parallax Depth',    min: 0.01, max: 0.2, defaultValue: 0.05, step: 0.01, surfaces: ['stone'],
    plain: { label: 'Crack depth', explanation: 'How deep the fake cracks read when you look at the surface from an angle.', cue: 'level', lowLabel: 'Flat', highLabel: 'Carved' } },
];

// ── Glossary (for the popover) ─────────────────────────────────────────────

export const GLOSSARY: GlossaryEntry[] = [
  { term: 'PBR',        plain: 'Physically-Based Rendering — the modern way of building materials so they look right in any lighting.' },
  { term: 'IOR',        plain: 'Index of Refraction — how much a transparent surface bends what is behind it.' },
  { term: 'SSS',        plain: 'Subsurface Scattering — light passing through the surface and re-emerging slightly elsewhere (skin, wax, leaves).' },
  { term: 'POM',        plain: 'Parallax Occlusion Mapping — fakes real depth in surface details like brickwork.' },
  { term: 'WPO',        plain: 'World Position Offset — wiggles the surface in real time. Wind on grass, lapping water.' },
  { term: 'Tessellation', plain: 'Adds real geometric bumps to a surface. Heaviest option — Nanite usually handles this now.' },
  { term: 'Metallic',   plain: 'How "metal" a surface looks. Metals reflect their own color tint; plastics reflect white.' },
  { term: 'Roughness',  plain: 'How polished vs sandpapery a surface looks. Controls reflection sharpness.' },
  { term: 'ORM',        plain: 'A texture map that packs Occlusion + Roughness + Metallic into one image (R, G, B channels) to save samplers.' },
];
