import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseVisionImage, gateInputImage, summarizeInputGate } from '@/lib/visual-gen/input-gate';
import {
  decomposeScene,
  toCompositionAssets,
  type DecomposedProp,
} from '@/lib/visual-gen/generators/scene-decompose';
import {
  generateComposition,
  DEFAULT_COMPOSITION_CONFIG,
  type CompositionAsset,
} from '@/lib/visual-gen/generators/composition';
import { toUeActorTags, DEFAULT_AFFORDANCE } from '@/lib/visual-gen/generators/placement-tags';
import { physicalForSize, toPhysicsActorTags } from '@/lib/visual-gen/generators/physical-tags';
import { cropPropRegion, cropToVisionImage } from '@/lib/visual-gen/scene-crop';

/**
 * POST /api/visual-gen/scene-decompose
 *
 * One scene image → a placed, spawnable set-dressing manifest.
 *
 * This route is the WIRING the composition work has been missing. Until it landed,
 * `generateComposition` and `placement-tags` had no importer anywhere in `src/` outside
 * their own two files — a tested pure solver with no path to an engine, exactly the
 * blocker `docs/research/agentic-world-composition-spec.md` names ("any world-scale
 * ambition is blocked behind that wiring, not behind model access").
 *
 * The chain, each link already existing except the first:
 *   1. VLM decomposes the scene into props with normalized boxes + size estimates;
 *   2. each prop's region is CROPPED (sharp) and optionally run through the existing
 *      Tier-0 `gateInputImage` — the gate's "one subject, plain background" premise only
 *      holds on a crop, never on the scene;
 *   3. props become `CompositionAsset[]` with size-class affordances and the VLM's counts;
 *   4. `generateComposition` places them with its support-footprint rules;
 *   5. every placed prop carries the UE actor tags a spawn script reads — placement
 *      (`place_` / `stack_` / `copy_` / `max_stack_`) AND physical (`phys_` / `sim_` /
 *      `mass_kg_`), the latter being what a headless physics settle needs.
 *
 * The gate ADVISES and never deletes: a failing crop is reported so the caller can fix or
 * skip that prop's generation, but silently dropping props would make the manifest lie
 * about the scene it decomposed.
 *
 * Body: { imageDataUrl, hint?, gateCrops?: boolean, seed?, areaExtent?, jitterDegrees? }
 * Data: { props, assets, composition: { props: [...+ueActorTags], unplaced }, gate }
 */
interface Body {
  imageDataUrl?: string;
  hint?: string;
  gateCrops?: boolean;
  seed?: number;
  areaExtent?: number;
  jitterDegrees?: number;
}

interface CropGate {
  id: string;
  ran: boolean;
  verdict?: 'pass' | 'warn' | 'fail';
  score?: number;
  reasons?: string[];
  note: string;
}

/** Gate every prop crop. One vision call per prop, so it is opt-in at the route boundary. */
async function gateCropsOf(
  scene: Buffer,
  props: readonly DecomposedProp[],
): Promise<CropGate[]> {
  const out: CropGate[] = [];
  for (const p of props) {
    try {
      const png = await cropPropRegion(scene, p.box);
      const outcome = summarizeInputGate(await gateInputImage(cropToVisionImage(png), { subject: p.name }));
      out.push(
        outcome.ran
          ? { id: p.id, ran: true, verdict: outcome.verdict, score: outcome.score, reasons: outcome.reasons, note: outcome.note }
          : { id: p.id, ran: false, note: outcome.note },
      );
    } catch (e) {
      out.push({ id: p.id, ran: false, note: `crop gate skipped: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!body.imageDataUrl) return apiError('Missing required field: imageDataUrl', 400);
    const image = parseVisionImage(body.imageDataUrl);
    if (!image) return apiError('imageDataUrl must be a base64 image data URL', 400);

    const decomposed = await decomposeScene(image, { hint: body.hint });
    // Only a call that never happened is an outage. A scene the model LOOKED at and found
    // no movable props in (terrain, architecture and foliage only — a real case, observed
    // live on the ravaged-courtyard arena art) is an honest empty answer, and returning it
    // as a 502 would teach callers to retry something that will never differ.
    if (!decomposed.ran) {
      return apiError(`scene decomposition could not run: ${decomposed.error}`, 502);
    }
    if (!decomposed.ok) {
      return apiSuccess({
        props: [],
        skipped: decomposed.skipped,
        assets: [],
        composition: { props: [], unplaced: [] },
        gate: [],
        note: decomposed.error,
      });
    }

    const scene = Buffer.from(image.base64, 'base64');
    const gate = body.gateCrops === false ? [] : await gateCropsOf(scene, decomposed.props);

    const assets: CompositionAsset[] = toCompositionAssets(decomposed.props);
    const composition = generateComposition({
      ...DEFAULT_COMPOSITION_CONFIG,
      assets,
      seed: body.seed ?? DEFAULT_COMPOSITION_CONFIG.seed,
      areaExtent: body.areaExtent ?? DEFAULT_COMPOSITION_CONFIG.areaExtent,
      jitterDegrees: body.jitterDegrees ?? DEFAULT_COMPOSITION_CONFIG.jitterDegrees,
    });

    const sizeOf = new Map(assets.map((a) => [a.id, a.size] as const));
    const affordanceOf = new Map(assets.map((a) => [a.id, a.affordance ?? DEFAULT_AFFORDANCE] as const));
    // The VLM's material is what makes the density table live: without it every prop is
    // `phys_default` and the mass is a single fallback number wearing a per-prop label.
    const materialOf = new Map(decomposed.props.map((p) => [p.id, p.material] as const));
    const placed = composition.props.map((p) => {
      const size = sizeOf.get(p.assetId) ?? ([1, 1, 1] as const);
      return {
        ...p,
        ueActorTags: [
          ...toUeActorTags(affordanceOf.get(p.assetId) ?? DEFAULT_AFFORDANCE),
          ...toPhysicsActorTags(physicalForSize(size, materialOf.get(p.assetId))),
        ],
      };
    });

    return apiSuccess({
      props: decomposed.props,
      skipped: decomposed.skipped,
      assets,
      composition: { props: placed, unplaced: composition.unplaced },
      gate,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'scene decomposition failed', 500);
  }
}
