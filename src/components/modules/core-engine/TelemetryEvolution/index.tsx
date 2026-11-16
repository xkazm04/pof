'use client';

import { useState, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Dna, Scan, Loader2, AlertCircle } from 'lucide-react';
import { motionSafe } from '@/lib/motion';
import { useGenreEvolution } from '@/hooks/useGenreEvolution';
import { useProjectStore } from '@/stores/projectStore';
import { logger } from '@/lib/logger';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { GenreDnaTimeline } from '@/components/modules/core-engine/GenreDnaTimeline';
import { ACCENT } from './constants';
import { EmptyState } from './EmptyState';
import { PatternsList } from './PatternsList';
import { SuggestionsList } from './SuggestionsList';
import { AcceptedGenres } from './AcceptedGenres';
import { ScanHistory } from './ScanHistory';

export function TelemetryEvolution() {
  const { stats, history, loading, loadError, scanning, scanError, refresh, scanProject, resolveSuggestion } = useGenreEvolution();
  // Two field selectors, not the whole store: a bare useProjectStore() re-rendered this
  // panel on every unrelated project-store write (scan flags, setup step, recents).
  const projectPath = useProjectStore((s) => s.projectPath);
  const dynamicContext = useProjectStore((s) => s.dynamicContext);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  // One resolve per suggestion at a time: the UPDATE is a blind last-write-wins, so an
  // Accept followed by a quick Dismiss would leave 'dismissed' after the UI showed acceptance.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const prefersReduced = useReducedMotion();

  const handleScan = async () => {
    if (!projectPath) return;
    const result = await scanProject(projectPath, dynamicContext);
    if (!result) return; // Failure — surfaced to the user via the scanError banner below.
  };

  // Accept/Dismiss is a POST that can fail; the hook rethrows, so the failure is
  // caught HERE and stated — not left as an unhandled rejection with no feedback.
  const handleResolve = async (id: string, action: 'accept' | 'dismiss') => {
    if (pendingRef.current) return;
    pendingRef.current = id;
    setPendingId(id);
    setResolveError(null);
    try {
      await resolveSuggestion(id, action);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'the request failed';
      logger.warn(`[TelemetryEvolution] ${action} suggestion ${id} failed: ${message}`);
      setResolveError(`${action === 'accept' ? 'Accept' : 'Dismiss'} not saved: ${message}`);
    } finally {
      pendingRef.current = null;
      setPendingId(null);
    }
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
  // Scans belonging to OTHER projects are excluded from this panel (and from the skill
  // packs the CLI injects). Count them out loud: without this line, "0 scans" reads as
  // "nobody ever scanned" when the truth is "those scans belong to another project".
  const foreignScans = stats?.scope?.foreignRows ?? 0;

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

      {/* Scan failure — inline alert matching the shared red banner pattern */}
      {scanError && (
        <div
          role="alert"
          data-testid="genre-scan-error"
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="min-w-0 flex-1">Scan failed: {scanError}</span>
          <button
            onClick={handleScan}
            disabled={scanning || !projectPath}
            className="shrink-0 font-medium underline underline-offset-2 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}

      {resolveError && (
        <div
          role="alert"
          data-testid="genre-resolve-error"
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{resolveError}</span>
        </div>
      )}

      {/* Out-of-scope scans — stated and counted, never adopted into this project. */}
      {foreignScans > 0 && (
        <p className="text-2xs text-text-muted" data-testid="telemetry-scope-note">
          {foreignScans} scan{foreignScans === 1 ? '' : 's'} on this machine belong to
          {' '}other project{foreignScans === 1 ? '' : 's'} and are excluded — the patterns, scan history
          {' '}and the skill packs the CLI injects use only this project&apos;s scans. Suggestions and
          {' '}accepted sub-genres are install-wide (see below).
        </p>
      )}

      {/* A failed read is a failure, never the "0 scans" empty state. */}
      {loadError && (
        <div data-testid="genre-load-error">
          <InlineErrorRetry message={`Could not load scan data: ${loadError}`} onRetry={() => { void refresh(); }} />
        </div>
      )}

      {/* Empty state */}
      {!loadError && patterns.length === 0 && suggestions.length === 0 && accepted.length === 0 && (
        <EmptyState onScan={handleScan} scanning={scanning} hasProject={!!projectPath} scanCount={stats?.totalScans ?? 0} />
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
          pendingId={pendingId}
          onToggle={(id) => setExpandedSuggestion(prev => prev === id ? null : id)}
          onResolve={(id, action) => { void handleResolve(id, action); }}
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
