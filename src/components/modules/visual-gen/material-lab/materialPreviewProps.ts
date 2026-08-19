import type { PBRParams } from './useMaterialStore';

/**
 * The five loaded preview textures. Generic over the texture type so this stays
 * a pure function testable without a WebGL context (three is only needed to
 * CREATE the textures, not to decide which material slot each one drives).
 */
export interface PreviewMaps<T> {
  albedo: T | null;
  normal: T | null;
  metallic: T | null;
  roughness: T | null;
  ao: T | null;
}

export interface StandardMaterialProps<T> {
  /** Only when there is no albedo map — a map and a tint would multiply. */
  color?: string;
  map: T | null;
  normalMap: T | null;
  /** three reads a Vector2; r3f accepts the tuple and `.set()`s it. */
  normalScale?: [number, number];
  metalnessMap: T | null;
  roughnessMap: T | null;
  aoMap: T | null;
  /**
   * `( texel.r - 1 ) * aoMapIntensity + 1` in three's aomap_fragment chunk, so 0
   * is "ignore the map" and 1 is "full occlusion". `aoStrength` maps 1:1.
   */
  aoMapIntensity: number;
  metalness: number;
  roughness: number;
}

/**
 * Derive the `meshStandardMaterial` props for the live preview.
 *
 * Extracted from `MaterialPreview` so the mapping is assertable in a unit test:
 * an AO map + AO Strength change is now observable as a real `aoMap` /
 * `aoMapIntensity` change, which is what turned `aoStrength` from a slider read
 * by nothing into a parameter with an effect. (three's default `Texture.channel`
 * is 0, so `aoMap` samples the same `uv` set the built-in preview geometries
 * carry — no second UV set is needed.)
 */
export function buildStandardMaterialProps<T>(
  params: PBRParams,
  maps: PreviewMaps<T>,
): StandardMaterialProps<T> {
  return {
    color: maps.albedo ? undefined : params.baseColor,
    map: maps.albedo,
    normalMap: maps.normal,
    normalScale: maps.normal ? [params.normalStrength, params.normalStrength] : undefined,
    metalnessMap: maps.metallic,
    roughnessMap: maps.roughness,
    aoMap: maps.ao,
    aoMapIntensity: params.aoStrength,
    metalness: params.metallic,
    roughness: params.roughness,
  };
}
