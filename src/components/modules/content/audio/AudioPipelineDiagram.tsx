'use client';

import { useCallback, useMemo } from 'react';
import { Music, Lock, Check, ChevronUp, Volume2, Radio, Layers, Loader2, Send, AlertTriangle } from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import { getModuleChecklist } from '@/lib/module-registry';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR, withOpacity, OPACITY_10, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import type { LucideIcon } from 'lucide-react';

const ACCENT = MODULE_COLORS.content;

interface PipelineLayer {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  prompt: string;
  prerequisites: string[];
  /** True when `id` resolves to no registry checklist item — surfaced, not hidden. */
  missing: boolean;
}

/**
 * The shape of the diagram: which REAL `audio` checklist items it draws and how
 * they stack. Labels, descriptions and — critically — prompts come from
 * `module-registry` (`aud-1`…`aud-5`), never from a parallel copy here.
 *
 * These ids used to be `au-1`/`au-2`/`au-3`, which are the audio module's
 * QUICK-ACTION ids and belong to no checklist item: every layer this diagram
 * completed wrote a progress key nothing reads, so the module's checklist
 * percentage, the feature matrix and the module views could never count it.
 * They mirror `aud-1..aud-3` one-for-one, so `ORPHAN_KEY_MIGRATIONS` moves any
 * already-stored `au-*` completion onto the real id rather than resetting it.
 */
interface PipelineLayerSpec {
  id: string;
  subtitle: string;
  icon: LucideIcon;
  prerequisites: string[];
}

// Rendered top-down (most advanced first); the build order runs bottom-up.
const HIERARCHY: PipelineLayerSpec[] = [
  { id: 'aud-3', subtitle: 'Adaptive', icon: Layers, prerequisites: ['aud-1', 'aud-2'] },
  { id: 'aud-2', subtitle: 'Spatial', icon: Radio, prerequisites: ['aud-1'] },
  { id: 'aud-1', subtitle: 'Foundation', icon: Volume2, prerequisites: [] },
];

/**
 * Resolve a layer against the registry. A spec whose id no longer exists renders
 * as a loud, undispatchable drift marker rather than vanishing from the diagram —
 * a silently-dropped node is exactly how the `au-*` divergence survived.
 */
function layerFrom(spec: PipelineLayerSpec): PipelineLayer {
  const item = getModuleChecklist('audio').find((i) => i.id === spec.id);
  return {
    ...spec,
    label: item?.label ?? spec.id,
    description:
      item?.description ??
      `No "${spec.id}" item exists in the audio checklist — this diagram and the registry have drifted.`,
    prompt: item?.prompt ?? '',
    missing: !item,
  };
}

const LAYERS: PipelineLayer[] = HIERARCHY.map(layerFrom);

/** Label lookup so prerequisite copy can never drift from the layer list above. */
const LAYER_LABELS: Record<string, string> = Object.fromEntries(LAYERS.map((l) => [l.id, l.label]));

interface AudioPipelineDiagramProps {
  onRunPrompt: (itemId: string, prompt: string) => void;
  isRunning: boolean;
  activeItemId: string | null;
}

const EMPTY_PROGRESS: Record<string, boolean> = {};

export function AudioPipelineDiagram({ onRunPrompt, isRunning, activeItemId }: AudioPipelineDiagramProps) {
  const progress = useModuleStore((s) => s.checklistProgress['audio'] ?? EMPTY_PROGRESS);

  const layerStates = useMemo(() => {
    return LAYERS.map((layer) => {
      const completed = !!progress[layer.id];
      const prerequisitesMet = layer.prerequisites.every((pid) => !!progress[pid]);
      // A drifted layer has no registry prompt behind it, so it is never runnable.
      const locked = layer.missing || (!prerequisitesMet && !completed);
      const isActive = activeItemId === layer.id;
      const isFoundation = layer.prerequisites.length === 0;
      const prereqLabel = layer.prerequisites.map((pid) => LAYER_LABELS[pid] ?? pid).join(' + ');
      return { ...layer, completed, locked, isActive, isFoundation, prereqLabel };
    });
  }, [progress, activeItemId]);

  const handleClick = useCallback(
    (layer: PipelineLayer, locked: boolean) => {
      // An unresolved layer has no registry prompt — dispatching an empty task
      // would look like a run and produce nothing.
      if (locked || isRunning || !layer.prompt) return;
      onRunPrompt(layer.id, layer.prompt);
    },
    [onRunPrompt, isRunning],
  );

  const completedCount = layerStates.filter((l) => l.completed).length;
  const allComplete = completedCount === layerStates.length;
  // Build order runs bottom-up (foundation first); the list renders top-down.
  const nextBuildable = [...layerStates].reverse().find((l) => !l.completed && !l.locked);
  const summary = allComplete
    ? 'Audio stack complete — every layer is in place'
    : nextBuildable
      ? `Next up: ${nextBuildable.label}`
      : 'Complete a prerequisite layer to unlock the rest';

  return (
    <SurfaceCard className="flex flex-col items-center gap-0 w-full max-w-md mx-auto select-none p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 self-start w-full border-b border-border pb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: withOpacity(ACCENT, OPACITY_10), border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}` }}
        >
          <Music className="w-5 h-5" style={{ color: ACCENT }} aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text">Audio Subsystem Architecture</h3>
          <p className="text-xs text-text-muted mt-1">
            {completedCount}/{layerStates.length} layers built — {summary}
          </p>
        </div>
      </div>

      {/* Pipeline layers — top to bottom (Dynamic Music → Ambient → Sound Manager) */}
      <div className="w-full" role="group" aria-label="Audio layers, most advanced first">
        {layerStates.map((layer, idx) => {
          const Icon = layer.icon;
          const showArrow = idx < layerStates.length - 1;
          const nextLayer = idx < layerStates.length - 1 ? layerStates[idx + 1] : null;
          const statusColor = layer.completed ? STATUS_SUCCESS : ACCENT;
          // Clicking only does something when nothing is running and prerequisites are met.
          const actionable = !layer.locked && !isRunning;
          const statusText = layer.missing
            ? `REGISTRY_DRIFT: ${layer.id} — not runnable`
            : layer.locked
            ? `Locked — requires ${layer.prereqLabel}`
            : layer.isActive
              ? 'Generating now'
              : isRunning
                ? 'Unavailable while another layer is generating'
                : layer.completed
                  ? 'Complete — activate to run again'
                  : 'Activate to run this prompt';
          // `aria-disabled` (not `disabled`) keeps the reason readable and the card
          // focusable mid-run, so the affordance is styled explicitly here.
          const stateClass = layer.locked
            ? 'border-border bg-surface-deep opacity-60 cursor-not-allowed'
            : actionable
              ? 'cursor-pointer hover:bg-surface-hover'
              : layer.isActive
                ? 'cursor-wait'
                : 'opacity-60 cursor-not-allowed';

          return (
            <div key={layer.id} className="w-full flex flex-col items-center">
              {/* Layer Card */}
              <button
                type="button"
                onClick={() => handleClick(layer, layer.locked)}
                aria-disabled={!actionable}
                aria-busy={layer.isActive}
                className={`focus-ring relative w-full rounded-2xl border transition-all duration-300 text-left group overflow-hidden ${stateClass}`}
                style={
                  layer.locked
                    ? undefined
                    : {
                        borderColor: withOpacity(statusColor, OPACITY_30),
                        backgroundColor: withOpacity(statusColor, OPACITY_10),
                      }
                }
              >
                <div className="flex items-start gap-4 px-5 py-4">
                  {/* Icon column */}
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                    style={
                      layer.locked
                        ? { backgroundColor: 'var(--surface-deep)', border: '1px solid var(--border)' }
                        : { backgroundColor: withOpacity(statusColor, OPACITY_10), border: `1px solid ${withOpacity(statusColor, OPACITY_30)}` }
                    }
                  >
                    {layer.completed ? (
                      <Check className="w-6 h-6" style={{ color: STATUS_SUCCESS }} aria-hidden="true" />
                    ) : layer.locked ? (
                      <Lock className="w-5 h-5 text-text-muted" aria-hidden="true" />
                    ) : (
                      <Icon className="w-6 h-6" style={{ color: ACCENT }} aria-hidden="true" />
                    )}
                  </div>

                  {/* Text column */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: layer.locked ? 'var(--text-muted)' : statusColor }}
                      >
                        {layer.label}
                      </span>
                      <span
                        className="text-2xs font-medium px-2 py-0.5 rounded border"
                        style={
                          layer.locked
                            ? { color: 'var(--text-muted)', borderColor: 'var(--border)' }
                            : { color: statusColor, backgroundColor: withOpacity(statusColor, OPACITY_10), borderColor: withOpacity(statusColor, OPACITY_20) }
                        }
                      >
                        {layer.subtitle}
                      </span>
                      <span className="sr-only">— {statusText}</span>
                    </div>

                    <p className="text-xs leading-relaxed mt-1 text-text-muted">
                      {layer.description}
                    </p>

                    {/* Registry drift — loud, and never silently dropped */}
                    {layer.missing && (
                      <div
                        className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border w-fit"
                        style={{ backgroundColor: withOpacity(STATUS_ERROR, OPACITY_10), borderColor: withOpacity(STATUS_ERROR, OPACITY_30) }}
                      >
                        <AlertTriangle className="w-3 h-3" style={{ color: STATUS_ERROR }} aria-hidden="true" />
                        <span className="text-2xs font-medium" style={{ color: STATUS_ERROR }}>
                          REGISTRY_DRIFT: {layer.id}
                        </span>
                      </div>
                    )}

                    {/* Locked prerequisite hint */}
                    {layer.locked && !layer.missing && (
                      <div className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-deep border border-border w-fit">
                        <Lock className="w-3 h-3 text-text-muted" aria-hidden="true" />
                        <span className="text-2xs font-medium text-text-muted">
                          Build {layer.prereqLabel} first
                        </span>
                      </div>
                    )}

                    {/* Active indicator */}
                    {layer.isActive && (
                      <div
                        role="status"
                        className="flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg w-fit border"
                        style={{ backgroundColor: withOpacity(ACCENT, OPACITY_10), borderColor: withOpacity(ACCENT, OPACITY_20) }}
                      >
                        <Loader2 className="w-3 h-3 animate-spin" style={{ color: ACCENT }} aria-hidden="true" />
                        <span className="text-2xs font-medium" style={{ color: ACCENT }}>
                          Generating {layer.label}…
                        </span>
                      </div>
                    )}

                    {/* Start here nudge on foundation */}
                    {layer.isFoundation && !layer.completed && actionable && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="flex h-2 w-2 relative" aria-hidden="true">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: ACCENT }}></span>
                          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: ACCENT }}></span>
                        </span>
                        <span className="text-2xs font-medium" style={{ color: ACCENT }}>
                          Start here
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right status rail — always labelled (glyph + word, never colour alone) */}
                  <div className="flex-shrink-0 self-center pl-3 border-l border-border ml-2 flex items-center" aria-hidden="true">
                    {layer.completed ? (
                      <div className="flex flex-col items-center gap-1">
                        <Check className="w-4 h-4" style={{ color: STATUS_SUCCESS }} />
                        <span className="text-2xs font-medium" style={{ color: STATUS_SUCCESS }}>Done</span>
                      </div>
                    ) : layer.locked ? (
                      <div className="flex flex-col items-center gap-1 text-text-muted">
                        <Lock className="w-4 h-4" />
                        <span className="text-2xs font-medium">Locked</span>
                      </div>
                    ) : layer.isActive ? (
                      <div className="flex flex-col items-center gap-1" style={{ color: ACCENT }}>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-2xs font-medium">Running</span>
                      </div>
                    ) : (
                      <div
                        className={`flex flex-col items-center gap-1 transition-opacity ${
                          actionable ? 'opacity-50 group-hover:opacity-100' : 'opacity-40'
                        }`}
                      >
                        <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" style={{ color: ACCENT }} />
                        <span className="text-2xs font-medium" style={{ color: ACCENT }}>Run</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Upward arrow connector */}
              {showArrow && (
                <div className="flex flex-col items-center py-2 relative" aria-hidden="true">
                  <div className="absolute top-0 bottom-0 w-px bg-border" />
                  <ChevronUp
                    className="w-5 h-5 relative z-10 bg-surface"
                    style={{ color: nextLayer?.completed ? STATUS_SUCCESS : nextLayer && !nextLayer.locked ? ACCENT : 'var(--text-muted)' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
