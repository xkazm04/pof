import { Sparkles, Droplets, Flame, Eye, Shield, Snowflake, Waves, Gem } from 'lucide-react';
import { ACCENT_ORANGE, ACCENT_VIOLET, STATUS_IMPROVED } from '@/lib/chart-colors';
import { waterShaderScript } from '@/lib/blender-mcp/scripts/shader-patterns/water';
import { fireShaderScript } from '@/lib/blender-mcp/scripts/shader-patterns/fire';
import { dissolveShaderScript } from '@/lib/blender-mcp/scripts/shader-patterns/dissolve';
import type { MaterialCategory, MaterialPattern } from './types';

// ── Static Pattern Data ──

export const CATEGORY_META: Record<MaterialCategory, { label: string; color: string }> = {
  elemental: { label: 'Elemental', color: ACCENT_ORANGE },
  stylized: { label: 'Stylized', color: ACCENT_VIOLET },
  utility: { label: 'Utility', color: STATUS_IMPROVED },
};

export const SHADER_SCRIPT_MAP: Record<string, () => string> = {
  'mat-water': () => waterShaderScript({ materialName: 'Water_Surface', waveScale: 8.0 }),
  'mat-fire': () => fireShaderScript({ materialName: 'Fire_Embers', intensity: 5.0 }),
  'mat-dissolve': () => dissolveShaderScript({ materialName: 'Dissolve_Effect' }),
};

export const MATERIAL_PATTERNS: MaterialPattern[] = [
  {
    id: 'mat-water',
    name: 'Water Surface',
    category: 'elemental',
    icon: Droplets,
    description: 'Translucent water with animated normals, depth-based opacity fade, refraction, caustics projection, and foam at shore edges.',
    approach: 'Two-layer scrolling normal maps blended with Lerp. Depth fade via SceneDepth – PixelDepth for shore transparency. Refraction offset driven by normal map intensity. Caustics from a projected texture panning in world space.',
    hlslSnippet: `// Depth-based opacity
float Depth = SceneDepth - PixelDepth;
float Shore = saturate(Depth / ShoreDistance);
// Dual normal blend
float3 N1 = tex2D(NormalA, UV + Time * Flow1);
float3 N2 = tex2D(NormalB, UV + Time * Flow2);
float3 FinalNormal = normalize(lerp(N1, N2, 0.5));`,
    tags: ['translucent', 'animated', 'refraction', 'depth-fade'],
  },
  {
    id: 'mat-fire',
    name: 'Fire / Embers',
    category: 'elemental',
    icon: Flame,
    description: 'Emissive fire material with scrolling distortion mask, color ramp from red → orange → yellow, and flickering intensity.',
    approach: 'Vertical UV scroll on a noise texture for shape. Color ramp using a gradient texture or lerp chain. Distortion via a second noise texture offsetting UVs. Emissive intensity modulated by Time-based sine for flicker.',
    hlslSnippet: `// Scrolling fire shape
float2 FireUV = UV + float2(0, -Time * ScrollSpeed);
float Shape = tex2D(NoiseTex, FireUV).r;
// Color ramp
float3 Color = lerp(RedBase, YellowTip, Shape);
// Flicker
float Flicker = 1.0 + 0.3 * sin(Time * FlickerRate);
EmissiveColor = Color * Shape * Flicker * Intensity;`,
    tags: ['emissive', 'animated', 'noise', 'color-ramp'],
  },
  {
    id: 'mat-dissolve',
    name: 'Dissolve Effect',
    category: 'utility',
    icon: Sparkles,
    description: 'Opacity-mask dissolve driven by a noise texture and a scalar parameter (0→1). Glowing edge emission at the dissolve boundary.',
    approach: 'Compare noise texture value against a DissolveAmount parameter for OpacityMask. Edge glow by checking a thin band around the threshold. Feed edge mask into emissive for a burning/glowing edge look.',
    hlslSnippet: `// Dissolve mask
float Noise = tex2D(DissolveTex, UV).r;
float Mask = step(DissolveAmount, Noise);
OpacityMask = Mask;
// Edge glow
float Edge = smoothstep(DissolveAmount, DissolveAmount + EdgeWidth, Noise);
float EdgeMask = Mask * (1.0 - Edge);
EmissiveColor = EdgeColor * EdgeMask * EdgeIntensity;`,
    tags: ['opacity-mask', 'noise', 'emissive-edge', 'parameter-driven'],
  },
  {
    id: 'mat-hologram',
    name: 'Hologram',
    category: 'stylized',
    icon: Eye,
    description: 'Translucent holographic shader with scanlines, Fresnel rim glow, subtle vertex jitter, and chromatic aberration.',
    approach: 'Fresnel node drives rim intensity. Scanlines from frac(WorldPosition.Z * LineFreq). Vertex offset with small random jitter on a timer for glitch. RGB channels offset slightly for chromatic aberration.',
    hlslSnippet: `// Scanlines
float Scan = frac(WorldPos.Z * LineFreq + Time * ScanSpeed);
Scan = step(0.5, Scan);
// Fresnel rim
float Rim = pow(1.0 - saturate(dot(Normal, ViewDir)), FresnelExp);
// Glitch jitter
float Jitter = frac(sin(Time * 43758.5453)) * GlitchAmt;
WorldPosOffset = float3(Jitter, 0, 0);
EmissiveColor = HoloColor * (Scan * 0.5 + Rim) * Intensity;`,
    tags: ['translucent', 'fresnel', 'scanlines', 'vertex-offset'],
  },
  {
    id: 'mat-forcefield',
    name: 'Force Field',
    category: 'stylized',
    icon: Shield,
    description: 'Translucent shield bubble with Fresnel edge glow, hexagonal pattern, and impact ripple effect driven by a world-space hit location.',
    approach: 'Fresnel for edge visibility. Hexagon pattern from a tiling texture or procedural hex math. Impact ripple: distance from HitPoint in world space, expanding ring via Time. Depth fade for soft intersection with geometry.',
    hlslSnippet: `// Fresnel edge
float Fresnel = pow(1.0 - saturate(dot(N, V)), 3.0);
// Hex pattern
float Hex = tex2D(HexTex, UV * HexTile).r;
// Impact ripple
float Dist = distance(WorldPos, HitPoint);
float Ring = smoothstep(RippleRadius, RippleRadius + 0.1,
             Dist) * (1.0 - smoothstep(RippleRadius + 0.1,
             RippleRadius + 0.3, Dist));
// Depth intersection glow
float Intersect = 1.0 - saturate((SceneDepth - PixelDepth) / SoftDist);
Opacity = saturate(Fresnel + Hex * 0.3 + Ring + Intersect);`,
    tags: ['translucent', 'fresnel', 'hexagon', 'impact-ripple', 'depth-fade'],
  },
  {
    id: 'mat-glass',
    name: 'Glass / Crystal',
    category: 'elemental',
    icon: Gem,
    description: 'Physically-based glass with refraction, specular highlights, tint color, and optional frosted roughness variation.',
    approach: 'Translucent shading model with high specular (0.9+), low roughness. Refraction via SceneColor offset. Tint via BaseColor multiply on refracted scene. Frosted look by lerping roughness with a noise texture.',
    hlslSnippet: `// PBR glass parameters
BaseColor = TintColor;
Metallic = 0.0;
Specular = 0.95;
Roughness = lerp(0.02, 0.4, FrostMask);
// Refraction
float2 RefractOffset = Normal.xy * RefractionStrength;
float3 SceneCol = tex2D(SceneColorTex, ScreenUV + RefractOffset);
EmissiveColor = SceneCol * TintColor * Opacity;`,
    tags: ['translucent', 'refraction', 'pbr', 'specular'],
  },
  {
    id: 'mat-ice',
    name: 'Ice / Frost',
    category: 'elemental',
    icon: Snowflake,
    description: 'Sub-surface ice material with blue-white color ramp, crystalline normal detail, inner glow via SSS, and surface frost layer.',
    approach: 'Subsurface shading model with blue subsurface color. Two normal map layers: large ice cracks + fine crystal detail. Frost overlay controlled by a mask parameter. Emissive inner glow modulated by depth.',
    hlslSnippet: `// Subsurface ice
SubsurfaceColor = float3(0.4, 0.7, 1.0);
// Dual normal detail
float3 NCracks = tex2D(CrackNormal, UV * 2.0);
float3 NCrystal = tex2D(CrystalNormal, UV * 8.0);
Normal = BlendAngleCorrected(NCracks, NCrystal);
// Frost overlay
float Frost = tex2D(FrostMask, UV).r * FrostAmount;
Roughness = lerp(0.1, 0.8, Frost);
BaseColor = lerp(IceColor, float3(0.9, 0.95, 1.0), Frost);`,
    tags: ['subsurface', 'dual-normal', 'frost-mask', 'pbr'],
  },
  {
    id: 'mat-lava',
    name: 'Lava / Magma',
    category: 'elemental',
    icon: Waves,
    description: 'Emissive lava with animated flow via panning UVs, dark crust breakup, heat distortion, and temperature-based color shift.',
    approach: 'Base crust from a dark rock texture. Emissive lava showing through crust cracks via a noise mask. UV panning for slow flow. Temperature parameter shifts emissive from deep red to bright yellow-white. Heat haze via refraction offset.',
    hlslSnippet: `// Crust vs lava mask
float2 FlowUV = UV + Time * float2(0.02, 0.01);
float CrustMask = tex2D(CrustNoise, FlowUV).r;
CrustMask = smoothstep(CrustThreshold, CrustThreshold + 0.1, CrustMask);
// Temperature color
float3 LavaColor = lerp(DeepRed, BrightYellow, Temperature);
// Combine
BaseColor = lerp(RockColor, float3(0,0,0), 1.0 - CrustMask);
EmissiveColor = LavaColor * (1.0 - CrustMask) * EmissiveIntensity;
Roughness = lerp(0.2, 0.9, CrustMask);`,
    tags: ['emissive', 'animated', 'noise', 'temperature'],
  },
];
