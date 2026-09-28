'use client';

import { useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { useProjectStore } from '@/stores/projectStore';
import { useMarketplaceStore } from '@/stores/marketplaceStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { formatSince } from '@/lib/consistency-grade';
import { STATUS_ERROR } from '@/lib/chart-colors';
import { logger } from '@/lib/logger';
import type { OracleResult, ViolationType } from '@/lib/asset-code-oracle';
import type { ScannedClass } from '@/app/api/filesystem/scan-project/route';
import type { ScannedAsset, AssetDependencyEdge } from '@/app/api/filesystem/scan-assets/route';
import { diffOracleScans, EMPTY_ORACLE_DIFF, type OracleScanDiff } from '@/lib/asset-oracle/oracleDiff';
import { planOracleRemedy } from '@/lib/asset-oracle/oracleRemedy';

const POST_JSON = { method: 'POST', headers: { 'Content-Type': 'application/json' } } as const;

/** The remedy session lives on the evaluator's CLI precedent module (ProjectHealthDashboard). */
const REMEDY_MODULE = 'ai-behavior' as const;
export const REMEDY_SESSION_KEY = 'asset-oracle-remedy';

export interface RemedyRun {
  label: string;
  keys: string[];
  /** null while the CLI run is in flight. */
  success: boolean | null;
}

export interface AssetCodeOracleState {
  result: OracleResult | null;
  loading: boolean;
  error: string | null;
  /** Delta of the consistency score vs. the previous recorded scan (null on first scan). */
  scanDelta: { delta: number; sinceLabel: string } | null;
  /** Violation-key diff vs. the previous recorded scan. */
  diff: OracleScanDiff;
  sinceLabel: string;
  runAnalysis: () => Promise<void>;
  /** Dispatch the one-click remedy for a violation type (no-op when none applies). */
  fix: (type: ViolationType) => void;
  remedy: RemedyRun | null;
  remedyRunning: boolean;
}

/**
 * The Asset-Code Oracle pipeline (scan-project -> scan-assets -> oracle), the
 * since-last-scan diff over stable violation keys, and the remedy loop: a remedy
 * is one `ask-claude` CLITask on the rail, and its completion re-runs the analysis
 * so the diff shows whether the targeted keys resolved.
 */
export function useAssetCodeOracle(): AssetCodeOracleState {
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectName = useProjectStore((s) => s.projectName);
  const recordConsistencyScan = useMarketplaceStore((s) => s.recordConsistencyScan);

  const [result, setResult] = useState<OracleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanDelta, setScanDelta] = useState<{ delta: number; sinceLabel: string } | null>(null);
  const [diff, setDiff] = useState<OracleScanDiff>(EMPTY_ORACLE_DIFF);
  const [sinceLabel, setSinceLabel] = useState('');
  const [remedy, setRemedy] = useState<RemedyRun | null>(null);

  const runAnalysis = useCallback(async () => {
    if (!projectPath || !projectName) {
      setError('No project configured. Set up a project first.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const project = await apiFetch<{ classes: ScannedClass[] }>('/api/filesystem/scan-project', {
        ...POST_JSON, body: JSON.stringify({ projectPath, moduleName: projectName }),
      });
      const scan = await apiFetch<{ assets: ScannedAsset[]; dependencies: AssetDependencyEdge[] }>(
        '/api/filesystem/scan-assets', { ...POST_JSON, body: JSON.stringify({ projectPath }) },
      );
      const oracle = await apiFetch<OracleResult>('/api/asset-code-oracle', {
        ...POST_JSON,
        body: JSON.stringify({ classes: project.classes, assets: scan.assets, dependencies: scan.dependencies }),
      });

      // Diff vs. the previous recorded scan *before* recording this one.
      const projectKey = projectPath ?? projectName ?? 'default';
      const history = useMarketplaceStore.getState().consistencyScans[projectKey] ?? [];
      const previous = history[history.length - 1];
      const score = oracle.stats.consistencyScore;
      const since = previous ? formatSince(previous.timestamp) : '';
      setScanDelta(previous ? { delta: score - previous.score, sinceLabel: since } : null);
      setSinceLabel(since);
      setDiff(diffOracleScans(previous?.violationKeys ?? null, oracle.violations));
      setResult(oracle);
      recordConsistencyScan(projectKey, score, oracle.violations.map((v) => v.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [projectPath, projectName, recordConsistencyScan]);

  // A remedy's completion (success or not) re-runs the analysis: the rescan is
  // three local filesystem calls, and it is the only honest verdict on the fix.
  const remedyPending = useRef(false);
  const cli = useModuleCLI({
    moduleId: REMEDY_MODULE,
    sessionKey: REMEDY_SESSION_KEY,
    label: 'Asset Oracle · Fix',
    accentColor: STATUS_ERROR,
    onComplete: (success) => {
      if (!remedyPending.current) return;
      remedyPending.current = false;
      setRemedy((prev) => (prev ? { ...prev, success } : prev));
      void runAnalysis();
    },
  });

  const fix = useCallback(
    (type: ViolationType) => {
      if (!result) return;
      const plan = planOracleRemedy(type, result.violations);
      if (!plan) return;
      remedyPending.current = true;
      setRemedy({ label: plan.label, keys: plan.keys, success: null });
      cli.execute(TaskFactory.askClaude(REMEDY_MODULE, plan.prompt, `Asset Oracle · ${plan.label}`)).catch((e) => {
        remedyPending.current = false;
        setRemedy((prev) => (prev ? { ...prev, success: false } : prev));
        logger.warn('[asset-oracle] remedy dispatch failed', e);
      });
    },
    [result, cli],
  );

  return {
    result, loading, error, scanDelta, diff, sinceLabel, runAnalysis,
    fix, remedy, remedyRunning: cli.isRunning,
  };
}
