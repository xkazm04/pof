'use client';

import {
  Layers as LayersIcon,
  GripVertical, ChevronDown, ChevronUp, Cpu,
} from 'lucide-react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import type { PPStudioEffect } from '@/types/post-process-studio';
import { CATEGORY_COLORS, EFFECT_ICONS } from './constants';

// ── Effect Row ──

interface EffectRowProps {
  effect: PPStudioEffect;
  gpuCost?: number;
  isExpanded: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onExpand: () => void;
}

export function EffectRow({
  effect, gpuCost, isExpanded, isFirst, isLast,
  onToggle, onMoveUp, onMoveDown, onExpand,
}: EffectRowProps) {
  const color = CATEGORY_COLORS[effect.category] ?? ACCENT_VIOLET;
  const Icon = EFFECT_ICONS[effect.id] ?? LayersIcon;
  const isActive = effect.enabled;

  return (
    <div
      className="rounded-xl border transition-all duration-500 relative group overflow-hidden"
      style={{
        borderColor: isExpanded ? `${color}40` : isActive ? `${color}20` : 'rgba(139,92,246,0.2)',
        backgroundColor: isExpanded ? `${color}08` : isActive ? `${color}04` : 'rgba(10,10,25,0.6)',
        boxShadow: isExpanded ? `0 0 20px ${color}10, inset 0 0 10px ${color}05` : 'none',
        opacity: isActive ? 1 : 0.6,
      }}
    >
      {/* Active Bar indicator */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 shadow-[0_0_10px_currentColor]" style={{ backgroundColor: color }} />
      )}

      {/* Row header */}
      <div className="flex items-center px-4 py-3 gap-4">
        {/* Grip + reorder */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={`Move ${effect.name} up`}
            className="p-0.5 rounded text-violet-500/40 hover:text-violet-300 hover:bg-violet-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-ring"
          >
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <GripVertical className="w-3.5 h-3.5 text-violet-900/60 group-hover:text-violet-500/40 transition-colors" aria-hidden="true" />
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={`Move ${effect.name} down`}
            className="p-0.5 rounded text-violet-500/40 hover:text-violet-300 hover:bg-violet-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-ring"
          >
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Toggle Node + ON/OFF cue — state must not rely on color/position alone */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={onToggle}
            role="switch"
            aria-checked={isActive}
            aria-label={`${effect.name} effect ${isActive ? 'enabled' : 'disabled'}`}
            className="w-10 h-5 rounded-full relative transition-colors border border-violet-900/30 shadow-inner focus-ring"
            style={{
              backgroundColor: isActive ? `${color}20` : 'rgba(0,0,0,0.8)',
            }}
          >
            <span
              className="absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all duration-300 shadow-[0_0_5px_currentColor]"
              style={{
                left: isActive ? '22px' : '4px',
                backgroundColor: isActive ? color : 'rgba(139,92,246,0.4)',
              }}
            />
          </button>
          <span
            aria-hidden="true"
            className="w-6 text-[9px] font-mono font-bold tracking-wider text-violet-300/80"
          >
            {isActive ? 'ON' : 'OFF'}
          </span>
        </div>

        {/* Icon */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${color}15, ${color}05)`,
            border: `1px solid ${color}30`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0 flex flex-col justify-center text-left">
          <div className="flex items-center gap-3 mb-0.5">
            <span className="text-[11px] font-bold uppercase text-violet-100 truncate">{effect.name}</span>
            <span
              className="text-[11px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border"
              style={{ backgroundColor: `${color}10`, borderColor: `${color}30`, color }}
            >
              PRIORITY: {effect.priority + 1}
            </span>
            {/* Per-row GPU cost — only meaningful while enabled */}
            {isActive && gpuCost !== undefined && (
              <span
                className="flex items-center gap-1 text-[11px] font-mono uppercase px-1.5 py-0.5 rounded border border-violet-900/40 bg-black/40 text-violet-300/80"
                title="Estimated GPU cost at 1080p"
              >
                <Cpu className="w-3 h-3" aria-hidden="true" />
                {gpuCost.toFixed(2)}ms
              </span>
            )}
          </div>
          <p className="text-xs text-violet-300/80 line-clamp-1 font-mono">{effect.description}</p>
        </div>

        {/* Expand arrow */}
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${effect.name} parameters`}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-black/40 border border-violet-900/30 hover:border-violet-500/50 transition-colors focus-ring"
        >
          <span
            aria-hidden="true"
            className="text-xs font-mono transition-transform duration-300"
            style={{ color, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            ▼
          </span>
        </button>
      </div>

      {/* Expanded params */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-2">
          <div className="ml-[88px] space-y-3 relative">
            <div className="absolute -left-6 top-0 bottom-4 w-px" style={{ backgroundColor: `${color}30` }} />

            <div className="text-[11px] font-bold uppercase px-2 py-1 rounded w-fit border shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]" style={{ color, backgroundColor: `${color}10`, borderColor: `${color}20` }}>
              CORE_CLASS: {effect.ueClass}
            </div>

            <div className="space-y-3">
              {effect.params.map((param) => (
                <div
                  key={param.name}
                  className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-black/60 border border-violet-900/40 relative group/param hover:border-violet-500/30 transition-colors shadow-inner"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-xs font-bold font-mono text-violet-200">{param.ueProperty}</span>
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded font-bold uppercase border"
                        style={{ backgroundColor: `${color}15`, color, borderColor: `${color}30` }}
                      >
                        {param.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-violet-400/80 font-mono leading-relaxed">{param.description}</p>
                  </div>

                  <div className="flex-shrink-0 text-left xl:text-right bg-violet-900/10 px-3 py-2 rounded-lg border border-violet-900/30 min-w-[140px]">
                    <div className="text-[11px] font-mono text-violet-100 font-bold">{param.value}</div>
                    <div className="text-[11px] text-violet-500/80 font-mono mt-1 uppercase border-t border-violet-900/40 pt-1">RANGE: {param.min} – {param.max}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
