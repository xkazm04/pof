'use client';

import {
  ScanSearch, Play, Loader2, Zap, Trash2, RotateCcw,
  CheckCircle, Square, CheckSquare,
} from 'lucide-react';
import { EVAL_PASSES, PASS_LABELS } from '@/lib/evaluator/module-eval-prompts';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { SubModuleId } from '@/types/modules';
import type { ScanSeverity } from '@/types/scan';
import { SEVERITY_CONFIG, PASS_ICONS, ACCENT } from './constants';
import { useScanTab } from './useScanTab';
import { FindingRow } from './FindingRow';
import { ResolvedSection } from './ResolvedSection';

interface ScanTabProps {
  moduleId: SubModuleId;
}

export function ScanTab({ moduleId }: ScanTabProps) {
  const {
    moduleLabel,
    findings,
    clearScanFindings,
    resolveScanFinding,
    selectedPasses,
    togglePass,
    scanCount,
    scanCli,
    fixCli,
    startScan,
    activeFindings,
    resolvedFindings,
    bySeverity,
    severityCounts,
    passCounts,
    expandedFindings,
    toggleFinding,
    selectedFindings,
    toggleSelectFinding,
    toggleSelectAll,
    allSelected,
    startBatchFix,
    markSelectedResolved,
    isBatchFixing,
    fixProgress,
    fixTotalRef,
    activeFixId,
  } = useScanTab(moduleId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanSearch className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-text">Module Scan</span>
          <span className="text-xs text-text-muted">— {moduleLabel}</span>
          {scanCount > 0 && (
            <span className="text-2xs text-text-muted font-mono">
              {scanCount} scan{scanCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {findings.length > 0 && (
          <button
            onClick={() => clearScanFindings(moduleId)}
            className="flex items-center gap-1 px-2 py-1 rounded text-2xs text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Clear all findings"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Pass selector + Scan button */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {EVAL_PASSES.map((pass) => {
            const isActive = selectedPasses.has(pass);
            const PassIcon = PASS_ICONS[pass];
            const count = passCounts[pass];
            return (
              <button
                key={pass}
                onClick={() => togglePass(pass)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
                style={isActive
                  ? { backgroundColor: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}40` }
                  : { backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                }
              >
                <PassIcon className="w-3 h-3" />
                {PASS_LABELS[pass]}
                {count > 0 && (
                  <span className="text-2xs opacity-70">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={startScan}
          disabled={scanCli.isRunning || selectedPasses.size === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
          style={{
            backgroundColor: `${ACCENT}24`,
            color: ACCENT,
            border: `1px solid ${ACCENT}38`,
          }}
        >
          {scanCli.isRunning ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Scanning...
            </>
          ) : activeFindings.length > 0 ? (
            <>
              <RotateCcw className="w-3 h-3" />
              Re-Scan
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              Start Scan
            </>
          )}
        </button>
      </div>

      {/* Summary stats */}
      {activeFindings.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {(['critical', 'high', 'medium', 'low'] as ScanSeverity[]).map((sev) => {
            const cfg = SEVERITY_CONFIG[sev];
            const count = severityCounts[sev];
            const SevIcon = cfg.icon;
            return (
              <SurfaceCard key={sev} level={2} className="px-3 py-2" style={{ borderLeft: `2px solid ${cfg.color}` }}>
                <div className="flex items-center gap-1.5">
                  <SevIcon className="w-3 h-3" style={{ color: cfg.color }} />
                  <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">{sev}</span>
                </div>
                <div className="text-lg font-semibold mt-0.5" style={{ color: count > 0 ? cfg.color : 'var(--text-muted)' }}>
                  {count}
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      )}

      {/* Batch controls */}
      {activeFindings.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-text-muted hover:text-text hover:bg-surface-hover transition-colors border border-border"
          >
            {allSelected
              ? <CheckSquare className="w-3 h-3" style={{ color: ACCENT }} />
              : <Square className="w-3 h-3" />}
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>

          {selectedFindings.size > 0 && (
            <>
              <button
                onClick={startBatchFix}
                disabled={isBatchFixing || fixCli.isRunning || scanCli.isRunning}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: `${ACCENT}20`,
                  color: ACCENT,
                  border: `1px solid ${ACCENT}40`,
                }}
              >
                <Zap className="w-3 h-3" />
                Fix Selected ({selectedFindings.size})
              </button>

              <button
                onClick={markSelectedResolved}
                disabled={isBatchFixing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-3 h-3" />
                Mark Selected Resolved
              </button>
            </>
          )}

          {isBatchFixing && (
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <Loader2 className="w-3 h-3 animate-spin" style={{ color: ACCENT }} />
              {/* eslint-disable-next-line react-hooks/refs -- pre-existing ref read during render, compiler bailed on the original monolith; preserved verbatim in extraction */}
              Fixing {fixProgress + 1}/{fixTotalRef.current}...
            </span>
          )}
        </div>
      )}

      {/* Findings list grouped by severity */}
      {activeFindings.length > 0 ? (
        <div className="space-y-3">
          {(['critical', 'high', 'medium', 'low'] as ScanSeverity[]).map((sev) => {
            const items = bySeverity[sev];
            if (items.length === 0) return null;
            const cfg = SEVERITY_CONFIG[sev];

            return (
              <div key={sev} className="space-y-1">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>
                    {sev}
                  </span>
                  <span className="text-2xs text-text-muted">{items.length}</span>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  {items.map((finding) => (
                    <FindingRow
                      key={finding.id}
                      finding={finding}
                      isExpanded={expandedFindings.has(finding.id)}
                      onToggle={() => toggleFinding(finding.id)}
                      onResolve={() => resolveScanFinding(moduleId, finding.id)}
                      onFix={() => {
                        const prompt = `Fix the following issue in the ${moduleLabel} module:\n\n**${finding.category}** (${finding.severity})\n${finding.description}\n\nFile: ${finding.file ?? 'N/A'}\n\nSuggested fix: ${finding.suggestedFix}`;
                        scanCli.sendPrompt(prompt);
                      }}
                      isRunning={scanCli.isRunning || fixCli.isRunning}
                      selected={selectedFindings.has(finding.id)}
                      onSelect={() => toggleSelectFinding(finding.id)}
                      isActivelyFixing={activeFixId === finding.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <ScanSearch className="w-8 h-8 text-text-muted" style={{ opacity: 0.4 }} />
          <div>
            <p className="text-sm text-text-muted">No scan results yet</p>
            <p className="text-xs text-text-muted mt-1">
              Select evaluation passes and run a scan to analyze the {moduleLabel} module for issues.
            </p>
          </div>
        </div>
      )}

      {/* Resolved findings (collapsed by default) */}
      {resolvedFindings.length > 0 && (
        <ResolvedSection findings={resolvedFindings} />
      )}
    </div>
  );
}
