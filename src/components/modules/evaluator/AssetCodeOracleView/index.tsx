'use client';

import { useState, useMemo } from 'react';
import {
  ScanSearch, AlertCircle,
  Loader2, RefreshCw, History,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useProjectStore } from '@/stores/projectStore';
import { STATUS_ERROR, STATUS_WARNING, STATUS_INFO, STATUS_IMPROVED, statusBg, statusBorder } from '@/lib/chart-colors';
import type { FilterSeverity } from './constants';
import { StatCard, ConsistencyHeroCard } from './ConsistencyHeroCard';
import { FilterChip, ViolationRow } from './ViolationRow';
import { DependencyExplorer } from './DependencyExplorer';
import { RemedyBar } from './RemedyBar';
import { useAssetCodeOracle } from './useAssetCodeOracle';

/** Resolved keys listed under the since-last-scan banner before "+N more". */
const RESOLVED_SHOWN = 8;

// ── Component ───────────────────────────────────────────────────────────────

export function AssetCodeOracleView() {
  const {
    result, loading, error, scanDelta, diff, sinceLabel, runAnalysis,
    fix, remedy, remedyRunning,
  } = useAssetCodeOracle();
  const projectPath = useProjectStore((s) => s.projectPath);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');
  const [newOnly, setNewOnly] = useState(false);
  const [activeSection, setActiveSection] = useState<'violations' | 'graph'>('violations');

  const filteredViolations = useMemo(() => {
    if (!result) return [];
    return result.violations.filter((v) =>
      (filterSeverity === 'all' || v.severity === filterSeverity)
      && (!newOnly || !diff.hasPrevious || diff.status[v.id] === 'new'));
  }, [result, filterSeverity, newOnly, diff]);

  const severityCounts = useMemo(() => {
    if (!result) return { error: 0, warning: 0, info: 0 };
    return {
      error: result.violations.filter((v) => v.severity === 'error').length,
      warning: result.violations.filter((v) => v.severity === 'warning').length,
      info: result.violations.filter((v) => v.severity === 'info').length,
    };
  }, [result]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanSearch className="w-4 h-4" style={{ color: STATUS_ERROR }} />
          <h2 className="text-sm font-semibold text-text">Asset-Code Consistency Oracle</h2>
        </div>
        <button
          onClick={() => void runAnalysis()}
          disabled={loading || !projectPath}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 hover:brightness-110"
          style={{
            backgroundColor: statusBg(STATUS_ERROR),
            color: STATUS_ERROR,
            border: `1px solid ${statusBorder(STATUS_ERROR)}`,
          }}
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          {loading ? 'Scanning...' : 'Run Analysis'}
        </button>
      </div>

      <p className="text-xs text-text-muted leading-relaxed">
        Cross-references C++ classes with Content/ assets to detect orphaned Blueprints,
        missing assets, stale references, and naming convention violations.
      </p>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
          style={{
            color: STATUS_ERROR,
            backgroundColor: statusBg(STATUS_ERROR),
            border: `1px solid ${statusBorder(STATUS_ERROR)}`,
          }}
        >
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Stats bar — consistency hero spans 2 columns, supporting metrics fill the rest */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <ConsistencyHeroCard score={result.stats.consistencyScore} delta={scanDelta} />
            <div className="md:col-span-2 grid grid-cols-3 gap-3">
              <StatCard label="Classes" value={result.stats.totalClasses} />
              <StatCard label="Assets" value={result.stats.totalAssets} />
              <StatCard label="Dep. Edges" value={result.stats.totalDependencyEdges} />
            </div>
          </div>

          {/* Since-last-scan diff (stable violation keys) */}
          {diff.hasPrevious && (
            <div
              className="rounded-lg px-3 py-2 space-y-1"
              style={{ backgroundColor: statusBg(STATUS_IMPROVED), border: `1px solid ${statusBorder(STATUS_IMPROVED)}` }}
            >
              <div className="flex items-center gap-2 text-xs font-medium" style={{ color: STATUS_IMPROVED }}>
                <History className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{`${diff.newCount} new · ${diff.resolved.length} resolved ${sinceLabel}`}</span>
              </div>
              {diff.resolved.length > 0 && (
                <ul className="text-2xs text-text-muted font-mono space-y-0.5 pl-5" aria-label="Resolved since the last scan">
                  {diff.resolved.slice(0, RESOLVED_SHOWN).map((k) => <li key={k} className="truncate">{k}</li>)}
                  {diff.resolved.length > RESOLVED_SHOWN && <li>+{diff.resolved.length - RESOLVED_SHOWN} more</li>}
                </ul>
              )}
            </div>
          )}

          <RemedyBar violations={result.violations} onFix={fix} running={remedyRunning} remedy={remedy} />

          {/* Section toggle */}
          <div className="flex items-center gap-1 border-b border-border">
            <button
              onClick={() => setActiveSection('violations')}
              className={`px-3 py-2 text-xs font-medium transition-colors relative ${
                activeSection === 'violations' ? 'text-text' : 'text-text-muted hover:text-text'
              }`}
            >
              Violations ({result.violations.length})
              {activeSection === 'violations' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ backgroundColor: STATUS_ERROR }} />
              )}
            </button>
            <button
              onClick={() => setActiveSection('graph')}
              className={`px-3 py-2 text-xs font-medium transition-colors relative ${
                activeSection === 'graph' ? 'text-text' : 'text-text-muted hover:text-text'
              }`}
            >
              Dependency Graph ({result.dependencyGraph.nodes.length} nodes)
              {activeSection === 'graph' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ backgroundColor: STATUS_ERROR }} />
              )}
            </button>
          </div>

          {/* Violations section */}
          {activeSection === 'violations' && (
            <div className="space-y-3">
              {/* Filter chips */}
              <div className="flex items-center gap-1.5">
                <FilterChip label="All" count={result.violations.length} active={filterSeverity === 'all'} onClick={() => setFilterSeverity('all')} />
                <FilterChip label="Errors" count={severityCounts.error} active={filterSeverity === 'error'} onClick={() => setFilterSeverity('error')} color={STATUS_ERROR} />
                <FilterChip label="Warnings" count={severityCounts.warning} active={filterSeverity === 'warning'} onClick={() => setFilterSeverity('warning')} color={STATUS_WARNING} />
                <FilterChip label="Info" count={severityCounts.info} active={filterSeverity === 'info'} onClick={() => setFilterSeverity('info')} color={STATUS_INFO} />
                {diff.hasPrevious && (
                  <FilterChip label="New only" count={diff.newCount} active={newOnly} onClick={() => setNewOnly((n) => !n)} color={STATUS_IMPROVED} />
                )}
              </div>

              {/* Violations list */}
              {filteredViolations.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-text-muted">
                    {result.violations.length === 0
                      ? 'No consistency violations found. Your project looks clean!'
                      : 'No violations match the selected filter.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredViolations.map((v) => (
                    <ViolationRow
                      key={v.id}
                      violation={v}
                      expanded={expandedId === v.id}
                      isNew={diff.status[v.id] === 'new'}
                      onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dependency graph section */}
          {activeSection === 'graph' && (
            <DependencyExplorer
              nodes={result.dependencyGraph.nodes}
              edges={result.dependencyGraph.edges}
            />
          )}
        </>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <SurfaceCard level={2}>
          <div className="p-6 text-center">
            <ScanSearch className="w-8 h-8 mx-auto text-border-bright mb-2" />
            <p className="text-xs text-text-muted">
              Click &ldquo;Run Analysis&rdquo; to scan your project and detect consistency issues.
            </p>
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
