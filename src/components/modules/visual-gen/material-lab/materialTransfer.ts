import type { MaterialTextureSources } from '@/lib/blender-mcp/scripts/create-material';
import type { PBRParams, TextureChannel } from './useMaterialStore';

/** One thing the lab holds that did NOT reach Blender, and the concrete reason. */
export interface DroppedParam {
  label: string;
  reason: string;
}

export interface MaterialTransferPlan {
  /** Human labels for everything the script actually carries. */
  sent: string[];
  /** Everything the lab holds that the script cannot carry, each with its reason. */
  notSent: DroppedParam[];
  /** Texture sources resolved to something Blender can open. */
  textures: MaterialTextureSources;
}

export type TextureMap = Record<TextureChannel, string | null>;

const CHANNEL_LABEL: Record<TextureChannel, string> = {
  albedo: 'Albedo map',
  normal: 'Normal map',
  metallic: 'Metallic map',
  roughness: 'Roughness map',
  ao: 'AO map',
};

/**
 * A blob: URL is an object-URL handle into THIS browser tab's memory. Blender is
 * a separate process reading files and URLs, so an uploaded map genuinely cannot
 * travel — the lab says so rather than reporting a success that dropped it.
 */
const BLOB_REASON =
  'uploaded into this browser tab only (blob: URL) — Blender cannot open it. Generate the map in the Advanced tab, or point the slot at a file on disk.';
const DATA_REASON = 'an inline data: URL, not a file or address Blender can open.';

/** Routes this app serves; anything else starting with "/" is treated as a filesystem path. */
const APP_ROUTE_PREFIXES = ['/api/', '/generated/'];

/**
 * Resolve one texture slot to something `bpy.data.images.load` (or the generated
 * `_load_image` downloader) can consume, or explain why it cannot be resolved.
 */
export function resolveTextureSource(
  url: string | null,
  origin: string,
): { source: string } | { reason: string } | null {
  if (!url) return null; // nothing loaded — nothing was dropped
  if (url.startsWith('blob:')) return { reason: BLOB_REASON };
  if (url.startsWith('data:')) return { reason: DATA_REASON };
  if (url.startsWith('http://') || url.startsWith('https://')) return { source: url };
  if (APP_ROUTE_PREFIXES.some((p) => url.startsWith(p))) return { source: `${origin}${url}` };
  return { source: url }; // an absolute filesystem path
}

/**
 * Decide what a "Send to Blender" actually carries, before it is sent.
 *
 * The lab used to pass three of its parameters and report "Material created in
 * Blender" regardless. This returns both halves — what travels and what does
 * not, each with a reason — so the message can never claim more than happened.
 *
 * `normalStrength` / `aoStrength` are reported as dropped when their map is
 * missing: Blender has nowhere to put them (a Normal Map node with no image is
 * flat; the Principled BSDF has no AO input), so sending the number would be
 * theatre. Both still travel to UE5, which parameterises them directly.
 */
export function planMaterialTransfer(
  params: PBRParams,
  textures: TextureMap,
  origin: string,
): MaterialTransferPlan {
  const sent: string[] = ['Base colour', 'Metallic', 'Roughness'];
  const notSent: DroppedParam[] = [];
  const resolved: MaterialTextureSources = {};

  const channels: TextureChannel[] = ['albedo', 'normal', 'metallic', 'roughness', 'ao'];
  for (const channel of channels) {
    const result = resolveTextureSource(textures[channel], origin);
    if (!result) continue;
    if ('reason' in result) {
      notSent.push({ label: CHANNEL_LABEL[channel], reason: result.reason });
      continue;
    }
    resolved[channel] = result.source;
    sent.push(CHANNEL_LABEL[channel]);
  }

  if (resolved.normal) {
    sent.push('Normal Strength');
  } else if (params.normalStrength !== 1) {
    notSent.push({
      label: 'Normal Strength',
      reason: 'Blender applies it through a Normal Map node, which needs a normal map. It is exported to UE5 as a scalar parameter.',
    });
  }

  if (resolved.ao) {
    sent.push('AO Strength');
  } else if (params.aoStrength !== 1) {
    notSent.push({
      label: 'AO Strength',
      reason: 'the Principled BSDF has no AO input — it needs an AO map to multiply over base colour. It is exported to UE5 as a scalar parameter.',
    });
  }

  return { sent, notSent, textures: resolved };
}
