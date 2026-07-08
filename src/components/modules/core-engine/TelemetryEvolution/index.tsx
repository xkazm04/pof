'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Dna, Scan, Loader2 } from 'lucide-react';
import { motionSafe } from '@/lib/motion';
import { useGenreEvolution } from '@/hooks/useGenreEvolution';
import { useProjectStore } from '@/stores/projectStore';
import { GenreDnaTimeline } from '@/components/modules/core-engine/GenreDnaTimeline';
import { ACCENT } from './constants';
import { EmptyState } from './EmptyState';
import { PatternsList } from './PatternsList';
import { SuggestionsList } from './SuggestionsList';
import { AcceptedGenres } from './AcceptedGenres';
import { ScanHistory } from './ScanHistory';

export function TelemetryEvolution() {
  const { stats, history, loading, scanning, scanProject, resolveSuggestion } = useGenreEvolution();
  const { projectPath, dynamicContext } = useProjectStore();
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();

  const handleScan = async () => {
    if (!projectPath) return;
    await scanProject(projectPath, dynamicContext);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
      </div>
    );
  }

  const patterns = stats?.detectedPatterns ?? [];
  const suggestions = stats?.activeSuggestions ?? [];
  const accepted = stats?.acceptedSubGenres ?? [];

  return (
    <div className="space-y-5">
      {/* Header + Scan button */}
      <motion.div
        initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={motionSafe({ duration: 0.22 }, prefersReduced)}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${ACCENT}12`, border: `1px solid ${ACCENT}20` }}
          >
            <Dna className="w-4 h-4" style={{ color: ACCENT }} />
          </div>
          <div>
            <h2 className="text-sm font-medium text-text">Genre Evolution</h2>
            <p className="text-2xs text-text-muted">
              {stats?.totalScans ?? 0} scan{(stats?.totalScans ?? 0) !== 1 ? 's' : ''}
              {stats?.lastScanAt && (
                <> &middot; last {new Date(stats.lastScanAt).toLocaleDateString()}</>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning || !projectPath}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
          style={{
            backgroundColor: `${ACCENT}15`,
            color: ACCENT,
            border: `1px solid ${ACCENT}30`,
          }}
        >
          {scanning ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Scan className="w-3 h-3" />
          )}
          {scanning ? 'Scanning...' : 'Scan Project'}
        </button>
      </motion.div>

      {/* Empty state */}
      {patterns.length === 0 && suggestions.length === 0 && accepted.length === 0 && (
        <EmptyState onScan={handleScan} scanning={scanning} hasProject={!!projectPath} />
      )}

      {/* Detected patterns */}
      {patterns.length > 0 && (
        <PatternsList patterns={patterns} />
      )}

      {/* Active suggestions */}
      {suggestions.length > 0 && (
        <SuggestionsList
          suggestions={suggestions}
          expandedId={expandedSuggestion}
          onToggle={(id) => setExpandedSuggestion(prev => prev === id ? null : id)}
          onResolve={resolveSuggestion}
        />
      )}

      {/* Accepted sub-genres */}
      {accepted.length > 0 && (
        <AcceptedGenres genres={accepted} />
      )}

      {/* Genre DNA Timeline — cinematic confidence-over-time strands */}
      {history.length > 1 && (
        <GenreDnaTimeline history={history} />
      )}

      {/* Scan history */}
      {history.length > 1 && (
        <ScanHistory history={history} />
      )}
    </div>
  );
}
