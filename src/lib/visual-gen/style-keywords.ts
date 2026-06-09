/* eslint-disable no-restricted-syntax -- the hex literals below are material
   reference color-palette DATA fed to the heuristic analyzer, not UI theme
   colors; they are not styling and have no chart-colors equivalent. */
import type { SurfaceType, RenderFeature } from '@/components/modules/content/materials/MaterialParameterConfigurator';

/**
 * Single source of truth for the plain-English → material-property keyword
 * mapping. Consumed by:
 *  - `src/app/api/style-transfer/route.ts` — heuristic material analyzer.
 *  - `src/lib/visual-gen/prompt-chips.ts` — chip vocabulary for the visual
 *    prompt builder (every chip keyword resolves to a rule here, so chip-built
 *    prompts stay analyzable by the same engine — no jargon drift).
 */
export interface KeywordRule {
  keywords: string[];
  surfaceType?: SurfaceType;
  features?: RenderFeature[];
  roughness?: number;
  metallic?: number;
  emissive?: number;
  subsurface?: number;
  parallax?: number;
  opacity?: number;
  colors?: string[];
}

export const STYLE_RULES: KeywordRule[] = [
  // Surface type signals
  { keywords: ['fire', 'flame', 'ember', 'lava', 'magma', 'burn'], surfaceType: 'emissive', emissive: 12, roughness: 0.8, metallic: 0, colors: ['#ff4500', '#ff8c00', '#ffd700', '#8b0000', '#1a0a00'] },
  { keywords: ['metal', 'steel', 'iron', 'armor', 'chrome', 'silver'], surfaceType: 'metal', metallic: 0.9, roughness: 0.2, colors: ['#c0c0c0', '#808080', '#505050', '#2a2a2a', '#e0e0e0'] },
  { keywords: ['stone', 'rock', 'brick', 'concrete', 'marble'], surfaceType: 'stone', roughness: 0.7, metallic: 0, features: ['parallax'], parallax: 0.05, colors: ['#8b7d6b', '#a0926d', '#6b6b6b', '#504030', '#c0b090'] },
  { keywords: ['wood', 'wooden', 'timber', 'oak', 'plank', 'bark'], roughness: 0.7, metallic: 0, features: ['parallax'], parallax: 0.04, colors: ['#8b5a2b', '#a0522d', '#6b4423', '#c19a6b', '#3b2412'] },
  { keywords: ['water', 'ocean', 'lake', 'pool', 'liquid', 'wave'], surfaceType: 'water', opacity: 0.7, roughness: 0.05, features: ['refraction', 'worldPositionOffset'], colors: ['#006994', '#40a0c0', '#80d0e0', '#003050', '#00b4d8'] },
  { keywords: ['glass', 'crystal', 'transparent', 'ice', 'gem'], surfaceType: 'glass', opacity: 0.4, roughness: 0.05, metallic: 0, features: ['refraction'], colors: ['#b0d0e0', '#e0f0ff', '#80a0b0', '#405060', '#ffffff'] },
  { keywords: ['skin', 'flesh', 'face', 'character', 'body'], surfaceType: 'skin', subsurface: 0.8, roughness: 0.6, features: ['subsurface'], colors: ['#d4a574', '#e8c8a0', '#a07050', '#f0d0b0', '#804030'] },
  { keywords: ['cloth', 'fabric', 'silk', 'leather', 'wool', 'linen'], surfaceType: 'cloth', roughness: 0.8, subsurface: 0.3, features: ['subsurface'], colors: ['#8b4513', '#a0522d', '#d2b48c', '#654321', '#f5deb3'] },
  { keywords: ['foliage', 'leaf', 'grass', 'plant', 'tree', 'moss'], surfaceType: 'foliage', roughness: 0.7, subsurface: 0.5, features: ['subsurface', 'worldPositionOffset'], colors: ['#228b22', '#2e8b57', '#006400', '#90ee90', '#3a5f0b'] },
  { keywords: ['glow', 'neon', 'luminous', 'electric', 'magic'], surfaceType: 'emissive', emissive: 8, colors: ['#00ffff', '#ff00ff', '#00ff00', '#0000ff', '#ffffff'] },

  // Feature signals
  { keywords: ['subsurface', 'sss', 'translucent', 'scatter'], features: ['subsurface'], subsurface: 0.6 },
  { keywords: ['parallax', 'depth', 'heightmap', 'displacement'], features: ['parallax'], parallax: 0.08 },
  { keywords: ['emissive', 'glow', 'bright', 'luminescent'], features: ['emissive'], emissive: 5 },
  { keywords: ['refraction', 'distort', 'bend'], features: ['refraction'] },
  { keywords: ['animate', 'scroll', 'pulse', 'flicker', 'wave'], features: ['worldPositionOffset'] },

  // Roughness modifiers
  { keywords: ['smooth', 'polished', 'shiny', 'glossy', 'mirror'], roughness: 0.1 },
  { keywords: ['rough', 'weathered', 'worn', 'matte', 'rugged', 'scratched'], roughness: 0.75 },

  // Metallic modifiers
  { keywords: ['metallic', 'sheen', 'specular'], metallic: 0.8 },
  { keywords: ['non-metallic', 'dielectric', 'matte'], metallic: 0 },

  // Style-specific
  { keywords: ['stylized', 'cartoon', 'toon', 'cel'], roughness: 0.6, emissive: 2 },
  { keywords: ['realistic', 'photorealistic', 'pbr'], roughness: 0.5, metallic: 0.3 },
  { keywords: ['dark souls', 'elden ring'], surfaceType: 'metal', roughness: 0.55, metallic: 0.7, colors: ['#3a3a3a', '#5a5a5a', '#808080', '#2a1a0a', '#4a3a2a'] },
  { keywords: ['hades', 'supergiant'], surfaceType: 'emissive', emissive: 10, roughness: 0.6, colors: ['#ff4500', '#ff8c00', '#ffd700', '#800020', '#1a0500'] },
  { keywords: ['hollow knight'], surfaceType: 'emissive', emissive: 6, subsurface: 0.4, colors: ['#e0e0e0', '#b0c0d0', '#6080a0', '#203040', '#ffffff'] },
  { keywords: ['zelda'], surfaceType: 'water', roughness: 0.3, opacity: 0.8, colors: ['#4169e1', '#87ceeb', '#00ced1', '#1e90ff', '#f0f8ff'] },
];
