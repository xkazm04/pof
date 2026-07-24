'use client';

import { Zap, CircleDot, Plug, BookOpen, Info, Check } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import type { MaterialConfiguratorConfig } from './types';
import { SURFACES, FEATURES, GLOSSARY } from './constants';
import { useMaterialParameterConfigurator } from './useMaterialParameterConfigurator';
import { ParametersSection } from './ParametersSection';
import { MaterialBudgetBar } from '../MaterialBudgetBar';

export type {
  SurfaceType,
  RenderFeature,
  MaterialOutputType,
  ParameterRange,
  MaterialConfiguratorConfig,
} from './types';

// ── Component ──

interface MaterialParameterConfiguratorProps {
  onGenerate: (config: MaterialConfiguratorConfig) => void;
  isGenerating: boolean;
}

export function MaterialParameterConfigurator({ onGenerate, isGenerating }: MaterialParameterConfiguratorProps) {
  const {
    surfaceType,
    features,
    outputType,
    paramValues,
    explainMode,
    showGlossary,
    setExplainMode,
    setShowGlossary,
    setOutputType,
    bridgeConnected,
    bridgeMaterials,
    selectSurface,
    toggleFeature,
    setParam,
    applicableParams,
    surfaceDef,
    handleGenerate,
  } = useMaterialParameterConfigurator(onGenerate);

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CircleDot className="w-4 h-4" style={{ color: MODULE_COLORS.content }} />
        <div>
          <h3 className="text-xs font-semibold text-text">Material Configurator</h3>
          <p className="text-2xs text-text-muted">Configure surface, features, and parameters</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExplainMode((v) => !v)}
            aria-pressed={explainMode}
            data-testid="material-explain-toggle"
            title="Decode the technical jargon into plain English"
            className={`focus-ring flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-medium border transition-colors ${
              explainMode
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : 'bg-surface border-border text-text-muted hover:text-text'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            Explain
          </button>
          <button
            type="button"
            onClick={() => setShowGlossary((v) => !v)}
            aria-expanded={showGlossary}
            data-testid="material-glossary-toggle"
            title="What do these terms mean?"
            className={`focus-ring flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-medium border transition-colors ${
              showGlossary
                ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400'
                : 'bg-surface border-border text-text-muted hover:text-text'
            }`}
          >
            <Info className="w-3 h-3" />
            Glossary
          </button>
        </div>
      </div>

      {showGlossary && (
        <div role="region" aria-label="Glossary" className="rounded-lg border border-border bg-surface-deep p-3 space-y-1.5">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="text-2xs flex gap-2">
              <span className="font-mono text-text w-24 flex-shrink-0">{g.term}</span>
              <span className="text-text-muted">{g.plain}</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Surface Type ─── */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-text-muted uppercase tracking-widest">Surface Type</h4>
        <div className="grid grid-cols-4 gap-4">
          {SURFACES.map((s) => {
            const isActive = surfaceType === s.id;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSurface(s.id)}
                aria-pressed={isActive}
                className="focus-ring relative flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all text-center"
                style={{
                  backgroundColor: isActive ? `${s.color}15` : 'var(--surface-deep)',
                  border: `1px solid ${isActive ? `${s.color}50` : 'var(--border)'}`,
                }}
              >
                {/* Glyph cue so the selected surface is not signalled by hue alone */}
                {isActive && (
                  <Check className="absolute top-1 right-1 w-2.5 h-2.5" style={{ color: s.color }} aria-hidden="true" />
                )}
                <Icon className="w-3.5 h-3.5" style={{ color: isActive ? s.color : 'var(--text-muted)' }} />
                <span className="text-2xs font-medium" style={{ color: isActive ? s.color : 'var(--text-muted)' }}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-2xs text-text-muted px-1">
          {explainMode ? surfaceDef.plain : surfaceDef.description}
        </p>
      </div>

      {/* ─── Output Type ─── */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-text-muted uppercase tracking-widest">Output Type</h4>
        <div className="flex gap-2">
          {([
            { id: 'master' as const, label: 'Master Material', desc: 'Full shader with parameters and switches' },
            { id: 'instance' as const, label: 'Material Instance', desc: 'Instance of existing master material' },
          ]).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setOutputType(opt.id)}
              aria-pressed={outputType === opt.id}
              className="focus-ring flex-1 px-3 py-2 rounded-lg text-left transition-all"
              style={{
                backgroundColor: outputType === opt.id ? `${MODULE_COLORS.content}12` : 'var(--surface-deep)',
                border: `1px solid ${outputType === opt.id ? `${MODULE_COLORS.content}40` : 'var(--border)'}`,
              }}
            >
              <span
                className="text-xs font-semibold flex items-center gap-1"
                style={{ color: outputType === opt.id ? MODULE_COLORS.content : 'var(--text-muted)' }}
              >
                {/* Glyph cue so the selected output is not signalled by hue alone */}
                {outputType === opt.id && <Check className="w-3 h-3 flex-shrink-0" aria-hidden="true" />}
                {opt.label}
              </span>
              <span className="text-2xs text-text-muted">{opt.desc}</span>
            </button>
          ))}
        </div>
        {outputType === 'instance' && (
          <p className="text-2xs px-1 py-1 rounded bg-status-amber-subtle border border-status-amber-medium text-[#f59e0bcc]">
            Recommended: Use Material Instances for per-object variation without recompiling shaders.
          </p>
        )}
      </div>

      {/* ─── Rendering Features ─── */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-text-muted uppercase tracking-widest">Rendering Features</h4>
        <div className="grid grid-cols-2 gap-4">
          {FEATURES.map((f) => {
            const isActive = features.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggleFeature(f.id)}
                aria-pressed={isActive}
                className="focus-ring flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all"
                style={{
                  backgroundColor: isActive ? `${f.color}10` : 'var(--surface-deep)',
                  border: `1px solid ${isActive ? `${f.color}40` : 'var(--border)'}`,
                }}
              >
                {/* Toggle dot */}
                <span
                  className="flex-shrink-0 w-2.5 h-2.5 rounded-full border transition-all"
                  style={{
                    borderColor: isActive ? f.color : 'var(--border-bright)',
                    backgroundColor: isActive ? f.color : 'transparent',
                  }}
                />
                <div className="min-w-0">
                  <span
                    className="text-2xs font-semibold block"
                    style={{ color: isActive ? f.color : 'var(--text-muted)' }}
                    title={`UE: ${f.label}`}
                  >
                    {explainMode ? f.plain.label : f.shortLabel}
                  </span>
                  <span className="text-2xs text-text-muted block truncate">
                    {explainMode ? f.plain.explanation : f.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Parameter Ranges ─── */}
      <ParametersSection
        applicableParams={applicableParams}
        paramValues={paramValues}
        explainMode={explainMode}
        surfaceDef={surfaceDef}
        setParam={setParam}
      />

      {/* ─── Live Material Data from Bridge ─── */}
      {bridgeConnected && bridgeMaterials.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
            <Plug className="w-3 h-3 text-green-400" />
            Live from Bridge
            <span className="text-green-400 font-normal">({bridgeMaterials.length} materials)</span>
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
            {bridgeMaterials.map((mat) => (
              <div
                key={mat.path}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-surface-deep border border-border hover:border-green-500/30 transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-2xs text-text block truncate font-mono">{mat.path.split('/').pop()}</span>
                  <span className="text-2xs text-text-muted">{mat.domain} &middot; {mat.shadingModel}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 text-2xs text-text-muted">
                  <span>{mat.paramCount} params</span>
                  <span>{mat.instanceCount} inst</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Shader Budget — sampler + instruction cost estimator ─── */}
      <MaterialBudgetBar surfaceType={surfaceType} features={features} />

      {/* ─── Generate Button ─── */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating}
        className="focus-ring w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
        style={{
          backgroundColor: `${MODULE_COLORS.content}15`,
          color: MODULE_COLORS.content,
          border: `1px solid ${MODULE_COLORS.content}30`,
        }}
      >
        <Zap className="w-3.5 h-3.5" />
        {isGenerating
          ? 'Generating...'
          : `Generate ${outputType === 'master' ? 'Master Material' : 'Material Instance'} — ${surfaceDef.label}`
        }
      </button>
    </div>
  );
}
