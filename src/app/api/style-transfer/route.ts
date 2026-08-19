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
      // Additive and machine-checkable: nothing here decodes the image, so every consumer
      // can see that the attachment did not inform a single number in `analysis`.
      return apiSuccess({ analysis, imageAnalyzed: false });
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}

// ── Heuristic analysis engine ───────────────────────────────────────────────
// Keyword-based inference from the TEXT DESCRIPTION ONLY. The keyword rules live
// in @/lib/visual-gen/style-keywords so the visual prompt builder's chips share
// the same source.
//
// THE REFERENCE IMAGE IS NOT EXAMINED. Nothing in this route — or downstream in
// buildStyleTransferPrompt — decodes, samples or sends `imageDataUrl` anywhere;
// the bytes reach this handler and are dropped. This used to raise
// `surfaceConfidence` by +0.15 on the mere presence of an attachment and print
// "Reference image provided for visual matching." / "Properties estimated from
// reference image." — a confidence number and two sentences asserting a
// measurement that never happened.
//
// The repo does have a real vision seam (`makeQwenVision`, used by style-dna.ts
// and input-gate.ts). Wiring it here is a deliberate NON-goal for now: it is a
// paid remote call on what is currently a free, synchronous, keystroke-cheap
// analyze button, and there is no opt-in on the caller. Until that call is
// actually made, the honest report is that only the words were read.

/** Said whenever an image is attached, so the attachment can never read as evidence. */
const IMAGE_NOT_EXAMINED =
  'A reference image is attached but was NOT examined — no code path decodes it, so it did not ' +
  'influence any value above. Describe the look in words to change the result.';

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

  // NO confidence bump for an attached image: the confidence reported here is a
  // keyword-match confidence, and an image nothing reads cannot raise it.

  // Build description — the text is the ONLY input, and the copy says so.
  const base = description.trim()
    ? `Material properties inferred from the text description: "${description.substring(0, 100)}${description.length > 100 ? '...' : ''}".`
    : 'No text description given — using default stone material properties.';
  const desc = hasImage
    ? `${base} ${IMAGE_NOT_EXAMINED}`
    : `${base} Results are based on the text description alone.`;

  // Suggestions
  const suggestions: string[] = [];
  // Deliberately NOT "upload a reference screenshot": an upload changes nothing here,
  // so suggesting one would sell the same phantom measurement in a second place.
  if (hasImage) suggestions.push('Name the dominant colors and materials you see in the reference — the palette above is a per-keyword default, not sampled from your image');
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
