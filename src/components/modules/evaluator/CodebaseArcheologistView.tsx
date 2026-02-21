'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pickaxe, AlertTriangle, AlertCircle, Info, RefreshCw, ChevronDown, ChevronRight,
  GitCommit, FileWarning, TrendingUp, Layers, Filter,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { apiFetch } from '@/lib/api-utils';
import { useProjectStore } from '@/stores/projectStore';
import type {
  ArcheologistAnalysis,
  AntiPatternHit,
  AntiPatternCategory,
  Severity,
  FileChurn,
  ShotgunSurgery,
  RefactoringItem,
} from '@/types/codebase-archeologist';
import { MODULE_COLORS } from '@/lib/chart-colors';

// ── Stable empty references (Zustand selector safety) ──

const EMPTY_HITS: AntiPatternHit[] = [];
const EMPTY_CHURN: FileChurn[] = [];
const EMPTY_SURGERY: ShotgunSurgery[] = [];
const EMPTY_BACKLOG: RefactoringItem[] = [];

// ── Helpers ──

type ViewTab = 'overview' | 'anti-patterns' | 'churn' | 'backlog';

const CATEGORY_LABELS: Record<AntiPatternCategory, string> = {
  'missing-generated-body': 'Missing GENERATED_BODY()',
  'circular-include': 'Circular Includes',
  'hard-coded-asset-path': 'Hard-coded Asset Paths',
  'untracked-newobject': 'Untracked NewObject',
  'deprecated-api': 'Deprecated API',
  'god-class': 'God Class',
};

const SEVERITY_CONFIG: Record<Severity, { icon: typeof AlertCircle; color: string; bg: string }> = {
  critical: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
  warning:  { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  info:     { icon: Info, color: 'text-blue-400', bg: 'bg-blue-400/10' },
};

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-2xs font-medium ${cfg.color} ${cfg.bg}`}>
      <Icon className="w-2.5 h-2.5" />
      {severity}
    </span>
  );
}

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
        <div className="rounded border border-red-400/30 bg-red-400/5 px-3 py-2 text-xs text-red-400">
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
                <AlertCircle className="w-3 h-3 text-red-400" />
                <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Critical</span>
              </div>
              <div className="text-base font-semibold text-red-400">{analysis.bySeverity.critical}</div>
            </SurfaceCard>
            <SurfaceCard level={2} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3 h-3 text-yellow-400" />
                <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Warnings</span>
              </div>
              <div className="text-base font-semibold text-yellow-400">{analysis.bySeverity.warning}</div>
            </SurfaceCard>
            <SurfaceCard level={2} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="w-3 h-3 text-blue-400" />
                <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Info</span>
              </div>
              <div className="text-base font-semibold text-blue-400">{analysis.bySeverity.info}</div>
            </SurfaceCard>
            <SurfaceCard level={2} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <GitCommit className="w-3 h-3 text-purple-400" />
                <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">High Churn</span>
              </div>
              <div className="text-base font-semibold text-purple-400">{churn.filter(c => c.commits >= 5).length}</div>
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

// ── Overview tab ──

function OverviewTab({ analysis }: { analysis: ArcheologistAnalysis }) {
  const healthScore = Math.max(0, 100 - analysis.bySeverity.critical * 15 - analysis.bySeverity.warning * 3 - analysis.bySeverity.info);
  const ringColor = healthScore >= 70 ? MODULE_COLORS.setup : healthScore >= 40 ? MODULE_COLORS.content : MODULE_COLORS.evaluator;

  return (
    <div className="space-y-3">
      <SurfaceCard level={2} className="px-4 py-4">
        <div className="flex items-center gap-4">
          <ProgressRing value={Math.round(healthScore)} size={56} color={ringColor} label="Code health score" />
          <div>
            <div className="text-sm font-semibold text-text">Code Health Score</div>
            <div className="text-xs text-text-muted mt-0.5">
              Based on {analysis.totalAntiPatterns} detected issues across {analysis.totalFiles} source files
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* Top 5 refactoring items */}
      {analysis.refactoringBacklog.length > 0 && (
        <SurfaceCard level={2} className="px-3 py-2.5">
          <div className="text-2xs uppercase tracking-wider text-text-muted font-medium mb-2">Top Priority Files</div>
          <div className="space-y-1">
            {analysis.refactoringBacklog.slice(0, 5).map((item, i) => (
              <div key={item.file} className="flex items-center gap-2 text-xs">
                <span className="text-text-muted w-4 text-right font-mono">{i + 1}.</span>
                <span className="text-text font-mono truncate flex-1" title={item.file}>{item.file}</span>
                <SeverityBadge severity={item.severity} />
                <span className="text-text-muted font-mono text-2xs">score {item.score}</span>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* Shotgun surgeries preview */}
      {analysis.shotgunSurgeries.length > 0 && (
        <SurfaceCard level={2} className="px-3 py-2.5">
          <div className="text-2xs uppercase tracking-wider text-text-muted font-medium mb-2">
            Shotgun Surgeries ({analysis.shotgunSurgeries.length} commits touching 10+ files)
          </div>
          <div className="space-y-1">
            {analysis.shotgunSurgeries.slice(0, 3).map((s) => (
              <div key={s.commit} className="flex items-center gap-2 text-xs">
                <span className="text-[#a78bfa] font-mono">{s.commit}</span>
                <span className="text-text-muted truncate flex-1">{s.message}</span>
                <span className="text-[#f97316] font-mono text-2xs">{s.filesChanged} files</span>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}

// ── Anti-patterns tab ──

function AntiPatternsTab({
  hits, totalCount, categoryFilter, severityFilter,
  onCategoryChange, onSeverityChange,
}: {
  hits: AntiPatternHit[];
  totalCount: number;
  categoryFilter: AntiPatternCategory | 'all';
  severityFilter: Severity | 'all';
  onCategoryChange: (v: AntiPatternCategory | 'all') => void;
  onSeverityChange: (v: Severity | 'all') => void;
}) {
  return (
    <div className="space-y-2">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-text-muted" />
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value as AntiPatternCategory | 'all')}
            className="bg-background border border-border-bright rounded px-2 py-0.5 text-xs text-text outline-none"
          >
            <option value="all">All categories</option>
            {(Object.keys(CATEGORY_LABELS) as AntiPatternCategory[]).map(c => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <select
          value={severityFilter}
          onChange={(e) => onSeverityChange(e.target.value as Severity | 'all')}
          className="bg-background border border-border-bright rounded px-2 py-0.5 text-xs text-text outline-none"
        >
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <span className="text-2xs text-text-muted ml-auto">
          {hits.length}{hits.length !== totalCount ? ` of ${totalCount}` : ''} issues
        </span>
      </div>

      {/* Hits list */}
      <div className="rounded border border-border bg-background/60 overflow-hidden divide-y divide-border/40">
        {hits.length === 0 ? (
          <div className="text-center text-text-muted text-xs py-6">
            {totalCount === 0 ? 'No anti-patterns detected.' : 'No matches for current filters.'}
          </div>
        ) : (
          hits.slice(0, 100).map((h) => <AntiPatternRow key={h.id} hit={h} />)
        )}
      </div>
    </div>
  );
}

function AntiPatternRow({ hit }: { hit: AntiPatternHit }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-surface-hover/30 transition-colors text-xs"
      >
        {expanded
          ? <ChevronDown className="w-2.5 h-2.5 text-text-muted flex-shrink-0" />
          : <ChevronRight className="w-2.5 h-2.5 text-text-muted flex-shrink-0" />
        }
        <SeverityBadge severity={hit.severity} />
        <span className="text-text truncate flex-1">{hit.message}</span>
        <span className="text-2xs text-text-muted font-mono flex-shrink-0">{hit.file}{hit.line ? `:${hit.line}` : ''}</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            <div className="px-8 pb-2 space-y-1 text-xs">
              <div>
                <span className="text-text-muted">Category: </span>
                <span className="text-text">{CATEGORY_LABELS[hit.category]}</span>
              </div>
              <div>
                <span className="text-text-muted">File: </span>
                <span className="text-text font-mono">{hit.file}{hit.line ? `:${hit.line}` : ''}</span>
              </div>
              <div>
                <span className="text-text-muted">Suggestion: </span>
                <span className="text-green-400/80">{hit.suggestion}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Churn tab ──

function ChurnTab({ churn, surgeries }: { churn: FileChurn[]; surgeries: ShotgunSurgery[] }) {
  const maxCommits = churn.length > 0 ? churn[0].commits : 1;

  return (
    <div className="space-y-3">
      {/* File churn table */}
      <SurfaceCard level={2} className="px-3 py-2.5">
        <div className="text-2xs uppercase tracking-wider text-text-muted font-medium mb-2">
          Most Changed Files (by commit count)
        </div>
        {churn.length === 0 ? (
          <div className="text-xs text-text-muted py-4 text-center">No git history found</div>
        ) : (
          <div className="space-y-1">
            {churn.slice(0, 20).map((c) => (
              <div key={c.file} className="flex items-center gap-2 text-xs">
                <span className="text-text font-mono truncate flex-1" title={c.file}>{c.file}</span>
                <div className="w-24 h-1.5 rounded-full bg-surface-hover overflow-hidden flex-shrink-0">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{ width: `${(c.commits / maxCommits) * 100}%` }}
                  />
                </div>
                <span className="text-text-muted font-mono w-8 text-right flex-shrink-0">{c.commits}</span>
                <span className="text-2xs text-text-muted flex-shrink-0">{c.authors} author{c.authors !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {/* Shotgun surgeries */}
      <SurfaceCard level={2} className="px-3 py-2.5">
        <div className="text-2xs uppercase tracking-wider text-text-muted font-medium mb-2">
          Shotgun Surgeries (commits touching 10+ files)
        </div>
        {surgeries.length === 0 ? (
          <div className="text-xs text-text-muted py-4 text-center">No shotgun surgery patterns detected</div>
        ) : (
          <div className="space-y-1">
            {surgeries.map((s) => (
              <div key={s.commit} className="flex items-center gap-2 text-xs">
                <span className="text-[#a78bfa] font-mono flex-shrink-0">{s.commit}</span>
                <span className="text-text truncate flex-1">{s.message}</span>
                <span className="text-[#f97316] font-mono text-2xs flex-shrink-0">{s.filesChanged} files</span>
                <span className="text-2xs text-text-muted flex-shrink-0">
                  {s.date ? new Date(s.date).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}

// ── Backlog tab ──

function BacklogTab({ backlog }: { backlog: RefactoringItem[] }) {
  const maxScore = backlog.length > 0 ? backlog[0].score : 1;

  return (
    <div className="space-y-2">
      <div className="text-xs text-text-muted">
        Prioritized by <span className="text-text font-medium">anti-patterns × git churn</span> — higher score = more urgent
      </div>
      <div className="rounded border border-border bg-background/60 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_60px_50px_50px_80px_60px] gap-2 px-2 py-1 bg-surface-deep border-b border-border text-2xs uppercase tracking-wider text-text-muted font-medium">
          <span>File</span>
          <span>Score</span>
          <span>Issues</span>
          <span>Churn</span>
          <span>Top Category</span>
          <span>Severity</span>
        </div>
        {backlog.length === 0 ? (
          <div className="text-center text-text-muted text-xs py-6">
            No refactoring items — clean codebase!
          </div>
        ) : (
          backlog.map((item) => (
            <div
              key={item.file}
              className="grid grid-cols-[1fr_60px_50px_50px_80px_60px] gap-2 px-2 py-1.5 border-b border-border/40 last:border-b-0 text-xs hover:bg-surface-hover/30 transition-colors"
            >
              <span className="text-text font-mono truncate" title={item.file}>{item.file}</span>
              <div className="flex items-center gap-1">
                <div className="w-8 h-1 rounded-full bg-surface-hover overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#f97316] transition-all"
                    style={{ width: `${(item.score / maxScore) * 100}%` }}
                  />
                </div>
                <span className="text-text font-mono">{item.score}</span>
              </div>
              <span className="text-text-muted font-mono">{item.antiPatterns}</span>
              <span className="text-text-muted font-mono">{item.churn}</span>
              <span className="text-2xs text-text-muted truncate">{CATEGORY_LABELS[item.topCategory]}</span>
              <SeverityBadge severity={item.severity} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
