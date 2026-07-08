'use client';

import { ChevronDown, ChevronUp, GripVertical, Cpu, Layers, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PPStudioEffect } from '@/types/post-process-studio';
import { MOTION } from '@/lib/constants';
import { CATEGORY_COLORS, EFFECT_ICONS } from './constants';
import { ParamSlider } from './ParamSlider';

// ── Effect Card ─────────────────────────────────────────────────────────────

export function EffectCard({
  effect,
  isFirst,
  isLast,
  isExpanded,
  explainMode,
  onToggle,
  onMoveUp,
  onMoveDown,
  onExpand,
  onParamChange,
  gpuCost,
}: {
  effect: PPStudioEffect;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  explainMode: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onExpand: () => void;
  onParamChange: (paramName: string, value: number) => void;
  gpuCost?: number;
}) {
  const catColor = CATEGORY_COLORS[effect.category];
  const Icon = EFFECT_ICONS[effect.id] ?? Layers;

  return (
    <div
      className="rounded-xl border transition-all duration-base"
      style={{
        borderColor: isExpanded ? `${catColor}40` : effect.enabled ? `${catColor}20` : 'var(--border)',
        backgroundColor: isExpanded ? `${catColor}06` : effect.enabled ? `${catColor}04` : 'var(--surface-deep)',
        opacity: effect.enabled ? 1 : 0.55,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Reorder */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={`Move ${effect.name} up`}
            className="p-0 text-text-muted hover:text-text transition-colors disabled:opacity-30 focus-ring"
          >
            <ChevronUp className="w-3 h-3" aria-hidden="true" />
          </button>
          <GripVertical className="w-3 h-3 text-border-bright" aria-hidden="true" />
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={`Move ${effect.name} down`}
            className="p-0 text-text-muted hover:text-text transition-colors disabled:opacity-30 focus-ring"
          >
            <ChevronDown className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>

        {/* Toggle switch + ON/OFF cue — state must not rely on color/position alone */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onToggle}
            role="switch"
            aria-checked={effect.enabled}
            aria-label={`${effect.name} effect ${effect.enabled ? 'enabled' : 'disabled'}`}
            className="w-8 h-4 rounded-full relative transition-colors focus-ring"
            style={{ backgroundColor: effect.enabled ? `${catColor}40` : 'var(--border)' }}
          >
            <span
              className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
              style={{
                left: effect.enabled ? '17px' : '2px',
                backgroundColor: effect.enabled ? catColor : 'var(--text-muted)',
              }}
            />
          </button>
          <span aria-hidden="true" className="w-6 text-[9px] font-mono font-bold tracking-wider text-text-muted">
            {effect.enabled ? 'ON' : 'OFF'}
          </span>
        </div>

        {/* Icon */}
        <div
          className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${catColor}18, ${catColor}08)`,
            border: `1px solid ${catColor}20`,
          }}
        >
          <Icon className="w-3 h-3" style={{ color: catColor }} />
        </div>

        {/* Name + description (its own text is the accessible name; the chevron carries the explicit Expand/Collapse label) */}
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={isExpanded}
          className="flex-1 min-w-0 text-left group focus-ring rounded"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-text">{effect.name}</span>
            <span className="text-2xs text-text-muted font-mono">{effect.priority + 1}</span>
            <span
              className="text-2xs px-1 py-0 rounded font-medium"
              style={{ backgroundColor: `${catColor}15`, color: `${catColor}cc` }}
            >
              {effect.category}
            </span>
          </div>
          <p className="text-2xs text-text-muted line-clamp-1">{effect.description}</p>
        </button>

        {/* GPU cost chip */}
        {effect.enabled && gpuCost !== undefined && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-deep text-2xs text-text-muted flex-shrink-0">
            <Cpu className="w-2.5 h-2.5" />
            {gpuCost.toFixed(2)}ms
          </div>
        )}

        {/* Expand arrow */}
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${effect.name} parameters`}
          className="flex-shrink-0 p-0.5 rounded focus-ring"
        >
          {isExpanded
            ? <ChevronUp className="w-3 h-3 text-text-muted" aria-hidden="true" />
            : <ChevronDown className="w-3 h-3 text-text-muted" aria-hidden="true" />
          }
        </button>
      </div>

      {/* Expanded params */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.base }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0">
              <div className="ml-[72px] space-y-2.5">
                {explainMode ? (
                  <div className="flex items-center gap-1.5 text-2xs text-emerald-400/80 mb-1">
                    <BookOpen className="w-3 h-3" />
                    <span>Plain-language mode — hover a name to see its UE term</span>
                  </div>
                ) : (
                  <div className="text-2xs font-semibold text-text-muted uppercase mb-1">
                    UE: {effect.ueClass}
                  </div>
                )}
                {effect.params.map((param) => (
                  <ParamSlider
                    key={param.name}
                    param={param}
                    color={catColor}
                    explainMode={explainMode}
                    onChange={(val) => onParamChange(param.name, val)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
