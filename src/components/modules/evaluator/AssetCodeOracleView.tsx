'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanSearch, AlertTriangle, AlertCircle, Info,
  Loader2, ChevronDown, ChevronRight, RefreshCw,
  Link2, FileCode, Box, Package,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useProjectStore } from '@/stores/projectStore';
import type {
  OracleResult,
  ConsistencyViolation,
  ViolationType,
  ViolationSeverity,
} from '@/lib/asset-code-oracle';
import { STATUS_ERROR, STATUS_WARNING, STATUS_INFO, STATUS_SUCCESS, MODULE_COLORS } from '@/lib/chart-colors';

// ── Constants ───────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<ViolationSeverity, { icon: typeof AlertCircle; color: string; variant: 'error' | 'warning' | 'default' }> = {
  error: { icon: AlertCircle, color: STATUS_ERROR, variant: 'error' },
  warning: { icon: AlertTriangle, color: STATUS_WARNING, variant: 'warning' },
  info: { icon: Info, color: STATUS_INFO, variant: 'default' },
};

const TYPE_LABELS: Record<ViolationType, string> = {
  'orphaned-asset': 'Orphaned Asset',
  'missing-asset': 'Missing Asset',
  'stale-reference': 'Stale Reference',
  'naming-mismatch': 'Naming Mismatch',
  'unreferenced-asset': 'Unreferenced',
};

type FilterSeverity = 'all' | ViolationSeverity;

// ── Component ───────────────────────────────────────────────────────────────

export function AssetCodeOracleView() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectName = useProjectStore((s) => s.projectName);

  const [result, setResult] = useState<OracleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');
  const [activeSection, setActiveSection] = useState<'violations' | 'graph'>('violations');

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

      setResult(oracleJson.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [projectPath, projectName]);

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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 bg-[#ef444415] text-[#ef4444] border border-[#ef444430]"
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
        <div className="flex items-center gap-2 text-xs text-[#f87171] bg-[#f8717110] border border-[#f8717130] rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              label="Consistency"
              value={`${result.stats.consistencyScore}%`}
              ring={result.stats.consistencyScore}
            />
            <StatCard label="Classes" value={result.stats.totalClasses} />
            <StatCard label="Assets" value={result.stats.totalAssets} />
            <StatCard label="Dep. Edges" value={result.stats.totalDependencyEdges} />
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

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, ring }: { label: string; value: string | number; ring?: number }) {
  return (
    <SurfaceCard level={2}>
      <div className="px-3 py-2.5 flex items-center gap-2">
        {ring !== undefined && (
          <ProgressRing
            value={ring}
            size={28}
            strokeWidth={3}
            color={ring >= 80 ? STATUS_SUCCESS : ring >= 50 ? STATUS_WARNING : STATUS_ERROR}
          />
        )}
        <div>
          <p className="text-lg font-bold text-text tabular-nums">{value}</p>
          <p className="text-2xs text-text-muted">{label}</p>
        </div>
      </div>
    </SurfaceCard>
  );
}

function FilterChip({
  label, count, active, onClick, color,
}: {
  label: string; count: number; active: boolean; onClick: () => void; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-colors border ${
        active
          ? 'bg-surface-hover text-text border-border-bright'
          : 'bg-surface text-text-muted border-border hover:bg-surface-hover'
      }`}
    >
      {color && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />}
      {label}
      <span className="tabular-nums opacity-60">{count}</span>
    </button>
  );
}

function ViolationRow({
  violation: v,
  expanded,
  onToggle,
}: {
  violation: ConsistencyViolation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const config = SEVERITY_CONFIG[v.severity];
  const SevIcon = config.icon;

  return (
    <div className="rounded-lg border border-border bg-surface-deep overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-surface-hover transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
        )}
        <SevIcon className="w-3 h-3 flex-shrink-0" style={{ color: config.color }} />
        <span className="text-text font-medium flex-1 truncate">{v.title}</span>
        <Badge variant={config.variant}>{TYPE_LABELS[v.type]}</Badge>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border">
              <p className="text-2xs text-text-muted leading-relaxed">{v.description}</p>
              {v.expected && (
                <div className="flex items-center gap-1.5 text-2xs">
                  <span className="text-text-muted">Expected:</span>
                  <code className="px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted-hover font-mono">
                    {v.expected}
                  </code>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-2xs">
                <span className="text-text-muted">Fix:</span>
                <span className="text-text-muted-hover">{v.suggestion}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Dependency Explorer ────────────────────────────────────────────────────

function DependencyExplorer({
  nodes,
  edges,
}: {
  nodes: { name: string; type: string; inDegree: number; outDegree: number }[];
  edges: { from: string; to: string; relation: string }[];
}) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const types = useMemo(() => {
    const set = new Set(nodes.map((n) => n.type));
    return ['all', ...Array.from(set).sort()];
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    let list = typeFilter === 'all' ? nodes : nodes.filter((n) => n.type === typeFilter);
    // Sort by total connections descending
    return list.sort((a, b) => (b.inDegree + b.outDegree) - (a.inDegree + a.outDegree));
  }, [nodes, typeFilter]);

  const selectedEdges = useMemo(() => {
    if (!selectedNode) return { incoming: [], outgoing: [] };
    return {
      incoming: edges.filter((e) => e.to === selectedNode),
      outgoing: edges.filter((e) => e.from === selectedNode),
    };
  }, [edges, selectedNode]);

  const TYPE_ICONS: Record<string, typeof Box> = {
    mesh: Box,
    texture: Package,
    material: Package,
    blueprint: FileCode,
    class: FileCode,
  };

  return (
    <div className="grid grid-cols-[1fr_280px] gap-3" style={{ minHeight: 300 }}>
      {/* Node list */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2 py-0.5 rounded text-2xs font-medium transition-colors border ${
                typeFilter === t
                  ? 'bg-surface-hover text-text border-border-bright'
                  : 'bg-surface text-text-muted border-border hover:bg-surface-hover'
              }`}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>

        <div className="max-h-[400px] overflow-y-auto space-y-0.5 rounded-lg border border-border bg-surface-deep p-1">
          {filteredNodes.slice(0, 100).map((node) => {
            const isSelected = selectedNode === node.name;
            const NodeIcon = TYPE_ICONS[node.type] ?? Link2;
            return (
              <button
                key={node.name}
                onClick={() => setSelectedNode(isSelected ? null : node.name)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors ${
                  isSelected
                    ? 'bg-[#ef444415] text-text'
                    : 'hover:bg-surface-hover text-text-muted-hover'
                }`}
              >
                <NodeIcon className="w-3 h-3 flex-shrink-0 text-text-muted" />
                <span className="flex-1 truncate font-mono text-2xs">{node.name}</span>
                <span className="text-2xs text-text-muted tabular-nums flex-shrink-0">
                  {node.inDegree}↓ {node.outDegree}↑
                </span>
              </button>
            );
          })}
          {filteredNodes.length > 100 && (
            <p className="text-2xs text-text-muted text-center py-1">
              Showing 100 of {filteredNodes.length}
            </p>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="rounded-lg border border-border bg-surface-deep p-3 space-y-3 overflow-y-auto">
        {selectedNode ? (
          <>
            <div>
              <h4 className="text-xs font-semibold text-text truncate">{selectedNode}</h4>
              <p className="text-2xs text-text-muted mt-0.5">
                {nodes.find((n) => n.name === selectedNode)?.type ?? 'unknown'}
              </p>
            </div>

            {selectedEdges.incoming.length > 0 && (
              <div>
                <h5 className="text-2xs uppercase tracking-wider text-text-muted font-semibold mb-1">
                  Referenced by ({selectedEdges.incoming.length})
                </h5>
                <div className="space-y-0.5">
                  {selectedEdges.incoming.map((e, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedNode(e.from)}
                      className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-2xs text-left hover:bg-surface-hover transition-colors"
                    >
                      <span className="text-[#4ade80]">←</span>
                      <span className="text-text-muted-hover truncate flex-1 font-mono">{e.from}</span>
                      <Badge>{e.relation}</Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedEdges.outgoing.length > 0 && (
              <div>
                <h5 className="text-2xs uppercase tracking-wider text-text-muted font-semibold mb-1">
                  References ({selectedEdges.outgoing.length})
                </h5>
                <div className="space-y-0.5">
                  {selectedEdges.outgoing.map((e, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedNode(e.to)}
                      className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-2xs text-left hover:bg-surface-hover transition-colors"
                    >
                      <span className="text-[#60a5fa]">→</span>
                      <span className="text-text-muted-hover truncate flex-1 font-mono">{e.to}</span>
                      <Badge>{e.relation}</Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedEdges.incoming.length === 0 && selectedEdges.outgoing.length === 0 && (
              <p className="text-2xs text-text-muted">No dependency connections found.</p>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-2xs text-text-muted text-center">
              Select a node to explore its<br />dependency connections
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
