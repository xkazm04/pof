import type { SurfaceType, RenderFeature } from '../MaterialParameterConfigurator';
import { ACCENT_VIOLET, STATUS_BLOCKER, STATUS_IMPROVED, ACCENT_ORANGE, STATUS_SUCCESS, STATUS_MUTED, ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';

// ── Constants ──

export const SURFACE_LABELS: Record<SurfaceType, string> = {
  metal: 'Metal',
  cloth: 'Cloth',
  skin: 'Skin',
  glass: 'Glass',
  water: 'Water',
  emissive: 'Emissive',
  foliage: 'Foliage',
  stone: 'Stone',
};

export const SURFACE_COLORS: Record<SurfaceType, string> = {
  metal: STATUS_MUTED,
  cloth: ACCENT_VIOLET,
  skin: STATUS_BLOCKER,
  glass: STATUS_IMPROVED,
  water: ACCENT_CYAN_LIGHT,
  emissive: ACCENT_ORANGE,
  foliage: STATUS_SUCCESS,
  stone: '#78716c',
};

export const FEATURE_LABELS: Record<RenderFeature, string> = {
  subsurface: 'SSS',
  parallax: 'Parallax',
  emissive: 'Emissive',
  refraction: 'Refraction',
  tessellation: 'Tessellation',
  worldPositionOffset: 'WPO',
};

export const EXAMPLE_REFERENCES = [
  { label: 'Fire VFX (Hades-style)', desc: 'Stylized fire effect with scrolling noise, emissive color ramp, and particle-like edges' },
  { label: 'Stone Texture (Elden Ring)', desc: 'Weathered stone with parallax depth, moss patches, and roughness variation' },
  { label: 'Glow Effects (Hollow Knight)', desc: 'Soft emissive glow with rim lighting and subsurface scatter through crystal-like material' },
  { label: 'Metal Armor (Dark Souls)', desc: 'Worn metallic surface with scratched roughness, low metallic in weathered areas, specular highlights' },
  { label: 'Water Surface (Zelda)', desc: 'Stylized translucent water with animated normals, depth-based color shift, and foam at edges' },
];
