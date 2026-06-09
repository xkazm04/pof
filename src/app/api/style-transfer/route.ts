import { type NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import type { AnalyzedProperties } from '@/components/modules/content/materials/MaterialStyleTransfer';
import type { SurfaceType, RenderFeature } from '@/components/modules/content/materials/MaterialParameterConfigurator';
import { STYLE_RULES } from '@/lib/visual-gen/style-keywords';

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
// if an image was provided. The keyword rules live in @/lib/visual-gen/
// style-keywords so the visual prompt builder's chips share the same source.

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

  for (const rule of STYLE_RULES) {
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
