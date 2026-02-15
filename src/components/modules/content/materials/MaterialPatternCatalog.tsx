'use client';

import { useState, useMemo, useCallback } from 'react';
import { Sparkles, Search, Zap, Droplets, Flame, Eye, Shield, Snowflake, Waves, Gem } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ── Types ──

export type MaterialCategory = 'elemental' | 'stylized' | 'utility';

export interface MaterialPattern {
  id: string;
  name: string;
  category: MaterialCategory;
  icon: LucideIcon;
  description: string;
  /** High-level approach using HLSL / material nodes */
  approach: string;
  /** Key HLSL snippet or node description */
  hlslSnippet: string;
  tags: string[];
}

export interface MaterialPatternCatalogConfig {
  patterns: MaterialPattern[];
}

// ── Static Pattern Data ──

const CATEGORY_META: Record<MaterialCategory, { label: string; color: string }> = {
  elemental: { label: 'Elemental', color: '#f97316' },
  stylized:  { label: 'Stylized',  color: '#a78bfa' },
  utility:   { label: 'Utility',   color: '#38bdf8' },
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

// ── Component ──

const ACCENT = '#f59e0b';

interface MaterialPatternCatalogProps {
  onGenerate: (pattern: MaterialPattern) => void;
  isGenerating: boolean;
}

export function MaterialPatternCatalog({ onGenerate, isGenerating }: MaterialPatternCatalogProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return MATERIAL_PATTERNS.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [search, selectedCategory]);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
        <div>
          <h3 className="text-xs font-semibold text-text">Material Pattern Library</h3>
          <p className="text-2xs text-text-muted">
            {MATERIAL_PATTERNS.length} patterns — click to expand, generate with Claude
          </p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patterns..."
            className="w-full pl-7 pr-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'elemental', 'stylized', 'utility'] as const).map((cat) => {
            const isActive = selectedCategory === cat;
            const color = cat === 'all' ? ACCENT : CATEGORY_META[cat].color;
            const label = cat === 'all' ? 'All' : CATEGORY_META[cat].label;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="px-2 py-1 rounded text-2xs font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? `${color}20` : 'transparent',
                  color: isActive ? color : 'var(--text-muted)',
                  border: `1px solid ${isActive ? `${color}40` : 'transparent'}`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pattern List */}
      <div className="space-y-2">
        {filtered.map((pattern) => (
          <PatternCard
            key={pattern.id}
            pattern={pattern}
            isExpanded={expandedId === pattern.id}
            onToggle={() => handleToggle(pattern.id)}
            onGenerate={() => onGenerate(pattern)}
            isGenerating={isGenerating}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-text-muted text-center py-6">No patterns match your search.</p>
        )}
      </div>
    </div>
  );
}

// ── Pattern Card ──

interface PatternCardProps {
  pattern: MaterialPattern;
  isExpanded: boolean;
  onToggle: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

function PatternCard({ pattern, isExpanded, onToggle, onGenerate, isGenerating }: PatternCardProps) {
  const Icon = pattern.icon;
  const catMeta = CATEGORY_META[pattern.category];

  return (
    <div
      className="rounded-xl border transition-all duration-base"
      style={{
        borderColor: isExpanded ? `${catMeta.color}40` : 'var(--border)',
        backgroundColor: isExpanded ? `${catMeta.color}06` : 'var(--surface-deep)',
      }}
    >
      {/* Collapsed header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left group"
      >
        <div
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${catMeta.color}18, ${catMeta.color}08)`,
            border: `1px solid ${catMeta.color}25`,
          }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: catMeta.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text">{pattern.name}</span>
            <span
              className="text-2xs font-medium uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${catMeta.color}12`, color: catMeta.color }}
            >
              {catMeta.label}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{pattern.description}</p>
        </div>

        <span
          className="text-2xs font-medium opacity-30 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all flex-shrink-0"
          style={{ color: catMeta.color }}
        >
          {isExpanded ? 'Collapse' : 'Expand'} →
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Description */}
          <p className="text-xs text-[#9b9ec0] leading-relaxed">{pattern.description}</p>

          {/* Approach */}
          <div>
            <h4 className="text-2xs font-semibold text-text uppercase tracking-widest mb-1">Approach</h4>
            <p className="text-xs text-text-muted-hover leading-relaxed">{pattern.approach}</p>
          </div>

          {/* HLSL Snippet */}
          <div>
            <h4 className="text-2xs font-semibold text-text uppercase tracking-widest mb-1">HLSL Reference</h4>
            <pre className="text-2xs leading-relaxed px-3 py-2 rounded-lg bg-[#0a0a1e] border border-border overflow-x-auto text-[#a0a4c4] font-mono whitespace-pre">
              {pattern.hlslSnippet}
            </pre>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {pattern.tags.map((tag) => (
              <span
                key={tag}
                className="text-2xs px-1.5 py-0.5 rounded bg-surface text-text-muted border border-border"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Generate button */}
          <button
            onClick={(e) => { e.stopPropagation(); onGenerate(); }}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            style={{
              backgroundColor: `${ACCENT}15`,
              color: ACCENT,
              border: `1px solid ${ACCENT}30`,
            }}
          >
            <Zap className="w-3.5 h-3.5" />
            Generate {pattern.name} Material
          </button>
        </div>
      )}
    </div>
  );
}
