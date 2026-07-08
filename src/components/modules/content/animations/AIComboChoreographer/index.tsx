'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Play, Copy, Check, ChevronRight, Download,
  Swords, Zap, Shield, Clock, Wind, RotateCcw, Monitor,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SchematicPanel } from '@/components/ui/SchematicPanel';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_INFO,
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD,
  OPACITY_20,
} from '@/lib/chart-colors';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { ACCENT, COMBO_PRESETS } from './constants';
import { generateMontageCode, generateJSON } from './helpers';
import { MontageTimeline } from './MontageTimeline';
import { ComboChainGraph } from './ComboChainGraph';
import { RootMotionPreview } from './RootMotionPreview';
import { StatBadge } from './StatBadge';
import { ComboParseFeedback } from './ComboParseFeedback';
import { useAIComboChoreographer } from './useAIComboChoreographer';

export { parseComboInput, generateCombo } from './helpers';
export type { MatchedComboKeyword, ComboParse } from './types';

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */

export function AIComboChoreographer() {
  const {
    prompt, setPrompt,
    isGenerating,
    generatedCombo,
    codePreview, setCodePreview,
    copied,
    blenderPreviewing,
    blenderResult,
    blenderConnected,
    handleGenerate,
    handlePreset,
    handleCopy,
    comboStats,
    handleBlenderPreview,
  } = useAIComboChoreographer();

  return (
    <div className="space-y-2.5">
      {/* Blender Connection */}
      <BlenderConnectionBar />

      {/* Header */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-40 h-40 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: `${ACCENT}10` }} />
        <SectionLabel icon={Sparkles} label="AI Combo Choreographer" color={ACCENT} />
        <p className="text-2xs text-text-muted mt-1">
          Describe your combo in natural language and generate complete montage section timings, notify window placement,
          damage values, root motion distances, and motion warping parameters.
        </p>

        {/* Prompt input */}
        <div className="flex gap-2 mt-2.5">
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
            placeholder="e.g. 3-hit combo with wide sweeping first hit, quick follow-up, and heavy overhead finisher with ground slam"
            className="flex-1 px-3 py-2 bg-surface-deep border border-border/40 rounded-lg text-xs text-text placeholder:text-text-muted/40 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
          >
            {isGenerating ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <RotateCcw className="w-3.5 h-3.5" />
              </motion.div>
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {/* Presets */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-2xs text-text-muted">Presets:</span>
          {COMBO_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => handlePreset(p.prompt)}
              disabled={isGenerating}
              className="text-2xs px-2 py-0.5 rounded-md border border-border/40 hover:border-border text-text-muted hover:text-text transition-colors disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </SurfaceCard>

      {/* Results */}
      <AnimatePresence mode="wait">
        {generatedCombo && comboStats && (
          <motion.div
            key={generatedCombo.name + generatedCombo.description}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-2.5"
          >
            {/* Parse feedback — tells the user how their words were interpreted */}
            <ComboParseFeedback parse={generatedCombo.parseInfo} />

            {/* Summary stats */}
            <SurfaceCard level={2} className="p-3">
              <SectionLabel icon={Swords} label="Combo Summary" color={ACCENT_ORANGE} />
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
                <StatBadge icon={Swords} label="Hits" value={String(comboStats.hits)} color={ACCENT} />
                <StatBadge icon={Clock} label="Duration" value={`${comboStats.duration}s`} color={ACCENT_CYAN} />
                <StatBadge icon={Zap} label="Damage" value={String(comboStats.damage)} color={STATUS_ERROR} />
                <StatBadge icon={Play} label="DPS" value={String(comboStats.dps)} color={ACCENT_ORANGE} />
                <StatBadge icon={Wind} label="Root Motion" value={`${comboStats.totalRootMotion}cm`} color={STATUS_INFO} />
                <StatBadge icon={Shield} label="Warps" value={String(comboStats.warpCount)} color={ACCENT_EMERALD} />
              </div>
            </SurfaceCard>

            {/* Montage Timeline */}
            <SurfaceCard level={2} className="p-3">
              <SectionLabel icon={Play} label="Montage Timeline" color={ACCENT_CYAN} />
              <p className="text-2xs text-text-muted mt-0.5 mb-2">
                Each bar represents a montage section. Colored regions are AnimNotify windows.
              </p>
              <MontageTimeline sections={generatedCombo.sections} />
            </SurfaceCard>

            {/* Combo Chain Graph */}
            <SurfaceCard level={2} className="p-3">
              <SectionLabel icon={ChevronRight} label="Combo Chain Graph" color={ACCENT} />
              <p className="text-2xs text-text-muted mt-0.5 mb-2">
                Node connections show combo window timings for input buffering.
              </p>
              {/* Schematic well — same re-themeable surface as the State Machine canvas. */}
              <SchematicPanel tone="well" accent={ACCENT} className="p-3">
                <div className="overflow-x-auto custom-scrollbar">
                  <ComboChainGraph combo={generatedCombo} />
                </div>
              </SchematicPanel>
            </SurfaceCard>

            {/* Root Motion Preview */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
              <SurfaceCard level={2} className="p-3">
                <SectionLabel icon={Wind} label="Root Motion Trajectory" color={STATUS_INFO} />
                <p className="text-2xs text-text-muted mt-0.5 mb-2">
                  Forward displacement per section. Green = motion warped.
                </p>
                <RootMotionPreview sections={generatedCombo.sections} />
              </SurfaceCard>

              {/* Per-section detail table */}
              <SurfaceCard level={2} className="p-3">
                <SectionLabel icon={Clock} label="Section Details" color={ACCENT_ORANGE} />
                <div className="overflow-x-auto custom-scrollbar mt-2">
                  <table className="w-full text-2xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/40 text-text-muted font-bold uppercase">
                        <th className="text-left py-1 pr-2">#</th>
                        <th className="text-left py-1 pr-2">Name</th>
                        <th className="text-right py-1 pr-2">Dur</th>
                        <th className="text-right py-1 pr-2">Dmg</th>
                        <th className="text-right py-1 pr-2">Root</th>
                        <th className="text-center py-1">Warp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedCombo.sections.map((sec, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-surface/30 transition-colors">
                          <td className="py-1 pr-2 font-mono text-text-muted">{i + 1}</td>
                          <td className="py-1 pr-2 font-bold text-text">{sec.label}</td>
                          <td className="py-1 pr-2 text-right font-mono" style={{ color: ACCENT_CYAN }}>{sec.duration}s</td>
                          <td className="py-1 pr-2 text-right font-mono" style={{ color: STATUS_ERROR }}>{sec.damage}</td>
                          <td className="py-1 pr-2 text-right font-mono text-text-muted">{sec.rootMotionDistance}cm</td>
                          <td className="py-1 text-center">
                            {sec.motionWarpTarget && <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_EMERALD }} />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SurfaceCard>
            </div>

            {/* Export */}
            <SurfaceCard level={2} className="p-3">
              <SectionLabel icon={Download} label="Export" color={ACCENT_EMERALD} />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setCodePreview({ code: generateMontageCode(generatedCombo), title: 'UE5 Combo Struct (.h)' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:brightness-110"
                  style={{ borderColor: `${ACCENT}30`, backgroundColor: `${ACCENT}08`, color: ACCENT }}
                >
                  <Swords className="w-3 h-3" /> UE5 Header
                </button>
                <button
                  onClick={() => setCodePreview({ code: generateJSON(generatedCombo), title: 'Combo Definition (JSON)' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:brightness-110"
                  style={{ borderColor: `${ACCENT_EMERALD}30`, backgroundColor: `${ACCENT_EMERALD}08`, color: ACCENT_EMERALD }}
                >
                  <Download className="w-3 h-3" /> Export JSON
                </button>
                <button
                  onClick={handleBlenderPreview}
                  disabled={!blenderConnected || blenderPreviewing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:brightness-110 disabled:opacity-40"
                  style={{ borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.08)', color: 'rgb(52,211,153)' }}
                  title={!blenderConnected ? 'Connect to Blender first' : 'Preview combo animation in Blender'}
                >
                  {blenderPreviewing ? (
                    <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    <Monitor className="w-3 h-3" />
                  )}
                  {blenderPreviewing ? 'Sending...' : 'Preview in Blender'}
                </button>
              </div>
              {blenderResult && (
                <div className={`text-xs font-mono px-3 py-2 rounded-lg border mt-2 ${blenderResult.isError ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}`}>
                  {blenderResult.message}
                </div>
              )}
            </SurfaceCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Code Preview Modal */}
      <AnimatePresence>
        {codePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setCodePreview(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-surface-deep border border-border/60 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
                  <span className="text-sm font-bold text-text">{codePreview.title}</span>
                </div>
                <button
                  onClick={() => handleCopy(codePreview.code)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors"
                  style={{
                    borderColor: copied ? `${STATUS_SUCCESS}50` : `${ACCENT}40`,
                    backgroundColor: copied ? `${STATUS_SUCCESS}15` : `${ACCENT}10`,
                    color: copied ? STATUS_SUCCESS : ACCENT,
                  }}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-text-muted leading-relaxed custom-scrollbar whitespace-pre">
                {codePreview.code}
              </pre>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
