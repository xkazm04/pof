import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Filter } from 'lucide-react';
import type {
  AntiPatternHit,
  AntiPatternCategory,
  Severity,
} from '@/types/codebase-archeologist';
import { severityAccentCard, STATUS_SUCCESS } from '@/lib/chart-colors';
import { CATEGORY_LABELS, SEVERITY_CONFIG } from './constants';
import { SeverityBadge } from './SeverityBadge';

export function AntiPatternsTab({
  hits, totalCount, categoryFilter, severityFilter,
  onCategoryChange, onSeverityChange,
}: {
  hits: AntiPatternHit[];
  totalCount: number;
  categoryFilter: AntiPatternCategory | 'all';
  severityFilter: Severity | 'all';
  onCategoryChange: (v: AntiPatternCategory | 'all') => void;
  onSeverityChange: (v: Severity | 'all') => void;
}) {
  return (
    <div className="space-y-2">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-text-muted" />
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value as AntiPatternCategory | 'all')}
            className="bg-background border border-border-bright rounded px-2 py-0.5 text-xs text-text outline-none"
          >
            <option value="all">All categories</option>
            {(Object.keys(CATEGORY_LABELS) as AntiPatternCategory[]).map(c => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <select
          value={severityFilter}
          onChange={(e) => onSeverityChange(e.target.value as Severity | 'all')}
          className="bg-background border border-border-bright rounded px-2 py-0.5 text-xs text-text outline-none"
        >
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <span className="text-2xs text-text-muted ml-auto">
          {hits.length}{hits.length !== totalCount ? ` of ${totalCount}` : ''} issues
        </span>
      </div>

      {/* Hits list */}
      <div className="rounded border border-border bg-background/60 overflow-hidden divide-y divide-border/40">
        {hits.length === 0 ? (
          <div className="text-center text-text-muted text-xs py-6">
            {totalCount === 0 ? 'No anti-patterns detected.' : 'No matches for current filters.'}
          </div>
        ) : (
          hits.slice(0, 100).map((h) => <AntiPatternRow key={h.id} hit={h} />)
        )}
      </div>
    </div>
  );
}

function AntiPatternRow({ hit }: { hit: AntiPatternHit }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[hit.severity];

  return (
    <div className="border-l-[3px]" style={severityAccentCard(cfg)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-surface-hover/30 transition-colors text-xs"
      >
        {expanded
          ? <ChevronDown className="w-2.5 h-2.5 text-text-muted flex-shrink-0" />
          : <ChevronRight className="w-2.5 h-2.5 text-text-muted flex-shrink-0" />
        }
        <SeverityBadge severity={hit.severity} />
        <span className="text-text truncate flex-1">{hit.message}</span>
        <span className="text-2xs text-text-muted font-mono flex-shrink-0">{hit.file}{hit.line ? `:${hit.line}` : ''}</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            <div className="px-8 pb-2 space-y-1 text-xs">
              <div>
                <span className="text-text-muted">Category: </span>
                <span className="text-text">{CATEGORY_LABELS[hit.category]}</span>
              </div>
              <div>
                <span className="text-text-muted">File: </span>
                <span className="text-text font-mono">{hit.file}{hit.line ? `:${hit.line}` : ''}</span>
              </div>
              <div>
                <span className="text-text-muted">Suggestion: </span>
                <span style={{ color: STATUS_SUCCESS }}>{hit.suggestion}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
