import {
  Zap, RefreshCw, Eye, Palette, Sun, Sparkles, Gem, Droplets,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SurfaceType } from '../MaterialParameterConfigurator';
import { MODULE_COLORS } from '@/lib/constants';
import { ACCENT_VIOLET, STATUS_BLOCKER, STATUS_WARNING } from '@/lib/chart-colors';
import { SURFACE_LABELS, SURFACE_COLORS, FEATURE_LABELS } from './constants';
import { PropertyBar } from './PropertyBar';
import { AdjustSlider } from './AdjustSlider';
import type { AnalyzedProperties } from './types';

interface AnalysisResultsProps {
  analysis: AnalyzedProperties;
  effectiveAnalysis: AnalyzedProperties;
  adjustmentsOpen: boolean;
  setAdjustmentsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  overrideRoughness: number | null;
  setOverrideRoughness: React.Dispatch<React.SetStateAction<number | null>>;
  overrideMetallic: number | null;
  setOverrideMetallic: React.Dispatch<React.SetStateAction<number | null>>;
  overrideEmissive: number | null;
  setOverrideEmissive: React.Dispatch<React.SetStateAction<number | null>>;
  overrideSurface: SurfaceType | null;
  setOverrideSurface: React.Dispatch<React.SetStateAction<SurfaceType | null>>;
  handleAnalyze: () => void;
  isAnalyzing: boolean;
  handleGenerate: () => void;
  isGenerating: boolean;
}

export function AnalysisResults({
  analysis,
  effectiveAnalysis,
  adjustmentsOpen,
  setAdjustmentsOpen,
  overrideRoughness,
  setOverrideRoughness,
  overrideMetallic,
  setOverrideMetallic,
  overrideEmissive,
  setOverrideEmissive,
  overrideSurface,
  setOverrideSurface,
  handleAnalyze,
  isAnalyzing,
  handleGenerate,
  isGenerating,
}: AnalysisResultsProps) {
  return (
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
      <div className="grid grid-cols-2 gap-4">
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
              <div className="px-3 pb-3 space-y-4 border-t border-border pt-2">
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
  );
}
