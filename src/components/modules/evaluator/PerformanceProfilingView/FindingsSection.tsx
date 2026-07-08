'use client';

import { useState, useCallback } from 'react';
import {
  AlertTriangle, ChevronDown, ChevronRight, Zap, Copy, TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { PerformanceFinding } from '@/types/performance-profiling';
import { UI_TIMEOUTS, MOTION } from '@/lib/constants';
import { PRIORITY_STYLE } from './constants';

// ── Findings Section ────────────────────────────────────────────────────────

export function FindingsSection({ findings }: { findings: PerformanceFinding[] }) {
  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-medium text-text">AI Triage Findings</h2>
        <Badge variant={findings.some((f) => f.priority === 'critical') ? 'error' : 'warning'}>
          {findings.length} issues · ~{findings.reduce((s, f) => s + f.estimatedSavingsMs, 0).toFixed(1)}ms savings
        </Badge>
      </div>

      <div className="space-y-2">
        {findings.map((finding) => (
          <FindingCard key={finding.id} finding={finding} />
        ))}
      </div>
    </SurfaceCard>
  );
}

function FindingCard({ finding }: { finding: PerformanceFinding }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const style = PRIORITY_STYLE[finding.priority];

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(finding.fixPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [finding.fixPrompt]);

  return (
    <div className={`rounded-lg border ${style.bg} ${style.border} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />}
        <span className={`px-1.5 py-0.5 rounded text-2xs font-medium ${style.bg} ${style.text} border ${style.border}`}>
          {finding.priority}
        </span>
        <span className="text-xs font-medium text-text flex-1 truncate">{finding.title}</span>
        <span className="text-2xs text-emerald-400 font-medium flex-shrink-0">
          ~{finding.estimatedSavingsMs.toFixed(1)}ms
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.fast }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              <p className="text-2xs text-text-muted/80 leading-relaxed">{finding.description}</p>

              {finding.involvedClasses.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {finding.involvedClasses.map((cls) => (
                    <span key={cls} className="px-1.5 py-0.5 bg-cyan-400/5 border border-cyan-400/15 rounded text-2xs text-cyan-400 font-mono">
                      {cls}
                    </span>
                  ))}
                </div>
              )}

              {/* Fix prompt */}
              <div className="relative">
                <div className="text-2xs text-text-muted font-medium mb-1 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  Fix Prompt (for Claude CLI)
                </div>
                <pre className="px-3 py-2 bg-surface-deep border border-border rounded text-2xs text-text/80 font-mono overflow-x-auto whitespace-pre-wrap">
                  {finding.fixPrompt}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute top-7 right-2 flex items-center gap-1 px-2 py-1 bg-surface border border-border rounded text-2xs text-text-muted hover:text-text transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Checklist label */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald-400/5 border border-emerald-400/15 rounded">
                <TrendingUp className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="text-2xs text-emerald-400">
                  Checklist: {finding.checklistLabel}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
