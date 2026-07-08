'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ScanSearch, AlertCircle,
  Loader2, RefreshCw,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useProjectStore } from '@/stores/projectStore';
import { useMarketplaceStore } from '@/stores/marketplaceStore';
import { formatSince } from '@/lib/consistency-grade';
import type { OracleResult } from '@/lib/asset-code-oracle';
import { STATUS_ERROR, STATUS_WARNING, STATUS_INFO, statusBg, statusBorder } from '@/lib/chart-colors';
import type { FilterSeverity } from './constants';
import { StatCard, ConsistencyHeroCard } from './ConsistencyHeroCard';
import { FilterChip, ViolationRow } from './ViolationRow';
import { DependencyExplorer } from './DependencyExplorer';

// ── Component ───────────────────────────────────────────────────────────────

export function AssetCodeOracleView() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectName = useProjectStore((s) => s.projectName);
  const recordConsistencyScan = useMarketplaceStore((s) => s.recordConsistencyScan);

  const [result, setResult] = useState<OracleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');
  const [activeSection, setActiveSection] = useState<'violations' | 'graph'>('violations');
  /** Delta of the consistency score vs. the previous recorded scan (null on first scan). */
  const [scanDelta, setScanDelta] = useState<{ delta: number; sinceLabel: string } | null>(null);

  const runAnalysis = useCallback(async () => {
    if (!projectPath || !projectName) {
      setError('No project configured. Set up a project first.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Scan project for C++ classes
      const projectRes = await fetch('/api/filesystem/scan-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, moduleName: projectName }),
      });
      const projectJson = await projectRes.json();
      if (!projectJson.success) throw new Error(projectJson.error ?? 'Project scan failed');

      // Scan assets in Content/
      const assetsRes = await fetch('/api/filesystem/scan-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath }),
      });
      const assetsJson = await assetsRes.json();
      if (!assetsJson.success) throw new Error(assetsJson.error ?? 'Asset scan failed');

      // Run oracle analysis
      const oracleRes = await fetch('/api/asset-code-oracle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classes: projectJson.data.classes,
          assets: assetsJson.data.assets,
          dependencies: assetsJson.data.dependencies,
        }),
      });
      const oracleJson = await oracleRes.json();
      if (!oracleJson.success) throw new Error(oracleJson.error ?? 'Analysis failed');

      // Compute delta vs. the previous recorded scan *before* recording this one.
      const projectKey = projectPath ?? projectName ?? 'default';
      const history = useMarketplaceStore.getState().consistencyScans[projectKey] ?? [];
      const previous = history[history.length - 1];
      const newScore: number = oracleJson.data.stats.consistencyScore;
      setScanDelta(
        previous
          ? { delta: newScore - previous.score, sinceLabel: formatSince(previous.timestamp) }
          : null,
      );

      setResult(oracleJson.data);
      recordConsistencyScan(projectKey, newScore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [projectPath, projectName, recordConsistencyScan]);

  const filteredViolations = useMemo(() => {
    if (!result) return [];
    if (filterSeverity === 'all') return result.violations;
    return result.violations.filter((v) => v.severity === filterSeverity);
  }, [result, filterSeverity]);

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
          <ScanSearch className="w-4 h-4 text-[#ef4444]" />
          <h2 className="text-sm font-semibold text-text">Asset-Code Consistency Oracle</h2>
        </div>
        <button
          onClick={runAnalysis}
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
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-[#ef4444]" />
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
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-[#ef4444]" />
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
