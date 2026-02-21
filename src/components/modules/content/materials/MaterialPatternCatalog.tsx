'use client';

import { useState, useMemo, useCallback } from 'react';
import { Sparkles, Search, Zap, Droplets, Flame, Eye, Shield, Snowflake, Waves, Gem } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { ACCENT_ORANGE, ACCENT_VIOLET, STATUS_IMPROVED } from '@/lib/chart-colors';

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
  elemental: { label: 'Elemental', color: ACCENT_ORANGE },
  stylized: { label: 'Stylized', color: ACCENT_VIOLET },
  utility: { label: 'Utility', color: STATUS_IMPROVED },
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
    <div className="w-full h-full bg-[#03030a] rounded-2xl border border-violet-900/30 shadow-[inset_0_0_80px_rgba(167,139,250,0.05)] p-6 relative overflow-y-auto">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-violet-900/30 pb-4">
          <div className="w-12 h-12 rounded-xl bg-violet-900/40 border border-violet-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.3)]">
            <Sparkles className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-widest uppercase text-violet-100">Material Pattern Library</h3>
            <p className="text-[10px] text-violet-400/60 uppercase tracking-wider mt-0.5">
              DATABASE_ENTRIES: {MATERIAL_PATTERNS.length} — PROCEDURAL_SHADER_ARCHIVES
            </p>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-black/40 border border-violet-900/30 p-3 rounded-xl">
          <div className="flex-1 relative w-full xl:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-500/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="QUERY PATTERNS..."
              className="w-full pl-9 pr-4 py-2 bg-black/60 border border-violet-900/40 rounded-lg text-xs font-mono text-violet-100 placeholder-violet-500/40 outline-none focus:border-violet-500 transition-colors shadow-inner uppercase tracking-wider"
              spellCheck={false}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
            {(['all', 'elemental', 'stylized', 'utility'] as const).map((cat) => {
              const isActive = selectedCategory === cat;
              const color = cat === 'all' ? MODULE_COLORS.content : CATEGORY_META[cat].color;
              const label = cat === 'all' ? 'All' : CATEGORY_META[cat].label;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all relative overflow-hidden flex-shrink-0"
                  style={{
                    backgroundColor: isActive ? `${color}20` : 'rgba(0,0,0,0.4)',
                    color: isActive ? color : 'var(--text-muted)',
                    border: `1px solid ${isActive ? `${color}50` : 'rgba(139,92,246,0.2)'}`,
                    boxShadow: isActive ? `0 0 15px ${color}20` : 'none',
                  }}
                >
                  {isActive && <div className="absolute bottom-0 inset-x-0 h-0.5" style={{ backgroundColor: color }} />}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pattern List */}
        <div className="space-y-3">
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
            <div className="text-center py-12 bg-black/40 border border-violet-900/30 rounded-xl">
              <p className="text-xs font-mono text-violet-500/60 uppercase tracking-widest">NO_PATTERNS_FOUND</p>
            </div>
          )}
        </div>
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
      className="rounded-xl border transition-all duration-500 overflow-hidden relative group"
      style={{
        borderColor: isExpanded ? `${catMeta.color}50` : 'rgba(139,92,246,0.2)',
        backgroundColor: isExpanded ? 'rgba(3,3,10,0.9)' : 'rgba(10,10,25,0.6)',
        boxShadow: isExpanded ? `0 0 30px ${catMeta.color}15, inset 0 0 20px ${catMeta.color}10` : 'none',
      }}
    >
      {isExpanded && <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent pointer-events-none mix-blend-overlay" />}

      {/* Collapsed header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-3 text-left relative z-10"
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${catMeta.color}20, ${catMeta.color}05)`,
            border: `1px solid ${catMeta.color}40`,
            boxShadow: `0 0 15px ${catMeta.color}20`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: catMeta.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-100 truncate">{pattern.name}</span>
            <span
              className="text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border"
              style={{ backgroundColor: `${catMeta.color}15`, borderColor: `${catMeta.color}40`, color: catMeta.color }}
            >
              {catMeta.label}
            </span>
          </div>
          <p className="text-[10px] text-violet-300/60 line-clamp-1 font-mono">{pattern.description}</p>
        </div>

        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full border border-violet-900/40 bg-black/60 group-hover:border-violet-500/50 transition-colors">
          <span
            className="text-[10px] font-mono transition-transform duration-300"
            style={{ color: catMeta.color, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 space-y-5 relative z-10 border-t border-violet-900/30 w-full overflow-hidden">
          <div className="absolute left-4 top-4 bottom-4 w-px bg-violet-900/40" />

          <div className="pl-6 space-y-4">
            {/* Description */}
            <p className="text-[11px] text-violet-200/80 leading-relaxed font-mono">
              <span className="text-[10px] text-violet-500 uppercase tracking-widest block mb-1 font-bold">SYNOPSIS</span>
              {pattern.description}
            </p>

            {/* Approach */}
            <div>
              <span className="text-[10px] text-amber-500 uppercase tracking-widest block mb-1 font-bold">METHODOLOGY</span>
              <p className="text-[11px] text-amber-100/70 leading-relaxed font-mono bg-amber-500/5 border border-amber-500/20 p-3 rounded-lg">
                {pattern.approach}
              </p>
            </div>

            {/* HLSL Snippet */}
            <div className="w-full">
              <span className="text-[10px] text-emerald-500 uppercase tracking-widest block mb-1 font-bold">HLSL_SOURCE</span>
              <div className="relative w-full rounded-xl bg-black/80 border border-emerald-500/30 overflow-hidden shadow-inner">
                <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[8px] border-b border-emerald-500/30 uppercase tracking-widest font-bold">CORE_LOGIC</div>
                <pre className="text-[10px] leading-relaxed p-3 overflow-x-auto text-emerald-200/90 font-mono whitespace-pre">
                  {pattern.hlslSnippet}
                </pre>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 pt-2">
              {pattern.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] px-2 py-1 rounded bg-black/60 text-violet-300 border border-violet-900/50 uppercase tracking-widest font-mono"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {/* Generate button */}
            <button
              onClick={(e) => { e.stopPropagation(); onGenerate(); }}
              disabled={isGenerating}
              className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 mt-2 group outline-none"
              style={{
                backgroundColor: `${catMeta.color}15`,
                color: catMeta.color,
                border: `1px solid ${catMeta.color}50`,
                boxShadow: `0 0 20px ${catMeta.color}20, inset 0 0 10px ${catMeta.color}10`,
              }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
              <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:left-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

              {isGenerating ? (
                <div className="flex items-center gap-2 animate-pulse">
                  <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  COMPILING_SHADER...
                </div>
              ) : (
                <>
                  <Zap className="w-4 h-4 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(currentColor,0.8)] transition-all" />
                  EXECUTE {pattern.name} SYNTHESIS
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
