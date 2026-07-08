'use client';

import { useState } from 'react';
import {
  ChevronDown, ChevronRight, AlertTriangle,
  Code, CheckCircle2, Pin, Edit3, User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { DecoratedCrashText } from '@/components/ui/CrashTerm';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import type { ImplementationPattern } from '@/types/pattern-library';
import { MODULE_COLORS, ACCENT_EMERALD_DARK, CONFIDENCE_TOKENS } from '@/lib/chart-colors';
import { MOTION } from '@/lib/constants';
import { formatDuration } from '@/lib/format';
import { CATEGORY_LABELS } from './constants';
import { PatternEditor } from './PatternEditor';

// ── Pattern Card ────────────────────────────────────────────────────────────

export function PatternCard({ pattern }: { pattern: ImplementationPattern }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const verifyPattern = usePatternLibraryStore((s) => s.verifyPattern);
  const pinPattern = usePatternLibraryStore((s) => s.pinPattern);

  const conf = CONFIDENCE_TOKENS[pattern.confidence];
  const successPercent = Math.round(pattern.successRate * 100);
  const successColor = successPercent >= 70 ? ACCENT_EMERALD_DARK : successPercent >= 50 ? MODULE_COLORS.content : MODULE_COLORS.evaluator;

  return (
    <SurfaceCard className="overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover/50 transition-colors"
      >
        {/* Success rate ring */}
        <ProgressRing value={successPercent} size={40} strokeWidth={3} color={successColor} />

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
            }
            {pattern.pinned && (
              <Pin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" aria-label="Pinned" />
            )}
            {pattern.verified && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" aria-label="Verified" />
            )}
            <span className="text-sm font-medium text-text truncate">{pattern.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 ml-5">
            <span className="text-2xs text-text-muted">{pattern.moduleId}</span>
            <span className="text-2xs text-text-muted/50">|</span>
            <span
              className="px-1.5 py-0.5 rounded text-2xs font-medium"
              style={{ backgroundColor: conf.bg, color: conf.color }}
            >
              {conf.label}
            </span>
            <span className="text-2xs text-text-muted/50">|</span>
            <Badge>{CATEGORY_LABELS[pattern.category]}</Badge>
            <span className="text-2xs text-text-muted/50">|</span>
            <SourceBadge source={pattern.source} />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-center">
            <div className="text-xs font-medium text-text">{pattern.sessionCount}</div>
            <div className="text-2xs text-text-muted">sessions</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-medium text-text">{pattern.projectCount}</div>
            <div className="text-2xs text-text-muted">projects</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-medium text-text">{formatDuration(pattern.avgDurationMs)}</div>
            <div className="text-2xs text-text-muted">avg time</div>
          </div>
        </div>
      </button>

      {/* Expanded details */}
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
              {/* Approach */}
              <div>
                <div className="text-2xs text-text-muted font-medium mb-1">Approach</div>
                <span className="px-2 py-0.5 bg-blue-400/10 border border-blue-400/15 rounded text-2xs text-blue-400">
                  {pattern.approach}
                </span>
              </div>

              {/* Description */}
              <div>
                <div className="text-2xs text-text-muted font-medium mb-1">Description</div>
                <p className="text-xs text-text/80 leading-relaxed whitespace-pre-wrap">
                  <DecoratedCrashText text={pattern.description} />
                </p>
              </div>

              {/* Tags */}
              {pattern.tags.length > 0 && (
                <div>
                  <div className="text-2xs text-text-muted font-medium mb-1">Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {pattern.tags.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 bg-surface-hover border border-border rounded text-2xs text-text-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Involved classes */}
              {pattern.involvedClasses.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-2xs text-text-muted font-medium mb-1">
                    <Code className="w-3 h-3" />
                    Key Classes
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pattern.involvedClasses.map((cls) => (
                      <span key={cls} className="px-1.5 py-0.5 bg-cyan-400/5 border border-cyan-400/15 rounded text-2xs text-cyan-400 font-mono">
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pitfalls */}
              {pattern.pitfalls.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-2xs text-text-muted font-medium mb-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Common Pitfalls
                  </div>
                  <div className="space-y-1">
                    {pattern.pitfalls.map((pitfall, i) => (
                      <div key={i} className="flex items-start gap-2 px-2 py-1.5 bg-amber-400/5 border border-amber-400/10 rounded">
                        <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span className="text-2xs text-amber-400/80"><DecoratedCrashText text={pitfall} /></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Example prompt */}
              {pattern.examplePrompt && (
                <div>
                  <div className="text-2xs text-text-muted font-medium mb-1">Example Prompt</div>
                  <pre className="px-3 py-2 bg-surface-deep border border-border rounded text-2xs text-text/80 font-mono overflow-x-auto whitespace-pre-wrap">
                    {pattern.examplePrompt}
                  </pre>
                </div>
              )}

              {/* Timeline */}
              <div className="flex items-center gap-4 text-2xs text-text-muted pt-1 border-t border-border/50">
                <span>First seen: {new Date(pattern.firstSeenAt).toLocaleDateString()}</span>
                <span>Last success: {new Date(pattern.lastSuccessAt).toLocaleDateString()}</span>
                {pattern.verifiedBy && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Verified by {pattern.verifiedBy}
                  </span>
                )}
              </div>

              {/* Curation controls */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => verifyPattern(pattern.id, !pattern.verified)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-colors ${
                    pattern.verified
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                      : 'bg-surface-hover border border-border text-text-muted hover:text-text hover:border-emerald-500/30'
                  }`}
                  aria-pressed={pattern.verified}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {pattern.verified ? 'Verified' : 'Mark Verified'}
                </button>
                <button
                  type="button"
                  onClick={() => pinPattern(pattern.id, !pattern.pinned)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-colors ${
                    pattern.pinned
                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
                      : 'bg-surface-hover border border-border text-text-muted hover:text-text hover:border-amber-500/30'
                  }`}
                  aria-pressed={pattern.pinned}
                >
                  <Pin className="w-3 h-3" />
                  {pattern.pinned ? 'Pinned' : 'Pin as Canonical'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium bg-surface-hover border border-border text-text-muted hover:text-text hover:border-blue-500/30 transition-colors"
                >
                  <Edit3 className="w-3 h-3" />
                  {editing ? 'Cancel Edit' : 'Edit'}
                </button>
              </div>

              {editing && (
                <PatternEditor pattern={pattern} onDone={() => setEditing(false)} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

// ── Source Badge ────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: ImplementationPattern['source'] }) {
  if (source === 'authored') {
    return (
      <span className="px-1.5 py-0.5 rounded text-2xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
        Authored
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 rounded text-2xs font-medium bg-blue-400/10 text-blue-400 border border-blue-400/20">
      Mined
    </span>
  );
}
