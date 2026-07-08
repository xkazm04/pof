'use client';

import { memo } from 'react';
import { Layers, ArrowRight } from 'lucide-react';
import type { SearchResult } from '@/lib/search-index';
import { TYPE_META } from './constants';
import { highlightMarkers } from './helpers';

// ── Result row ───────────────────────────────────────────────────────────────

export const SearchResultRow = memo(function SearchResultRow({
  result,
  active,
  index,
  onSelect,
  onHover,
}: {
  result: SearchResult;
  active: boolean;
  index: number;
  onSelect: (r: SearchResult) => void;
  onHover: (i: number) => void;
}) {
  const meta = TYPE_META[result.type] ?? TYPE_META.feature;
  const Icon = meta.icon;

  return (
    <button
      data-index={index}
      onClick={() => onSelect(result)}
      onMouseEnter={() => onHover(index)}
      className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors focus-ring-inset ${
        active ? 'bg-surface-hover' : 'hover:bg-surface-hover/50'
      }`}
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
      {active && (
        <ArrowRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0 mt-1" />
      )}
    </button>
  );
});
