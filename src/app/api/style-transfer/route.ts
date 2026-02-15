import { type NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import type { AnalyzedProperties } from '@/components/modules/content/materials/MaterialStyleTransfer';
import type { SurfaceType, RenderFeature } from '@/components/modules/content/materials/MaterialParameterConfigurator';

// ── POST — analyze reference ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === 'analyze') {
      const description = (body.description ?? '') as string;
      const hasImage = !!body.imageDataUrl;
      const analysis = analyzeFromDescription(description, hasImage);
      return apiSuccess({ analysis });
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}

// ── Heuristic analysis engine ───────────────────────────────────────────────
// Keyword-based inference from the text description. When the CLI generates
// the actual material, Claude will refine these with actual vision analysis
// if an image was provided.

interface KeywordRule {
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

const RULES: KeywordRule[] = [
  // Surface type signals
  { keywords: ['fire', 'flame', 'ember', 'lava', 'magma', 'burn'], surfaceType: 'emissive', emissive: 12, roughness: 0.8, metallic: 0, colors: ['#ff4500', '#ff8c00', '#ffd700', '#8b0000', '#1a0a00'] },
  { keywords: ['metal', 'steel', 'iron', 'armor', 'chrome', 'silver'], surfaceType: 'metal', metallic: 0.9, roughness: 0.2, colors: ['#c0c0c0', '#808080', '#505050', '#2a2a2a', '#e0e0e0'] },
  { keywords: ['stone', 'rock', 'brick', 'concrete', 'marble'], surfaceType: 'stone', roughness: 0.7, metallic: 0, features: ['parallax'], parallax: 0.05, colors: ['#8b7d6b', '#a0926d', '#6b6b6b', '#504030', '#c0b090'] },
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

function analyzeFromDescription(description: string, hasImage: boolean): AnalyzedProperties {
  const lower = description.toLowerCase();

  // Accumulate matches
  let surfaceType: SurfaceType = 'stone';
  let surfaceConfidence = 0.4;
  const features = new Set<RenderFeature>();
  let roughness = 0.5;
  let metallic = 0.2;
  let emissive = 0;
  let subsurface = 0;
  let parallax = 0;
  let opacity = 1.0;
  let colors: string[] = ['#808080', '#606060', '#a0a0a0', '#404040', '#c0c0c0'];
  let matchCount = 0;

  for (const rule of RULES) {
    const matched = rule.keywords.some((kw) => lower.includes(kw));
    if (!matched) continue;
    matchCount++;

    if (rule.surfaceType) {
      surfaceType = rule.surfaceType;
      surfaceConfidence = Math.min(0.5 + matchCount * 0.1, 0.95);
    }
    if (rule.features) rule.features.forEach((f) => features.add(f));
    if (rule.roughness !== undefined) roughness = rule.roughness;
    if (rule.metallic !== undefined) metallic = rule.metallic;
    if (rule.emissive !== undefined) emissive = rule.emissive;
    if (rule.subsurface !== undefined) subsurface = rule.subsurface;
    if (rule.parallax !== undefined) parallax = rule.parallax;
    if (rule.opacity !== undefined) opacity = rule.opacity;
    if (rule.colors) colors = rule.colors;
  }

  // Boost confidence if image was provided
  if (hasImage) {
    surfaceConfidence = Math.min(surfaceConfidence + 0.15, 0.95);
  }

  // Build description
  const desc = description.trim()
    ? `Material properties inferred from: "${description.substring(0, 100)}${description.length > 100 ? '...' : ''}". ${hasImage ? 'Reference image provided for visual matching.' : 'No reference image — results based on text description.'}`
    : hasImage
      ? 'Properties estimated from reference image. Add a text description for more accurate results.'
      : 'No reference provided. Using default stone material properties.';

  // Suggestions
  const suggestions: string[] = [];
  if (!hasImage) suggestions.push('Upload a reference screenshot for more accurate color palette extraction');
  if (matchCount === 0) suggestions.push('Add more specific keywords (e.g., "metallic", "glowing", "rough stone") to improve detection');
  if (emissive > 0 && !features.has('emissive')) features.add('emissive');
  if (subsurface > 0.3 && !features.has('subsurface')) features.add('subsurface');
  if (features.size === 0) suggestions.push('Consider enabling rendering features like SSS, Parallax, or Emissive for richer materials');

  return {
    colorPalette: colors,
    surfaceType,
    surfaceConfidence,
    roughness: Math.round(roughness * 100) / 100,
    metallic: Math.round(metallic * 100) / 100,
    emissiveIntensity: Math.round(emissive * 10) / 10,
    subsurfacePresence: Math.round(subsurface * 100) / 100,
    parallaxDepth: Math.round(parallax * 1000) / 1000,
    opacity: Math.round(opacity * 100) / 100,
    features: Array.from(features),
    description: desc,
    suggestions,
  };
}
