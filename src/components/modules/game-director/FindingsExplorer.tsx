'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertOctagon, AlertTriangle, Info, CheckCircle2,
  Filter, Search, Loader2, Target,
} from 'lucide-react';
import type { PlaytestSession, PlaytestFinding, FindingSeverity, FindingCategory } from '@/types/game-director';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

const SEVERITY_STYLES: Record<FindingSeverity, { icon: typeof AlertOctagon; color: string; bg: string; border: string }> = {
  critical: { icon: AlertOctagon, color: '#f87171', bg: '#f8717108', border: '#f8717120' },
  high: { icon: AlertTriangle, color: '#fb923c', bg: '#fb923c08', border: '#fb923c20' },
  medium: { icon: Info, color: '#fbbf24', bg: '#fbbf2408', border: '#fbbf2420' },
  low: { icon: Info, color: '#60a5fa', bg: '#60a5fa08', border: '#60a5fa20' },
  positive: { icon: CheckCircle2, color: '#4ade80', bg: '#4ade8008', border: '#4ade8020' },
};

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  'visual-glitch': 'Visual Glitch',
  'animation-issue': 'Animation',
  'gameplay-feel': 'Gameplay Feel',
  'ux-problem': 'UX Problem',
  'performance': 'Performance',
  'crash-bug': 'Crash/Bug',
  'level-pacing': 'Level Pacing',
  'audio-issue': 'Audio',
  'save-load': 'Save/Load',
  'ai-behavior': 'AI Behavior',
  'positive-feedback': 'Positive',
};

interface FindingsExplorerProps {
  sessions: PlaytestSession[];
  getFindings: (sessionId: string) => Promise<PlaytestFinding[]>;
}

export function FindingsExplorer({ sessions, getFindings }: FindingsExplorerProps) {
  const [allFindings, setAllFindings] = useState<PlaytestFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const completedSessions = sessions.filter(s => s.status === 'complete');
      const allResults = await Promise.all(completedSessions.map(s => getFindings(s.id)));
      if (!cancelled) {
        setAllFindings(allResults.flat());
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessions, getFindings]);

  const filtered = useMemo(() => {
    let result = allFindings;
    if (severityFilter !== 'all') {
      result = result.filter(f => f.severity === severityFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.suggestedFix.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allFindings, severityFilter, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <SurfaceCard className="flex items-center gap-2 flex-1 px-3 py-2">
          <Search className="w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search findings..."
            className="flex-1 bg-transparent text-xs text-text placeholder-text-muted outline-none"
          />
        </SurfaceCard>

        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-text-muted" />
          {(['all', 'critical', 'high', 'medium', 'low', 'positive'] as const).map((sev) => {
            const isActive = severityFilter === sev;
            const color = sev === 'all' ? 'var(--text-muted)' : SEVERITY_STYLES[sev].color;
            return (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-1 rounded text-2xs font-medium capitalize transition-all ${
                  isActive ? 'bg-border' : 'hover:bg-surface'
                }`}
                style={{ color: isActive ? color : 'var(--text-muted)' }}
              >
                {sev}
              </button>
            );
          })}
        </div>
      </div>

      <span className="text-2xs text-text-muted">
        {filtered.length} finding{filtered.length !== 1 ? 's' : ''} across {sessions.filter(s => s.status === 'complete').length} session{sessions.filter(s => s.status === 'complete').length !== 1 ? 's' : ''}
      </span>

      {/* Findings grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Target className="w-6 h-6 text-border-bright mb-2" />
          <p className="text-xs text-text-muted">
            {allFindings.length === 0 ? 'No findings yet. Complete a playtest to see results.' : 'No findings match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((finding, idx) => {
            const style = SEVERITY_STYLES[finding.severity];
            const Icon = style.icon;
            const catLabel = CATEGORY_LABELS[finding.category] ?? finding.category;

            return (
              <motion.div
                key={finding.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(idx * 0.02, 0.4) }}
                className="rounded-lg border px-3.5 py-3"
                style={{ backgroundColor: style.bg, borderColor: style.border }}
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: style.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-text">{finding.title}</span>
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-border text-text-muted">{catLabel}</span>
                      {finding.relatedModule && (
                        <span className="text-2xs px-1.5 py-0.5 rounded bg-border text-text-muted-hover">{finding.relatedModule}</span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted-hover leading-relaxed mb-1.5">{finding.description}</p>
                    {finding.suggestedFix && (
                      <p className="text-xs text-text-muted leading-relaxed italic">
                        Fix: {finding.suggestedFix}
                      </p>
                    )}
                  </div>
                  <span className="text-2xs text-text-muted flex-shrink-0">{finding.confidence}%</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
