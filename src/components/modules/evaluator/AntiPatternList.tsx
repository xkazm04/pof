'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Tag,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { SEVERITY_TOKENS, withOpacity, OPACITY_8 } from '@/lib/chart-colors';
import { MOTION } from '@/lib/constants';
import type { AntiPattern, AntiPatternSeverity } from '@/types/pattern-library';

const SEVERITY_LABEL: Record<AntiPatternSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
};

const SEVERITY_ORDER: Record<AntiPatternSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

interface Props {
  /** Filter the list down to a single module. */
  moduleId?: string | null;
}

export function AntiPatternList({ moduleId }: Props) {
  const antiPatterns = usePatternLibraryStore((s) => s.antiPatterns);
  const isExtractingAnti = usePatternLibraryStore((s) => s.isExtractingAnti);
  const error = usePatternLibraryStore((s) => s.error);
  const fetchAntiPatterns = usePatternLibraryStore((s) => s.fetchAntiPatterns);
  const extractAntiPatterns = usePatternLibraryStore((s) => s.extractAntiPatterns);

  const [extractResult, setExtractResult] = useState<{ extracted: number; updated: number } | null>(null);

  useEffect(() => {
    fetchAntiPatterns();
  }, [fetchAntiPatterns]);

  const filtered = useMemo(() => {
    const base = moduleId ? antiPatterns.filter((ap) => ap.moduleId === moduleId) : antiPatterns;
    return [...base].sort((a, b) => {
      const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sev !== 0) return sev;
      return b.failureRate - a.failureRate;
    });
  }, [antiPatterns, moduleId]);

  const handleExtract = async () => {
    const result = await extractAntiPatterns();
    setExtractResult(result);
    setTimeout(() => setExtractResult(null), 5000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" style={{ color: SEVERITY_TOKENS.critical.color }} />
          <h3 className="text-sm font-semibold text-text">Anti-Patterns</h3>
          <span className="text-2xs text-text-muted">
            {filtered.length} approach{filtered.length === 1 ? '' : 'es'} to avoid
          </span>
        </div>
        <button
          type="button"
          onClick={handleExtract}
          disabled={isExtractingAnti}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-text-muted hover:text-text hover:border-border-bright transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isExtractingAnti ? 'animate-spin' : ''}`} />
          {isExtractingAnti ? 'Mining failures…' : 'Mine from Failed Sessions'}
        </button>
      </div>

      <AnimatePresence>
        {extractResult && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <SurfaceCard className="px-3 py-2">
              <p className="text-xs text-text-muted">
                Mined <strong>{extractResult.extracted}</strong> new anti-patterns, updated{' '}
                <strong>{extractResult.updated}</strong> existing
              </p>
            </SurfaceCard>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <SurfaceCard className="px-3 py-2 border-status-red-strong">
          <p className="text-xs text-red-400">{error}</p>
        </SurfaceCard>
      )}

      {filtered.length === 0 && !isExtractingAnti && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Sparkles className="w-5 h-5 text-text-muted mb-2" />
          <p className="text-xs text-text-muted max-w-xs leading-relaxed">
            No anti-patterns mined yet. Run mining after a few failed sessions to surface approaches
            that consistently fail in this codebase.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((ap) => (
          <AntiPatternCard key={ap.id} ap={ap} />
        ))}
      </div>
    </div>
  );
}

function AntiPatternCard({ ap }: { ap: AntiPattern }) {
  const [expanded, setExpanded] = useState(false);
  const token = SEVERITY_TOKENS[ap.severity];
  const failurePct = Math.round(ap.failureRate * 100);

  return (
    <SurfaceCard className="overflow-hidden" style={{ borderColor: token.border }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover/50 transition-colors"
      >
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
          style={{ backgroundColor: withOpacity(token.color, OPACITY_8) }}
        >
          <ShieldAlert className="w-4 h-4" style={{ color: token.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
            }
            <span
              className="text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ color: token.color, backgroundColor: withOpacity(token.color, OPACITY_8) }}
            >
              {SEVERITY_LABEL[ap.severity]}
            </span>
            <span className="text-sm font-medium text-text truncate">{ap.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 ml-5">
            <span className="text-2xs text-text-muted">{ap.moduleId}</span>
            <span className="text-2xs text-text-muted/50">|</span>
            <Badge>{ap.approach}</Badge>
            <span className="text-2xs text-text-muted/50">|</span>
            <span className="text-2xs text-text-muted">{ap.sessionCount} failed sessions</span>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-base font-semibold" style={{ color: token.color }}>
            {failurePct}%
          </div>
          <div className="text-2xs text-text-muted">failure rate</div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.base }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 py-3 space-y-3">
              <div>
                <div className="text-2xs text-text-muted font-medium mb-1">Why this fails</div>
                <p className="text-xs text-text/80 leading-relaxed whitespace-pre-wrap">
                  {ap.description}
                </p>
              </div>

              {ap.triggerKeywords.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-2xs text-text-muted font-medium mb-1">
                    <Tag className="w-3 h-3" />
                    Trigger keywords (matched against prompts)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ap.triggerKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="px-1.5 py-0.5 rounded text-2xs font-mono"
                        style={{
                          color: token.color,
                          backgroundColor: withOpacity(token.color, OPACITY_8),
                        }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {ap.alternative && (
                <div className="px-3 py-2 rounded border border-border bg-surface-deep">
                  <div className="flex items-center gap-2 text-2xs text-text-muted font-medium mb-1">
                    <ArrowRight className="w-3 h-3 text-emerald-400" />
                    Recommended alternative
                  </div>
                  <div className="text-xs text-text font-medium">{ap.alternative.title}</div>
                  <div className="text-2xs text-text-muted mt-1">
                    Approach: <span className="text-emerald-400">{ap.alternative.approach}</span>
                    {' · '}
                    {Math.round(ap.alternative.successRate * 100)}% success rate
                  </div>
                  {ap.alternative.examplePrompt && (
                    <pre className="mt-2 px-2 py-1.5 bg-surface border border-border rounded text-2xs text-text/80 font-mono overflow-x-auto whitespace-pre-wrap">
                      {ap.alternative.examplePrompt}
                    </pre>
                  )}
                </div>
              )}

              {ap.examplePrompt && (
                <div>
                  <div className="flex items-center gap-1 text-2xs text-text-muted font-medium mb-1">
                    <AlertTriangle className="w-3 h-3" style={{ color: token.color }} />
                    Example failed prompt
                  </div>
                  <pre className="px-3 py-2 bg-surface-deep border border-border rounded text-2xs text-text/80 font-mono overflow-x-auto whitespace-pre-wrap">
                    {ap.examplePrompt}
                  </pre>
                </div>
              )}

              <div className="flex items-center gap-4 text-2xs text-text-muted pt-1 border-t border-border/50">
                <span>First seen: {new Date(ap.firstSeenAt).toLocaleDateString()}</span>
                <span>Last failed: {new Date(ap.lastFailedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}
