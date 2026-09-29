'use client';

import { memo } from 'react';
import { Layers, ArrowRight, Play, CheckCircle2, Circle } from 'lucide-react';
import type { SearchResult } from '@/lib/search-index';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { TYPE_META } from './constants';
import { highlightMarkers } from './helpers';
import type { SearchIntents } from './searchIntents';

// ── Result row ───────────────────────────────────────────────────────────────
// The row body is the select (navigate) target; a quick action gets a separate
// Run button — the only click that dispatches its prompt.

export const SearchResultRow = memo(function SearchResultRow({
  result,
  intents,
  active,
  index,
  onSelect,
  onRun,
  onHover,
}: {
  result: SearchResult;
  intents: SearchIntents;
  active: boolean;
  index: number;
  onSelect: (r: SearchResult) => void;
  onRun: (r: SearchResult) => void;
  onHover: (i: number) => void;
}) {
  const meta = TYPE_META[intents.kind] ?? TYPE_META.feature;
  const Icon = meta.icon;
  const plainTitle = result.title.replace(/[→←]/g, '');

  return (
    <div
      data-index={index}
      onMouseEnter={() => onHover(index)}
      className={`flex items-start transition-colors ${
        active ? 'bg-surface-hover' : 'hover:bg-surface-hover/50'
      }`}
    >
      <button
        onClick={() => onSelect(result)}
        className="flex-1 min-w-0 flex items-start gap-3 px-4 py-2.5 text-left focus-ring-inset"
      >
        {/* Type icon */}
        <div
          className="flex-shrink-0 mt-0.5 w-6 h-6 rounded flex items-center justify-center"
          style={{ backgroundColor: `${meta.color}18` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-medium text-text truncate"
              dangerouslySetInnerHTML={{ __html: highlightMarkers(result.title) }}
            />
            <span
              className="text-2xs px-1.5 py-px rounded-full flex-shrink-0"
              style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
            >
              {meta.label}
            </span>
            {intents.state === 'done' && (
              <span className="text-2xs flex items-center gap-0.5 flex-shrink-0" style={{ color: STATUS_SUCCESS }}>
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                Done
              </span>
            )}
            {intents.state === 'open' && (
              <span className="text-2xs flex items-center gap-0.5 flex-shrink-0 text-text-muted">
                <Circle className="w-3 h-3" aria-hidden="true" />
                Open
              </span>
            )}
          </div>
          {result.snippet && (
            <p
              className="text-2xs text-text-muted mt-0.5 line-clamp-2"
              dangerouslySetInnerHTML={{ __html: highlightMarkers(result.snippet) }}
            />
          )}
          {result.moduleLabel && (
            <span className="text-2xs text-text-muted mt-0.5 flex items-center gap-1">
              <Layers className="w-2.5 h-2.5" />
              {result.moduleLabel}
            </span>
          )}
        </div>

        {/* Go arrow */}
        {active && !intents.run && (
          <ArrowRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0 mt-1" />
        )}
      </button>

      {/* Run — explicit click only; Shift+Enter is the keyboard twin */}
      {intents.run && (
        <button
          onClick={() => onRun(result)}
          aria-label={`Run quick action ${plainTitle}`}
          title="Run in the module's CLI session (shift+enter)"
          className="flex-shrink-0 self-center mr-3 flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs border border-border text-text-muted hover:text-text transition-colors focus-ring"
        >
          <Play className="w-3 h-3" aria-hidden="true" />
          Run
          {active && <kbd className="ml-0.5 font-mono">⇧↵</kbd>}
        </button>
      )}
    </div>
  );
});
