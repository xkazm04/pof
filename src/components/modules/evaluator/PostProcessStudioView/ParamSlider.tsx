'use client';

import { useState } from 'react';
import { ParamCue } from '@/components/modules/evaluator/ParamCue';
import type { PPStudioParam } from '@/types/post-process-studio';
import { formatValue } from './helpers';

// ── Parameter Slider ────────────────────────────────────────────────────────

export function ParamSlider({
  param,
  color,
  explainMode,
  onChange,
}: {
  param: PPStudioParam;
  color: string;
  explainMode: boolean;
  onChange: (value: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const isModified = param.value !== param.defaultValue;
  const pct = ((param.value - param.min) / (param.max - param.min)) * 100;
  const plain = param.plain;
  // Explain mode only kicks in when the param actually carries plain metadata.
  const explain = explainMode && plain != null;
  // Accessible name: the plain-language label when explaining, else the UE param name.
  const sliderLabel = explain && plain ? plain.label : param.name;

  return (
    <div className="px-2.5 py-2 rounded-lg bg-[#0a0a1e] border border-border">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {explain && plain && (
            <ParamCue
              kind={plain.cue}
              value={pct / 100}
              accent={color}
              title={`${plain.label}: ${plain.explanation}`}
            />
          )}
          {explain && plain ? (
            <span
              className="text-2xs font-medium text-[#c0c4e0] truncate"
              title={`UE: ${param.ueProperty}`}
            >
              {plain.label}
            </span>
          ) : (
            <>
              <span className="text-2xs font-mono font-medium text-[#c0c4e0]">{param.name}</span>
              <span
                className="text-2xs px-1 py-0 rounded font-medium uppercase"
                style={{ backgroundColor: `${color}15`, color: `${color}cc` }}
              >
                {param.ueProperty}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isModified && (
            <button
              onClick={() => onChange(param.defaultValue)}
              className="text-2xs text-text-muted hover:text-text transition-colors"
            >
              Reset
            </button>
          )}
          <span className={`text-2xs font-mono ${isModified ? 'text-amber-400' : 'text-text-muted'}`}>
            {formatValue(param.value, param.step)}
          </span>
        </div>
      </div>
      <p className="text-2xs text-text-muted/60 mb-2">{explain && plain ? plain.explanation : param.description}</p>
      <div className="flex items-center gap-2">
        <span className={`text-2xs text-text-muted text-right flex-shrink-0 ${explain ? 'w-16 truncate' : 'w-10 font-mono'}`}>
          {explain && plain ? plain.lowLabel : formatValue(param.min, param.step)}
        </span>
        <div className="flex-1 relative h-4 flex items-center">
          {/* Track background */}
          <div className="absolute inset-x-0 h-1 bg-surface-deep rounded-full" />
          {/* Filled track */}
          <div
            className="absolute left-0 h-1 rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: `${color}60` }}
          />
          {/* Input — visually hidden over the custom track; focus drives the thumb's ring */}
          <input
            type="range"
            aria-label={sliderLabel}
            min={param.min}
            max={param.max}
            step={param.step}
            value={param.value}
            onChange={(e) => onChange(Number(e.target.value))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {/* Thumb indicator — mirrors the shared .focus-ring token when the input is focused */}
          <div
            data-testid="pp-param-thumb"
            className="absolute w-3 h-3 rounded-full border-2 pointer-events-none transition-all"
            style={{
              left: `calc(${pct}% - 6px)`,
              backgroundColor: 'var(--surface)',
              borderColor: color,
              boxShadow: focused
                ? '0 0 0 2px var(--background), 0 0 0 4px var(--focus-accent, #60a5fa)'
                : undefined,
            }}
          />
        </div>
        <span className={`text-2xs text-text-muted flex-shrink-0 ${explain ? 'w-16 truncate' : 'w-10 font-mono'}`}>
          {explain && plain ? plain.highLabel : formatValue(param.max, param.step)}
        </span>
      </div>
    </div>
  );
}
