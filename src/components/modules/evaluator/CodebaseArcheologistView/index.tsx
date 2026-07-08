'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pickaxe, AlertTriangle, AlertCircle, Info, RefreshCw,
  GitCommit, FileWarning, TrendingUp, Layers,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { apiFetch } from '@/lib/api-utils';
import { useProjectStore } from '@/stores/projectStore';
import type {
  ArcheologistAnalysis,
  AntiPatternCategory,
  Severity,
} from '@/types/codebase-archeologist';
import { SEVERITY_TOKENS, STATUS_STALE } from '@/lib/chart-colors';
import {
  EMPTY_HITS, EMPTY_CHURN, EMPTY_SURGERY, EMPTY_BACKLOG,
  CATEGORY_LABELS, type ViewTab,
} from './constants';
import { OverviewTab } from './OverviewTab';
import { AntiPatternsTab } from './AntiPatternsTab';
import { ChurnTab } from './ChurnTab';
import { BacklogTab } from './BacklogTab';

// ── Main view ──

export function CodebaseArcheologistView() {
  const [analysis, setAnalysis] = useState<ArcheologistAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ViewTab>('overview');
  const [categoryFilter, setCategoryFilter] = useState<AntiPatternCategory | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');

  const projectPath = useProjectStore((s) => s.projectPath);

  const runAnalysis = useCallback(async () => {
    if (!projectPath) {
      setError('No project path configured. Set up a project first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ analysis: ArcheologistAnalysis }>(
        '/api/codebase-archeologist',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectPath }) },
      );
      setAnalysis(data.analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    if (projectPath) runAnalysis();
  }, [projectPath, runAnalysis]);

  const filteredHits = useMemo(() => {
    const hits = analysis?.antiPatterns ?? EMPTY_HITS;
    return hits.filter(h => {
      if (categoryFilter !== 'all' && h.category !== categoryFilter) return false;
      if (severityFilter !== 'all' && h.severity !== severityFilter) return false;
      return true;
    });
  }, [analysis, categoryFilter, severityFilter]);

  const churn = analysis?.churn ?? EMPTY_CHURN;
  const surgeries = analysis?.shotgunSurgeries ?? EMPTY_SURGERY;
  const backlog = analysis?.refactoringBacklog ?? EMPTY_BACKLOG;

  const tabClass = (t: ViewTab) =>
    `px-3 py-1.5 text-xs font-medium transition-colors rounded-t ${
      tab === t
        ? 'text-text bg-surface-hover border-b-2 border-[#f97316]'
        : 'text-text-muted hover:text-text'
    }`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pickaxe className="w-5 h-5 text-[#f97316]" />
          <h2 className="text-sm font-semibold text-text">Codebase Archeologist</h2>
          {analysis && (
            <span className="text-2xs text-text-muted font-mono">
              {analysis.totalFiles} files · {analysis.totalAntiPatterns} issues · {(analysis.scanDurationMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#f97316] bg-[#f97316]/10 hover:bg-[#f97316]/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {error && (
        <div
          className="rounded border px-3 py-2 text-xs"
          style={{
            color: SEVERITY_TOKENS.critical.color,
            backgroundColor: SEVERITY_TOKENS.critical.bg,
            borderColor: SEVERITY_TOKENS.critical.border,
          }}
        >
          {error}
        </div>
      )}

      {!analysis && !loading && !error && (
        <SurfaceCard level={2} className="px-4 py-8 text-center">
          <Pickaxe className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-muted">Set up a UE5 project to run archeological analysis</p>
        </SurfaceCard>
      )}

      {loading && !analysis && (
        <SurfaceCard level={2} className="px-4 py-8 text-center">
          <RefreshCw className="w-6 h-6 text-[#f97316] mx-auto mb-2 animate-spin" />
          <p className="text-sm text-text-muted">Scanning source files and git history…</p>
        </SurfaceCard>
      )}

      {analysis && (
        <>
          {/* Summary metrics */}
          <div className="grid grid-cols-5 gap-2">
            <SurfaceCard level={2} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-3 h-3" style={{ color: SEVERITY_TOKENS.critical.color }} />
                <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Critical</span>
              </div>
              <div className="text-base font-semibold" style={{ color: SEVERITY_TOKENS.critical.color }}>{analysis.bySeverity.critical}</div>
            </SurfaceCard>
            <SurfaceCard level={2} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3 h-3" style={{ color: SEVERITY_TOKENS.warning.color }} />
                <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Warnings</span>
              </div>
              <div className="text-base font-semibold" style={{ color: SEVERITY_TOKENS.warning.color }}>{analysis.bySeverity.warning}</div>
            </SurfaceCard>
            <SurfaceCard level={2} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="w-3 h-3" style={{ color: SEVERITY_TOKENS.info.color }} />
                <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Info</span>
              </div>
              <div className="text-base font-semibold" style={{ color: SEVERITY_TOKENS.info.color }}>{analysis.bySeverity.info}</div>
            </SurfaceCard>
            <SurfaceCard level={2} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <GitCommit className="w-3 h-3" style={{ color: STATUS_STALE }} />
                <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">High Churn</span>
              </div>
              <div className="text-base font-semibold" style={{ color: STATUS_STALE }}>{churn.filter(c => c.commits >= 5).length}</div>
            </SurfaceCard>
            <SurfaceCard level={2} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <FileWarning className="w-3 h-3 text-[#f97316]" />
                <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Backlog</span>
              </div>
              <div className="text-base font-semibold text-[#f97316]">{backlog.length}</div>
            </SurfaceCard>
          </div>

          {/* Category breakdown bar */}
          <SurfaceCard level={2} className="px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-3 h-3 text-text-muted" />
              <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">By Category</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(analysis.byCategory) as Array<[AntiPatternCategory, number]>)
                .filter(([, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-xs">
                    <span className="text-text-muted truncate">{CATEGORY_LABELS[cat]}</span>
                    <span className="text-text font-mono ml-2">{count}</span>
                  </div>
                ))
              }
              {Object.values(analysis.byCategory).every(v => v === 0) && (
                <span className="text-xs text-text-muted col-span-3">No anti-patterns detected</span>
              )}
            </div>
          </SurfaceCard>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border">
            <button className={tabClass('overview')} onClick={() => setTab('overview')}>
              <span className="flex items-center gap-1"><Layers className="w-2.5 h-2.5" /> Overview</span>
            </button>
            <button className={tabClass('anti-patterns')} onClick={() => setTab('anti-patterns')}>
              <span className="flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> Anti-Patterns</span>
            </button>
            <button className={tabClass('churn')} onClick={() => setTab('churn')}>
              <span className="flex items-center gap-1"><GitCommit className="w-2.5 h-2.5" /> Git Churn</span>
            </button>
            <button className={tabClass('backlog')} onClick={() => setTab('backlog')}>
              <span className="flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5" /> Refactoring Backlog</span>
            </button>
          </div>

          {/* Tab content */}
          {tab === 'overview' && <OverviewTab analysis={analysis} />}
          {tab === 'anti-patterns' && (
            <AntiPatternsTab
              hits={filteredHits}
              totalCount={analysis.antiPatterns.length}
              categoryFilter={categoryFilter}
              severityFilter={severityFilter}
              onCategoryChange={setCategoryFilter}
              onSeverityChange={setSeverityFilter}
            />
          )}
          {tab === 'churn' && <ChurnTab churn={churn} surgeries={surgeries} />}
          {tab === 'backlog' && <BacklogTab backlog={backlog} />}
        </>
      )}
    </div>
  );
}
