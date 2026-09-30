/**
 * The Material Lab's ONE boundary theory.
 *
 * A lab material crosses three edges — the three.js preview, Blender (via the
 * MCP bridge) and a UE MaterialInstance script. Each edge used to hold its own
 * theory of what the lab's numbers mean: the preview decoded the hex base colour
 * sRGB -> linear (three's colour management), while Blender and UE wrote the raw
 * sRGB code value into linear slots, so the default grey #808080 previewed at
 * 0.2159 and landed at 0.5020. Every projection now reads this module:
 *
 * - `MATERIAL_CHANNELS` — the per-role table (label, colour space, Blender
 *   colourspace name, UE texture parameter). A new channel is one row here.
 * - `hexToLinearRgb` — the single sRGB decode (IEC 61966-2-1 piecewise curve),
 *   the same one three.js applies to the preview's `color`.
 * - `resolveChannelSource` — the single texture resolver, per target.
 *
 * PURE: no imports, no clock, no I/O.
 */

export type MaterialChannel = 'albedo' | 'normal' | 'metallic' | 'roughness' | 'ao';

/** `srgb` for colour data a human authored; `linear` for data maps sampled as numbers. */
export type ColourSpace = 'srgb' | 'linear';

export interface MaterialChannelSpec {
  channel: MaterialChannel;
  /** Human name; Blender reports it as `<label> map`, UE as `<ueParameter> texture`. */
  label: string;
  colourSpace: ColourSpace;
  /** `colorspace_settings.name` for the Blender image node. */
  blenderColorspace: 'sRGB' | 'Non-Color';
  /** The master material's texture parameter name. */
  ueParameter: string;
}

export const MATERIAL_CHANNELS: readonly MaterialChannelSpec[] = [
  { channel: 'albedo', label: 'Albedo', colourSpace: 'srgb', blenderColorspace: 'sRGB', ueParameter: 'Albedo' },
  { channel: 'normal', label: 'Normal', colourSpace: 'linear', blenderColorspace: 'Non-Color', ueParameter: 'Normal' },
  { channel: 'metallic', label: 'Metallic', colourSpace: 'linear', blenderColorspace: 'Non-Color', ueParameter: 'Metallic' },
  { channel: 'roughness', label: 'Roughness', colourSpace: 'linear', blenderColorspace: 'Non-Color', ueParameter: 'Roughness' },
  { channel: 'ao', label: 'AO', colourSpace: 'linear', blenderColorspace: 'Non-Color', ueParameter: 'AO' },
];

const BY_CHANNEL = new Map(MATERIAL_CHANNELS.map((spec) => [spec.channel, spec]));

export function channelSpec(channel: MaterialChannel): MaterialChannelSpec {
  const spec = BY_CHANNEL.get(channel);
  if (!spec) throw new Error(`unknown material channel "${channel}"`);
  return spec;
}

export function colourSpaceOf(channel: MaterialChannel): ColourSpace {
  return channelSpec(channel).colourSpace;
}

/** IEC 61966-2-1 sRGB electro-optical transfer: an encoded 0-1 value -> linear. */
export function srgbToLinear(encoded: number): number {
  return encoded <= 0.04045 ? encoded / 12.92 : Math.pow((encoded + 0.055) / 1.055, 2.4);
}

/**
 * Hex "#rrggbb" -> scene-linear 0-1 triple, rounded to 6 decimals so emitted
 * scripts stay byte-stable. An unparseable byte reads as 0.
 */
export function hexToLinearRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').padEnd(6, '0').slice(0, 6);
  const channel = (offset: number) => {
    const value = parseInt(h.substring(offset, offset + 2), 16);
    if (Number.isNaN(value)) return 0;
    return Math.round(srgbToLinear(value / 255) * 1e6) / 1e6;
  };
  return [channel(0), channel(2), channel(4)];
}

export type ChannelTarget = 'blender' | 'ue5';

/**
 * A blob: URL is an object-URL handle into THIS browser tab's memory. Neither
 * Blender nor UE is that tab, so an uploaded map genuinely cannot travel.
 */
const BLOB_REASON: Record<ChannelTarget, string> = {
  blender:
    'uploaded into this browser tab only (blob: URL) — Blender cannot open it. Generate the map in the Advanced tab, or point the slot at a file on disk.',
  ue5: 'held only in the browser (blob: URL). Save the map, import it into UE, then set this texture parameter on the instance.',
};
const DATA_REASON = 'an inline data: URL, not a file or address Blender can open.';
const UE_ASSET_TO_BLENDER_REASON =
  'a UE asset path (/Game/...) lives inside the UE project, not on disk — Blender cannot open it. Export the texture to a file and point the slot at it.';

/** Routes this app serves; anything else starting with "/" is a filesystem path. */
const APP_ROUTE_PREFIXES = ['/api/', '/generated/'];

/**
 * Resolve one texture slot for one target, or explain why it cannot travel.
 * `null` means the slot is empty — nothing was dropped.
 *
 * - `blender` gets something `bpy.data.images.load` (or the generated
 *   downloader) can open: an http(s) URL, an app route made absolute with
 *   `origin`, or a filesystem path.
 * - `ue5` gets only an already-imported `/Game/...` asset path.
 */
export function resolveChannelSource(
  url: string | null | undefined,
  target: 'blender',
  origin: string,
): { source: string } | { reason: string } | null;
export function resolveChannelSource(
  url: string | null | undefined,
  target: 'ue5',
  origin?: string,
): { assetPath: string } | { reason: string } | null;
export function resolveChannelSource(
  url: string | null | undefined,
  target: ChannelTarget,
  origin = '',
): { source: string } | { assetPath: string } | { reason: string } | null {
  if (!url) return null;
  if (url.startsWith('blob:')) return { reason: BLOB_REASON[target] };
  const isUeAsset = url.startsWith('/Game/');
  if (target === 'ue5') {
    if (isUeAsset) return { assetPath: url };
    return { reason: `"${url}" is not a UE asset path. Import the map into the Content Browser and re-export, or set the parameter by hand.` };
  }
  if (isUeAsset) return { reason: UE_ASSET_TO_BLENDER_REASON };
  if (url.startsWith('data:')) return { reason: DATA_REASON };
  if (url.startsWith('http://') || url.startsWith('https://')) return { source: url };
  if (APP_ROUTE_PREFIXES.some((p) => url.startsWith(p))) return { source: `${origin}${url}` };
  return { source: url }; // an absolute filesystem path
}
