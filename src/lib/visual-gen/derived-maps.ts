/**
 * What the free, local albedo derivation (`/api/texture-maps`, `texture-maps.ts`)
 * produces — and what it deliberately does not — as machine-readable labels.
 *
 * A derived map is not an authored one. The normal is a real derivation (a
 * luminance heightfield's Sobel gradient), roughness is a documented heuristic,
 * and metalness is refused: albedo carries no metalness signal. Every consumer
 * reads these labels instead of restating the lib's prose, so the lab can show a
 * designer which of its maps were measured, which were guessed, and which are
 * missing on purpose.
 *
 * Colour space comes from the lab's one per-role table (`material-boundary.ts`):
 * every derived map is DATA, sampled as numbers. Height has no lab slot, so it has
 * no table row; a displacement map is linear data by definition.
 *
 * PURE and client-safe: no sharp, no fs (seam-check is imported for its type only).
 */
import { colourSpaceOf, type ColourSpace, type MaterialChannel } from '@/lib/visual-gen/material-boundary';
import type { SeamCheckResult } from '@/lib/visual-gen/seam-check';

/** How a lab map came to be. `authored` = uploaded or generated, not derived here. */
export type MapProvenance = 'derived' | 'heuristic' | 'authored';

export type DerivedChannel = 'normal' | 'roughness' | 'height';

export interface DerivedChannelSpec {
  channel: DerivedChannel;
  /** The lab texture slot this map fills; null when the lab has no slot for it. */
  slot: MaterialChannel | null;
  provenance: Exclude<MapProvenance, 'authored'>;
  method: string;
  colourSpace: ColourSpace;
}

export const DERIVED_CHANNELS: readonly DerivedChannelSpec[] = [
  {
    channel: 'normal',
    slot: 'normal',
    provenance: 'derived',
    method: 'luminance Sobel gradient, wrap-around sampling (a tileable albedo gives a tileable normal)',
    colourSpace: colourSpaceOf('normal'),
  },
  {
    channel: 'roughness',
    slot: 'roughness',
    provenance: 'heuristic',
    method: 'inverted luminance (dark crevices read rough); albedo has no true roughness signal',
    colourSpace: colourSpaceOf('roughness'),
  },
  {
    channel: 'height',
    slot: null,
    provenance: 'derived',
    method: 'luminance heightfield (the field the normal is built on)',
    colourSpace: 'linear',
  },
];

export interface RefusedChannel {
  channel: MaterialChannel;
  reason: string;
}

export const REFUSED_CHANNELS: readonly RefusedChannel[] = [
  { channel: 'metallic', reason: 'albedo carries no metalness signal; a derived one would be invented data' },
];

/** One served map in the `persist:true` response of `/api/texture-maps`. */
export interface DerivedMapEntry {
  channel: DerivedChannel;
  name: string;
  url: string;
  provenance: DerivedChannelSpec['provenance'];
  method: string;
  colourSpace: ColourSpace;
  /** The seam check run on THIS map's bytes; null when the check itself failed. */
  seam: SeamCheckResult | null;
}

export interface DerivedMapsResponse {
  maps: DerivedMapEntry[];
  refused: RefusedChannel[];
}

export function derivedChannelSpec(channel: DerivedChannel): DerivedChannelSpec | undefined {
  return DERIVED_CHANNELS.find((spec) => spec.channel === channel);
}

/** The spec whose map fills a given lab slot, if any. */
export function derivedSpecForSlot(slot: MaterialChannel): DerivedChannelSpec | undefined {
  return DERIVED_CHANNELS.find((spec) => spec.slot === slot);
}

/**
 * `derived_<hash>_<channel>.png` — content-addressed, so deriving the same albedo
 * twice rewrites the same files. Passes `safeGeneratedImageName` for any hex hash.
 */
export function derivedMapName(hash: string, channel: DerivedChannel): string {
  return `derived_${hash.replace(/[^A-Za-z0-9]/g, '')}_${channel}.png`;
}

/** Bytes -> base64 without Buffer (runs in the browser). Chunked to stay under arg limits. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
