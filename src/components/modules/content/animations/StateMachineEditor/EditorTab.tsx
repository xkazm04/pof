'use client';

import { useCallback, useMemo, useRef } from 'react';
import { RefreshCw, ScanSearch } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useManifest } from '@/hooks/useManifest';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { STATUS_ERROR, OPACITY_15, OPACITY_30 } from '@/lib/chart-colors';
import { useAnimBpScan } from '../AnimationStateMachine/useAnimBpScan';
import { StateMachineEditor } from './index';
import { EDITOR_ACCENT } from './constants';
import { seedFromScan, seedFromBridge, type EditorSeed } from './seed';
import { buildApplyPrompt, type ApplyPlan } from './applyPlan';

/**
 * The visual AnimBP state-machine editor, wired to the project.
 *
 * The editor itself is source-agnostic; this tab decides what it opens on. The
 * live UE bridge wins over a source scan (it reflects the compiled asset), a
 * scan wins over nothing, and with neither the editor opens on its template and
 * says so — the same precedence the read-only graph next door uses
 * (`resolveGraphProvenance`).
 *
 * The scan is operator-triggered, exactly as in the read-only graph: it walks
 * the project's C++ sources, so it is never fired on mount.
 *
 * Apply: a confirmed ready plan is ONE quick-action task on the module's CLI
 * rail (prompt = `buildApplyPrompt(plan)`). On success the editor is told
 * (`markApplied`) and the project is re-scanned; the editor rebases onto that
 * scan only if it matches the canvas. A failed run leaves the draft alone.
 */
export function StateMachineEditorTab() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectName = useProjectStore((s) => s.projectName);
  const { scanResult, isScanning, scanError, handleScan } = useAnimBpScan(projectPath, projectName);
  const { manifest, isConnected: bridgeConnected } = useManifest();

  const bridgeSeed = useMemo<EditorSeed | null>(() => {
    if (!bridgeConnected || !manifest?.animAssets?.length) return null;
    const bp = manifest.animAssets.find(
      (a) => a.assetType === 'AnimBlueprint' && a.stateMachines && a.stateMachines.length > 0,
    );
    if (!bp) return null;
    return seedFromBridge(bp.stateMachines ?? null, bp.path);
  }, [bridgeConnected, manifest]);

  const scanSeed = useMemo(() => seedFromScan(scanResult), [scanResult]);
  const seed = bridgeSeed ?? scanSeed;

  // One draft per project: switching projects must not restore another
  // project's unsaved canvas over this one.
  const draftKey = `anim-sm-editor:${projectPath || 'no-project'}`;

  const markAppliedRef = useRef<(() => void) | null>(null);
  const applyCli = useModuleCLI({
    moduleId: 'animations',
    sessionKey: 'animations-sm-editor-apply',
    label: 'Apply SM edits',
    accentColor: EDITOR_ACCENT,
    onComplete: (success) => {
      if (!success) return;
      markAppliedRef.current?.();
      void handleScan();
    },
  });
  const { execute } = applyCli;
  const handleApply = useCallback((plan: ApplyPlan, markApplied: () => void) => {
    markAppliedRef.current = markApplied;
    void execute(TaskFactory.quickAction('animations', buildApplyPrompt(plan), 'Apply SM edits'));
  }, [execute]);

  return (
    <div className="space-y-3" data-testid="pof-anim-sm-editor-tab">
      <div className="flex items-center gap-2">
        <button
          onClick={handleScan}
          disabled={isScanning || !projectPath || !projectName}
          data-testid="pof-anim-sm-editor-scan"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
          style={{
            backgroundColor: `${EDITOR_ACCENT}${OPACITY_15}`,
            color: EDITOR_ACCENT,
            border: `1px solid ${EDITOR_ACCENT}${OPACITY_30}`,
          }}
          title={projectPath ? 'Scan the project AnimInstance and seed the canvas from it' : 'Set up a project first'}
        >
          {isScanning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ScanSearch className="w-3 h-3" />}
          {isScanning ? 'Scanning…' : 'Scan AnimBP'}
        </button>
        {!projectPath && (
          <span className="text-xs text-text-muted">No project configured — the canvas can only show the template.</span>
        )}
      </div>

      {scanError && (
        <div data-testid="pof-anim-sm-editor-scan-error" className="text-xs font-mono" style={{ color: STATUS_ERROR }}>
          {scanError}
        </div>
      )}

      <StateMachineEditor seed={seed} draftKey={draftKey} onApply={handleApply} applyRunning={applyCli.isRunning} />
    </div>
  );
}
