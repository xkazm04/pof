'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  ImagePlus, Wand2, Zap, Upload, X, RefreshCw,
  Palette, Eye, Sun, Sparkles, Gem, Droplets,
  ChevronDown, ChevronRight, SplitSquareHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SurfaceType, RenderFeature } from './MaterialParameterConfigurator';
import { MODULE_COLORS } from '@/lib/constants';
import { ACCENT_VIOLET, STATUS_BLOCKER, STATUS_IMPROVED, ACCENT_ORANGE, STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';

// ── Types ──

export interface AnalyzedProperties {
  /** Dominant colors extracted (hex strings) */
  colorPalette: string[];
  /** Inferred surface type */
  surfaceType: SurfaceType;
  /** Confidence 0-1 */
  surfaceConfidence: number;
  /** Material properties 0-1 (or appropriate range) */
  roughness: number;
  metallic: number;
  emissiveIntensity: number;
  subsurfacePresence: number;
  parallaxDepth: number;
  opacity: number;
  /** Inferred rendering features */
  features: RenderFeature[];
  /** Free-form description from analysis */
  description: string;
  /** Suggested adjustments */
  suggestions: string[];
}

export interface StyleTransferConfig {
  /** Base64 data URL of the reference image */
  imageDataUrl: string | null;
  /** User-provided description of what they want */
  referenceDescription: string;
  /** Analyzed properties (null until analysis runs) */
  analysis: AnalyzedProperties | null;
  /** User adjustments applied on top of analysis */
  adjustments: Partial<AnalyzedProperties>;
}

// ── Constants ──

const SURFACE_LABELS: Record<SurfaceType, string> = {
  metal: 'Metal',
  cloth: 'Cloth',
  skin: 'Skin',
  glass: 'Glass',
  water: 'Water',
  emissive: 'Emissive',
  foliage: 'Foliage',
  stone: 'Stone',
};

const SURFACE_COLORS: Record<SurfaceType, string> = {
  metal: '#94a3b8',
  cloth: ACCENT_VIOLET,
  skin: STATUS_BLOCKER,
  glass: STATUS_IMPROVED,
  water: '#22d3ee',
  emissive: ACCENT_ORANGE,
  foliage: STATUS_SUCCESS,
  stone: '#78716c',
};

const FEATURE_LABELS: Record<RenderFeature, string> = {
  subsurface: 'SSS',
  parallax: 'Parallax',
  emissive: 'Emissive',
  refraction: 'Refraction',
  tessellation: 'Tessellation',
  worldPositionOffset: 'WPO',
};

const EXAMPLE_REFERENCES = [
  { label: 'Fire VFX (Hades-style)', desc: 'Stylized fire effect with scrolling noise, emissive color ramp, and particle-like edges' },
  { label: 'Stone Texture (Elden Ring)', desc: 'Weathered stone with parallax depth, moss patches, and roughness variation' },
  { label: 'Glow Effects (Hollow Knight)', desc: 'Soft emissive glow with rim lighting and subsurface scatter through crystal-like material' },
  { label: 'Metal Armor (Dark Souls)', desc: 'Worn metallic surface with scratched roughness, low metallic in weathered areas, specular highlights' },
  { label: 'Water Surface (Zelda)', desc: 'Stylized translucent water with animated normals, depth-based color shift, and foam at edges' },
];

// ── Component ──

interface MaterialStyleTransferProps {
  onGenerate: (config: StyleTransferConfig) => void;
  isGenerating: boolean;
}

export function MaterialStyleTransfer({ onGenerate, isGenerating }: MaterialStyleTransferProps) {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [referenceDescription, setReferenceDescription] = useState('');
  const [analysis, setAnalysis] = useState<AnalyzedProperties | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Adjustable overrides on top of analysis
  const [overrideRoughness, setOverrideRoughness] = useState<number | null>(null);
  const [overrideMetallic, setOverrideMetallic] = useState<number | null>(null);
  const [overrideEmissive, setOverrideEmissive] = useState<number | null>(null);
  const [overrideSurface, setOverrideSurface] = useState<SurfaceType | null>(null);

  const effectiveAnalysis = useMemo(() => {
    if (!analysis) return null;
    return {
      ...analysis,
      roughness: overrideRoughness ?? analysis.roughness,
      metallic: overrideMetallic ?? analysis.metallic,
      emissiveIntensity: overrideEmissive ?? analysis.emissiveIntensity,
      surfaceType: overrideSurface ?? analysis.surfaceType,
    };
  }, [analysis, overrideRoughness, overrideMetallic, overrideEmissive, overrideSurface]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB limit

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setAnalysis(null);
      setOverrideRoughness(null);
      setOverrideMetallic(null);
      setOverrideEmissive(null);
      setOverrideSurface(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setAnalysis(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleClearImage = useCallback(() => {
    setImageDataUrl(null);
    setAnalysis(null);
    setOverrideRoughness(null);
    setOverrideMetallic(null);
    setOverrideEmissive(null);
    setOverrideSurface(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!imageDataUrl && !referenceDescription.trim()) return;
    setIsAnalyzing(true);

    try {
      const res = await fetch('/api/style-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          imageDataUrl,
          description: referenceDescription,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAnalysis(json.data.analysis);
        setAdjustmentsOpen(true);
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setIsAnalyzing(false);
    }
  }, [imageDataUrl, referenceDescription]);

  const handleGenerate = useCallback(() => {
    onGenerate({
      imageDataUrl,
      referenceDescription,
      analysis: effectiveAnalysis,
      adjustments: {
        roughness: overrideRoughness ?? undefined,
        metallic: overrideMetallic ?? undefined,
        emissiveIntensity: overrideEmissive ?? undefined,
        surfaceType: overrideSurface ?? undefined,
      },
    });
  }, [onGenerate, imageDataUrl, referenceDescription, effectiveAnalysis, overrideRoughness, overrideMetallic, overrideEmissive, overrideSurface]);

  const handleExampleClick = useCallback((desc: string) => {
    setReferenceDescription(desc);
  }, []);

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImagePlus className="w-4 h-4" style={{ color: MODULE_COLORS.content }} />
          <div>
            <h3 className="text-xs font-semibold text-text">Style Transfer</h3>
            <p className="text-2xs text-text-muted">
              Upload a reference screenshot to generate matching UE5 materials
            </p>
          </div>
        </div>
        {analysis && (
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium border transition-colors ${
              compareMode
                ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400'
                : 'bg-surface border-border text-text-muted hover:text-text'
            }`}
          >
            <SplitSquareHorizontal className="w-3 h-3" />
            Compare
          </button>
        )}
      </div>

      {/* Image Upload / Drop Zone */}
      <div
        className="relative rounded-xl border-2 border-dashed transition-colors overflow-hidden"
        style={{
          borderColor: imageDataUrl ? `${MODULE_COLORS.content}40` : 'var(--border)',
          backgroundColor: imageDataUrl ? `${MODULE_COLORS.content}04` : 'var(--surface-deep)',
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {imageDataUrl ? (
          <div className={`${compareMode && analysis ? 'grid grid-cols-2 gap-0' : ''}`}>
            {/* Reference image */}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageDataUrl}
                alt="Reference"
                className="w-full max-h-48 object-contain bg-black/20"
              />
              <button
                onClick={handleClearImage}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <X className="w-3 h-3 text-white" />
              </button>
              {compareMode && (
                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-2xs text-white font-medium">
                  Reference
                </div>
              )}
            </div>

            {/* Analysis preview (compare mode) */}
            {compareMode && analysis && (
              <div className="bg-surface-deep flex flex-col items-center justify-center p-4 min-h-[12rem]">
                <div className="text-2xs text-text-muted mb-2 font-medium">Analyzed Properties</div>
                <AnalysisMiniPreview analysis={effectiveAnalysis!} />
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-10 flex flex-col items-center gap-2 text-text-muted hover:text-text transition-colors"
          >
            <Upload className="w-8 h-8 opacity-40" />
            <span className="text-xs font-medium">Drop a screenshot or click to upload</span>
            <span className="text-2xs text-text-muted/60">PNG, JPG up to 10MB</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Reference Description */}
      <div>
        <label className="text-2xs font-medium text-text-muted block mb-1">
          Describe the look you want (optional with image, required without)
        </label>
        <textarea
          value={referenceDescription}
          onChange={(e) => setReferenceDescription(e.target.value)}
          placeholder="e.g., Stylized fire with scrolling noise, bright orange-to-red color ramp, flickering emissive edges..."
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-xs text-text placeholder-text-muted/50 outline-none focus:border-border-bright transition-colors resize-none"
          rows={2}
        />
      </div>

      {/* Example references */}
      {!analysis && (
        <div>
          <div className="text-2xs font-medium text-text-muted mb-1.5">Quick examples</div>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_REFERENCES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => handleExampleClick(ex.desc)}
                className="px-2 py-1 rounded-full bg-surface border border-border text-2xs text-text-muted hover:text-text hover:border-border-bright transition-colors"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Analyze Button */}
      {!analysis && (
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || (!imageDataUrl && !referenceDescription.trim())}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          style={{
            backgroundColor: `${MODULE_COLORS.content}15`,
            color: MODULE_COLORS.content,
            border: `1px solid ${MODULE_COLORS.content}30`,
          }}
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Analyzing visual properties...
            </>
          ) : (
            <>
              <Wand2 className="w-3.5 h-3.5" />
              Analyze Reference
            </>
          )}
        </button>
      )}

      {/* Analysis Results */}
      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="space-y-3"
          >
            {/* Description */}
            <div className="px-3 py-2 rounded-lg bg-surface border border-border">
              <div className="flex items-center gap-1.5 mb-1">
                <Eye className="w-3 h-3 text-text-muted" />
                <span className="text-2xs font-medium text-text-muted">Analysis</span>
              </div>
              <p className="text-xs text-text">{effectiveAnalysis!.description}</p>
            </div>

            {/* Color palette */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Palette className="w-3 h-3 text-text-muted" />
                <span className="text-2xs font-medium text-text-muted">Color Palette</span>
              </div>
              <div className="flex gap-1.5">
                {effectiveAnalysis!.colorPalette.map((color, i) => (
                  <div
                    key={i}
                    className="flex-1 h-8 rounded-lg border border-border relative group"
                    style={{ backgroundColor: color }}
                  >
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                      <div className="bg-surface-deep border border-border rounded px-1.5 py-0.5 text-2xs text-text-muted whitespace-nowrap font-mono">
                        {color}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Surface type + confidence */}
            <div className="flex items-center gap-2">
              <span className="text-2xs font-medium text-text-muted">Surface:</span>
              <span
                className="px-2 py-0.5 rounded text-2xs font-semibold"
                style={{
                  backgroundColor: `${SURFACE_COLORS[effectiveAnalysis!.surfaceType]}15`,
                  color: SURFACE_COLORS[effectiveAnalysis!.surfaceType],
                  border: `1px solid ${SURFACE_COLORS[effectiveAnalysis!.surfaceType]}30`,
                }}
              >
                {SURFACE_LABELS[effectiveAnalysis!.surfaceType]}
              </span>
              <span className="text-2xs text-text-muted/60">
                {(effectiveAnalysis!.surfaceConfidence * 100).toFixed(0)}% confidence
              </span>
              <div className="flex-1" />
              {effectiveAnalysis!.features.length > 0 && (
                <div className="flex gap-1">
                  {effectiveAnalysis!.features.map((f) => (
                    <span key={f} className="px-1.5 py-0.5 rounded bg-surface-deep text-2xs text-text-muted font-medium">
                      {FEATURE_LABELS[f]}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Property bars */}
            <div className="grid grid-cols-2 gap-2">
              <PropertyBar label="Roughness" value={effectiveAnalysis!.roughness} max={1} color="#94a3b8" icon={Gem} />
              <PropertyBar label="Metallic" value={effectiveAnalysis!.metallic} max={1} color={ACCENT_VIOLET} icon={Sparkles} />
              <PropertyBar label="Emissive" value={effectiveAnalysis!.emissiveIntensity} max={20} color={STATUS_WARNING} icon={Sun} />
              <PropertyBar label="Subsurface" value={effectiveAnalysis!.subsurfacePresence} max={1} color={STATUS_BLOCKER} icon={Droplets} />
            </div>

            {/* Suggestions */}
            {effectiveAnalysis!.suggestions.length > 0 && (
              <div className="px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <div className="text-2xs font-medium text-amber-400 mb-1">Suggestions</div>
                <ul className="space-y-0.5">
                  {effectiveAnalysis!.suggestions.map((s, i) => (
                    <li key={i} className="text-2xs text-text-muted">• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Adjustments panel */}
            <div className="rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setAdjustmentsOpen(!adjustmentsOpen)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
              >
                {adjustmentsOpen ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
                <span className="text-2xs font-medium text-text">Refine Parameters</span>
                <span className="text-2xs text-text-muted/60">Adjust before generating</span>
              </button>

              <AnimatePresence>
                {adjustmentsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-2.5 border-t border-border pt-2">
                      {/* Surface override */}
                      <div>
                        <label className="text-2xs font-medium text-text-muted block mb-1">Surface Type</label>
                        <div className="flex flex-wrap gap-1">
                          {(Object.keys(SURFACE_LABELS) as SurfaceType[]).map((st) => {
                            const isActive = (overrideSurface ?? analysis.surfaceType) === st;
                            return (
                              <button
                                key={st}
                                onClick={() => setOverrideSurface(st === analysis.surfaceType ? null : st)}
                                className={`px-2 py-0.5 rounded text-2xs font-medium border transition-colors ${
                                  isActive
                                    ? 'border-amber-500/30 text-amber-400'
                                    : 'border-border text-text-muted hover:text-text'
                                }`}
                                style={isActive ? { backgroundColor: `${SURFACE_COLORS[st]}15` } : undefined}
                              >
                                {SURFACE_LABELS[st]}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Parameter sliders */}
                      <AdjustSlider
                        label="Roughness"
                        value={overrideRoughness ?? analysis.roughness}
                        defaultValue={analysis.roughness}
                        min={0} max={1} step={0.05}
                        onChange={setOverrideRoughness}
                        onReset={() => setOverrideRoughness(null)}
                      />
                      <AdjustSlider
                        label="Metallic"
                        value={overrideMetallic ?? analysis.metallic}
                        defaultValue={analysis.metallic}
                        min={0} max={1} step={0.05}
                        onChange={setOverrideMetallic}
                        onReset={() => setOverrideMetallic(null)}
                      />
                      <AdjustSlider
                        label="Emissive Intensity"
                        value={overrideEmissive ?? analysis.emissiveIntensity}
                        defaultValue={analysis.emissiveIntensity}
                        min={0} max={20} step={0.5}
                        onChange={setOverrideEmissive}
                        onReset={() => setOverrideEmissive(null)}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Generate + Re-analyze buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-surface border border-border text-text-muted hover:text-text transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                Re-analyze
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: `${MODULE_COLORS.content}15`,
                  color: MODULE_COLORS.content,
                  border: `1px solid ${MODULE_COLORS.content}30`,
                }}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Generating material...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Generate UE5 Material
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PropertyBar({
  label,
  value,
  max,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: typeof Gem;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-deep border border-border">
      <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-2xs text-text-muted">{label}</span>
          <span className="text-2xs font-mono" style={{ color }}>
            {value > 1 ? value.toFixed(1) : value.toFixed(2)}
          </span>
        </div>
        <div className="h-1 bg-surface rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-base" style={{ width: `${pct}%`, backgroundColor: `${color}80` }} />
        </div>
      </div>
    </div>
  );
}

function AdjustSlider({
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  onChange,
  onReset,
}: {
  label: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  const isModified = value !== defaultValue;
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-text-muted w-28 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-amber-400 cursor-pointer"
      />
      <span className={`text-2xs font-mono w-10 text-right flex-shrink-0 ${isModified ? 'text-amber-400' : 'text-text-muted'}`}>
        {value > 1 ? value.toFixed(1) : value.toFixed(2)}
      </span>
      {isModified && (
        <button onClick={onReset} className="text-2xs text-text-muted hover:text-text transition-colors">
          ×
        </button>
      )}
    </div>
  );
}

function AnalysisMiniPreview({ analysis }: { analysis: AnalyzedProperties }) {
  return (
    <div className="space-y-2 w-full">
      {/* Color swatches */}
      <div className="flex gap-1 justify-center">
        {analysis.colorPalette.slice(0, 5).map((c, i) => (
          <div
            key={i}
            className="w-6 h-6 rounded border border-border"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      {/* Properties */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-2xs">
        <div className="flex justify-between">
          <span className="text-text-muted">Rough</span>
          <span className="font-mono text-text">{analysis.roughness.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Metal</span>
          <span className="font-mono text-text">{analysis.metallic.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Emissive</span>
          <span className="font-mono text-text">{analysis.emissiveIntensity.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">SSS</span>
          <span className="font-mono text-text">{analysis.subsurfacePresence.toFixed(2)}</span>
        </div>
      </div>
      <div className="text-center">
        <span
          className="px-2 py-0.5 rounded text-2xs font-semibold"
          style={{
            backgroundColor: `${SURFACE_COLORS[analysis.surfaceType]}15`,
            color: SURFACE_COLORS[analysis.surfaceType],
          }}
        >
          {SURFACE_LABELS[analysis.surfaceType]}
        </span>
      </div>
    </div>
  );
}
