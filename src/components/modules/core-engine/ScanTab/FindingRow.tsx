'use client';

import { memo } from 'react';
import {
  Loader2, ChevronDown, ChevronRight, Zap, Clock,
  CheckCircle, Square, CheckSquare,
} from 'lucide-react';
import { PASS_LABELS } from '@/lib/evaluator/module-eval-prompts';
import type { ScanFinding } from '@/types/scan';
import { SEVERITY_CONFIG, EFFORT_CONFIG, PASS_ICONS, ACCENT } from './constants';

export const FindingRow = memo(function FindingRow({
  finding,
  isExpanded,
  onToggle,
  onResolve,
  onFix,
  isRunning,
  selected,
  onSelect,
  isActivelyFixing,
}: {
  finding: ScanFinding;
  isExpanded: boolean;
  onToggle: () => void;
  onResolve: () => void;
  onFix: () => void;
  isRunning: boolean;
  selected?: boolean;
  onSelect?: () => void;
  isActivelyFixing?: boolean;
}) {
  const cfg = SEVERITY_CONFIG[finding.severity];
  const effortCfg = EFFORT_CONFIG[finding.effort];
  const PassIcon = PASS_ICONS[finding.pass];

  return (
    <div className={`border-b border-border/40 last:border-b-0 ${isActivelyFixing ? 'bg-blue-500/5' : ''}`}>
      <div className="flex items-start">
        {/* Selection checkbox */}
        {onSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className="flex-shrink-0 p-2 pt-2.5 text-text-muted hover:text-text transition-colors"
          >
            {selected
              ? <CheckSquare className="w-3.5 h-3.5" style={{ color: ACCENT }} />
              : <Square className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          onClick={onToggle}
          className="flex-1 flex items-start gap-2 px-3 py-2 text-left hover:bg-surface-hover/30 transition-colors min-w-0"
          style={onSelect ? { paddingLeft: 0 } : undefined}
        >
          {isActivelyFixing ? (
            <Loader2 className="w-3 h-3 animate-spin flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
          ) : isExpanded ? (
            <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
          ) : (
            <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-text">{finding.category}</span>
              <span className="text-2xs font-mono px-1.5 py-px rounded" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                {finding.severity}
              </span>
              <span className="text-2xs text-text-muted flex items-center gap-0.5">
                <PassIcon className="w-2.5 h-2.5" />
                {PASS_LABELS[finding.pass]}
              </span>
              {finding.file && (
                <span className="text-2xs font-mono text-text-muted truncate max-w-[200px]">
                  {finding.file}{finding.line ? `:${finding.line}` : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
              {finding.description}
            </p>
          </div>

          <span className="flex items-center gap-0.5 text-2xs px-1.5 py-px rounded flex-shrink-0" style={{ color: effortCfg.color, backgroundColor: `${effortCfg.color}18` }}>
            <Clock className="w-2.5 h-2.5" />
            {effortCfg.label}
          </span>
        </button>
      </div>

      {isExpanded && (
        <div className="px-8 pb-2.5 space-y-2" style={onSelect ? { paddingLeft: '3.25rem' } : undefined}>
          {finding.suggestedFix && (
            <div className="text-xs text-text-muted leading-relaxed">
              <span className="font-semibold text-text-muted-hover">Suggested fix: </span>
              {finding.suggestedFix}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onFix(); }}
              disabled={isRunning}
              className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded transition-colors disabled:opacity-50"
            >
              <Zap className="w-3 h-3" />
              Fix This
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onResolve(); }}
              className="flex items-center gap-1 text-xs font-medium text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 px-2.5 py-1 rounded transition-colors"
            >
              <CheckCircle className="w-3 h-3" />
              Mark Resolved
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
