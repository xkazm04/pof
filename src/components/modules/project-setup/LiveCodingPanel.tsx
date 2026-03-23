'use client';

import { useState, useCallback } from 'react';
import {
  Cpu, Play, Loader2, CheckCircle2, XCircle, RotateCcw,
  FileCode, ChevronDown, ChevronRight, AlertTriangle, Zap,
  FileText, ArrowRight,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useLiveCoding } from '@/hooks/useLiveCoding';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_VIOLET, ACCENT_ORANGE,
  OPACITY_8, OPACITY_10, OPACITY_15, OPACITY_20,
} from '@/lib/chart-colors';
import type { PofPatchPhase, PofHotPatchDiagnostic } from '@/types/pof-bridge';

// ── Phase pipeline config ────────────────────────────────────────────────────

interface PhaseStep {
  id: PofPatchPhase;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const PIPELINE_STEPS: PhaseStep[] = [
  { id: 'writing_file', label: 'Write', icon: FileCode, color: ACCENT_CYAN },
  { id: 'compiling', label: 'Compile', icon: Cpu, color: ACCENT_ORANGE },
  { id: 'verifying', label: 'Verify', icon: CheckCircle2, color: ACCENT_VIOLET },
  { id: 'complete', label: 'Done', icon: Zap, color: STATUS_SUCCESS },
];

const PHASE_ORDER: PofPatchPhase[] = ['idle', 'writing_file', 'compiling', 'verifying', 'complete', 'reverting', 'reverted', 'failed'];

function phaseIndex(phase: PofPatchPhase): number {
  const idx = PHASE_ORDER.indexOf(phase);
  return idx === -1 ? 0 : idx;
}

function phaseColor(phase: PofPatchPhase): string {
  switch (phase) {
    case 'complete': return STATUS_SUCCESS;
    case 'failed':
    case 'reverted': return STATUS_ERROR;
    case 'reverting': return STATUS_WARNING;
    case 'compiling':
    case 'writing_file': return ACCENT_CYAN;
    case 'verifying': return ACCENT_VIOLET;
    default: return STATUS_NEUTRAL;
  }
}

function phaseLabel(phase: PofPatchPhase): string {
  switch (phase) {
    case 'idle': return 'Idle';
    case 'writing_file': return 'Writing File...';
    case 'compiling': return 'Compiling...';
    case 'verifying': return 'Verifying...';
    case 'complete': return 'Patch Complete';
    case 'reverting': return 'Reverting...';
    case 'reverted': return 'Reverted';
    case 'failed': return 'Failed';
    default: return 'Unknown';
  }
}

// ── History entry ───────────────────────────────────────────────────────────

interface PatchHistoryEntry {
  id: number;
  timestamp: number;
  filePath: string;
  phase: PofPatchPhase;
  durationMs: number;
  errorMessage?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export function LiveCodingPanel() {
  const {
    compile,
    hotPatch,
    result,
    hotPatchResult,
    patchPhase,
    isCompiling,
    isPatching,
    error,
    isAvailable,
    isProbing,
  } = useLiveCoding();

  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<PatchHistoryEntry[]>([]);
  const [hotPatchFile, setHotPatchFile] = useState('');
  const [hotPatchContent, setHotPatchContent] = useState('');
  const [verifyObject, setVerifyObject] = useState('');
  const [verifyFunction, setVerifyFunction] = useState('');
  const [showHotPatchForm, setShowHotPatchForm] = useState(false);
  const [historyCounter, setHistoryCounter] = useState(0);

  const handleCompile = useCallback(async () => {
    await compile();
  }, [compile]);

  const handleHotPatch = useCallback(async () => {
    if (!hotPatchFile.trim() || !hotPatchContent.trim()) return;

    const patchResult = await hotPatch({
      filePath: hotPatchFile.trim(),
      fileContent: hotPatchContent,
      verifyObjectPath: verifyObject.trim() || undefined,
      verifyFunctionName: verifyFunction.trim() || undefined,
    });

    if (patchResult) {
      setHistory((prev) => [{
        id: historyCounter,
        timestamp: Date.now(),
        filePath: patchResult.filePath,
        phase: patchResult.patchPhase,
        durationMs: patchResult.durationMs,
        errorMessage: patchResult.errorMessage,
      }, ...prev].slice(0, 20));
      setHistoryCounter((c) => c + 1);
    }
  }, [hotPatch, hotPatchFile, hotPatchContent, verifyObject, verifyFunction, historyCounter]);

  const isBusy = isCompiling || isPatching;
  const currentPhaseColor = phaseColor(patchPhase);
  const diagnostics = hotPatchResult?.diagnostics ?? [];
  const errorCount = diagnostics.filter((d: PofHotPatchDiagnostic) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d: PofHotPatchDiagnostic) => d.severity === 'warning').length;

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="live-coding-panel">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${ACCENT_EMERALD}${OPACITY_10}` }}
        >
          <Zap className="w-4 h-4" style={{ color: ACCENT_EMERALD }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text">Live Coding Bridge</h3>
          <p className="text-2xs text-text-muted">
            {isProbing ? 'Checking availability...' :
              isAvailable ? (
                <span style={{ color: STATUS_SUCCESS }}>Connected &mdash; Live Coding enabled</span>
              ) : (
                <span style={{ color: STATUS_WARNING }}>Not available &mdash; enable Live Coding in Editor Preferences</span>
              )}
          </p>
        </div>

        {/* Quick compile button */}
        <button
          onClick={handleCompile}
          disabled={isBusy || !isAvailable || isProbing}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
                     border border-border/40 transition-colors
                     enabled:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: ACCENT_EMERALD }}
          title="Trigger Live Coding compile (no file write)"
          data-testid="live-coding-compile-btn"
        >
          {isCompiling
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Play className="w-3 h-3" />
          }
          {isCompiling ? 'Compiling...' : 'Compile'}
        </button>
      </div>

      {/* ── Simple compile result ────────────────────────────────────────── */}
      {result && !isCompiling && (
        <div
          className="px-4 py-2 border-b border-border/40 flex items-center gap-2 text-xs"
          style={{
            backgroundColor: `${result.status === 'success' ? STATUS_SUCCESS : STATUS_ERROR}${OPACITY_8}`,
            color: result.status === 'success' ? STATUS_SUCCESS : STATUS_ERROR,
          }}
        >
          {result.status === 'success'
            ? <CheckCircle2 className="w-3.5 h-3.5" />
            : <XCircle className="w-3.5 h-3.5" />
          }
          <span className="font-medium">
            Compile {result.status === 'success' ? 'succeeded' : 'failed'}
          </span>
          {result.durationMs !== undefined && (
            <span className="text-text-muted ml-auto font-mono">{Math.round(result.durationMs)}ms</span>
          )}
        </div>
      )}

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div
          className="px-4 py-2 border-b border-border/40 flex items-center gap-2 text-xs"
          style={{ backgroundColor: `${STATUS_ERROR}${OPACITY_8}`, color: STATUS_ERROR }}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* ── Hot-Patch Pipeline Visualization ────────────────────────────── */}
      {(isPatching || hotPatchResult) && (
        <div className="px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">
              Hot-Patch Pipeline
            </span>
            <span
              className="ml-auto text-2xs font-medium px-1.5 py-0.5 rounded"
              style={{
                color: currentPhaseColor,
                backgroundColor: `${currentPhaseColor}${OPACITY_15}`,
              }}
            >
              {phaseLabel(patchPhase)}
            </span>
          </div>

          {/* Pipeline steps */}
          <div className="flex items-center gap-0.5">
            {PIPELINE_STEPS.map((step, i) => {
              const stepIdx = PHASE_ORDER.indexOf(step.id);
              const currentIdx = phaseIndex(patchPhase);
              const isActive = step.id === patchPhase;
              const isPast = stepIdx < currentIdx || patchPhase === 'complete';
              const isFailed = (patchPhase === 'failed' || patchPhase === 'reverted') && stepIdx <= currentIdx;
              const StepIcon = step.icon;

              let dotColor = STATUS_NEUTRAL;
              if (isFailed) dotColor = STATUS_ERROR;
              else if (isPast) dotColor = STATUS_SUCCESS;
              else if (isActive) dotColor = step.color;

              return (
                <div key={step.id} className="flex items-center gap-0.5 flex-1">
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded flex-1"
                    style={{
                      backgroundColor: isActive ? `${dotColor}${OPACITY_15}` : 'transparent',
                      border: isActive ? `1px solid ${dotColor}${OPACITY_20}` : '1px solid transparent',
                    }}
                  >
                    <span className="shrink-0" style={{ color: dotColor }}>
                      {isActive && isPatching
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : isPast
                          ? <CheckCircle2 className="w-3 h-3" />
                          : isFailed
                            ? <XCircle className="w-3 h-3" />
                            : <StepIcon className="w-3 h-3" />
                      }
                    </span>
                    <span className="text-2xs font-medium" style={{ color: dotColor }}>
                      {step.label}
                    </span>
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <ArrowRight className="w-3 h-3 shrink-0" style={{ color: STATUS_NEUTRAL }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Revert indicator */}
          {(patchPhase === 'reverting' || patchPhase === 'reverted') && (
            <div
              className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded text-xs"
              style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}`, color: STATUS_WARNING }}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${patchPhase === 'reverting' ? 'animate-spin' : ''}`} />
              <span className="font-medium">
                {patchPhase === 'reverting'
                  ? 'Reverting file to original...'
                  : 'File reverted to original successfully'
                }
              </span>
            </div>
          )}

          {/* Hot-patch result summary */}
          {hotPatchResult && !isPatching && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-muted">File:</span>
                <span className="font-mono text-text truncate">{hotPatchResult.filePath}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-text-muted">Duration:</span>
                <span className="font-mono text-text">{Math.round(hotPatchResult.durationMs)}ms</span>
                {hotPatchResult.verificationOutput && (
                  <>
                    <span className="text-text-muted">Verify:</span>
                    <span
                      className="font-medium"
                      style={{ color: hotPatchResult.verificationPassed ? STATUS_SUCCESS : STATUS_ERROR }}
                    >
                      {hotPatchResult.verificationPassed ? 'PASS' : 'FAIL'}
                    </span>
                  </>
                )}
                {hotPatchResult.fileReverted && (
                  <span
                    className="text-2xs font-medium px-1.5 py-0.5 rounded"
                    style={{ color: STATUS_WARNING, backgroundColor: `${STATUS_WARNING}${OPACITY_15}` }}
                  >
                    Reverted
                  </span>
                )}
              </div>
              {hotPatchResult.errorMessage && (
                <div className="text-xs" style={{ color: STATUS_ERROR }}>
                  {hotPatchResult.errorMessage}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Diagnostics ────────────────────────────────────────────────── */}
      {diagnostics.length > 0 && (
        <div className="border-b border-border/40">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
          >
            {showDiagnostics
              ? <ChevronDown className="w-3 h-3 text-text-muted" />
              : <ChevronRight className="w-3 h-3 text-text-muted" />
            }
            <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">Diagnostics</span>
            {errorCount > 0 && (
              <span
                className="text-2xs font-mono px-1 rounded"
                style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_15}` }}
              >
                {errorCount} error{errorCount > 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span
                className="text-2xs font-mono px-1 rounded"
                style={{ color: STATUS_WARNING, backgroundColor: `${STATUS_WARNING}${OPACITY_15}` }}
              >
                {warningCount} warning{warningCount > 1 ? 's' : ''}
              </span>
            )}
          </button>
          {showDiagnostics && (
            <div className="px-4 pb-2 space-y-1 max-h-48 overflow-y-auto">
              {diagnostics.map((d: PofHotPatchDiagnostic, i: number) => (
                <div key={i} className="flex items-start gap-2 text-2xs font-mono">
                  <span
                    className="shrink-0 px-1 rounded uppercase font-bold"
                    style={{
                      color: d.severity === 'error' ? STATUS_ERROR : STATUS_WARNING,
                      backgroundColor: `${d.severity === 'error' ? STATUS_ERROR : STATUS_WARNING}${OPACITY_15}`,
                    }}
                  >
                    {d.severity}
                  </span>
                  {d.file && (
                    <span className="text-text-muted shrink-0">
                      {d.file.split(/[\\/]/).pop()}:{d.line}
                    </span>
                  )}
                  <span className="text-text break-all">{d.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Hot-Patch Form ─────────────────────────────────────────────── */}
      <div className="border-b border-border/40">
        <button
          onClick={() => setShowHotPatchForm(!showHotPatchForm)}
          className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
        >
          {showHotPatchForm
            ? <ChevronDown className="w-3 h-3 text-text-muted" />
            : <ChevronRight className="w-3 h-3 text-text-muted" />
          }
          <FileCode className="w-3.5 h-3.5" style={{ color: ACCENT_CYAN }} />
          <span className="text-2xs font-bold uppercase tracking-wider" style={{ color: ACCENT_CYAN }}>
            Hot-Patch
          </span>
          <span className="text-2xs text-text-muted">Write &rarr; Compile &rarr; Verify &rarr; Auto-Revert</span>
        </button>

        {showHotPatchForm && (
          <div className="px-4 pb-3 space-y-2">
            {/* File path */}
            <div className="space-y-1">
              <label className="text-2xs font-bold text-text-muted uppercase tracking-wider">
                File Path <span className="normal-case font-normal">(absolute .cpp/.h path)</span>
              </label>
              <input
                type="text"
                value={hotPatchFile}
                onChange={(e) => setHotPatchFile(e.target.value)}
                placeholder="C:/Users/.../Source/MyProject/MyClass.cpp"
                className="w-full px-2 py-1 rounded text-xs font-mono bg-background border border-border/40 text-text
                           focus:outline-none focus:border-[color:var(--focus-border)]"
                data-testid="hot-patch-file-input"
              />
            </div>

            {/* File content */}
            <div className="space-y-1">
              <label className="text-2xs font-bold text-text-muted uppercase tracking-wider">
                File Content
              </label>
              <textarea
                value={hotPatchContent}
                onChange={(e) => setHotPatchContent(e.target.value)}
                placeholder="#include &quot;MyClass.h&quot;&#10;// ... your C++ code"
                rows={6}
                className="w-full px-2 py-1 rounded text-xs font-mono bg-background border border-border/40 text-text
                           resize-y focus:outline-none focus:border-[color:var(--focus-border)]"
                data-testid="hot-patch-content-input"
              />
            </div>

            {/* Verification (optional) */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-2xs font-bold text-text-muted uppercase tracking-wider">
                  Verify Object <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={verifyObject}
                  onChange={(e) => setVerifyObject(e.target.value)}
                  placeholder="/Game/Maps/TestMap.TestMap:PersistentLevel.MyActor"
                  className="w-full px-2 py-1 rounded text-xs font-mono bg-background border border-border/40 text-text
                             focus:outline-none focus:border-[color:var(--focus-border)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-2xs font-bold text-text-muted uppercase tracking-wider">
                  Verify Function <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={verifyFunction}
                  onChange={(e) => setVerifyFunction(e.target.value)}
                  placeholder="VerifyHotPatch"
                  className="w-full px-2 py-1 rounded text-xs font-mono bg-background border border-border/40 text-text
                             focus:outline-none focus:border-[color:var(--focus-border)]"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleHotPatch}
              disabled={isBusy || !isAvailable || !hotPatchFile.trim() || !hotPatchContent.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                         border transition-colors
                         enabled:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                color: ACCENT_CYAN,
                borderColor: `${ACCENT_CYAN}${OPACITY_20}`,
              }}
              data-testid="hot-patch-submit-btn"
            >
              {isPatching
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Zap className="w-3.5 h-3.5" />
              }
              {isPatching ? 'Patching...' : 'Execute Hot-Patch'}
            </button>
          </div>
        )}
      </div>

      {/* ── History ─────────────────────────────────────────────────────── */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
        >
          {showHistory
            ? <ChevronDown className="w-3 h-3 text-text-muted" />
            : <ChevronRight className="w-3 h-3 text-text-muted" />
          }
          <FileText className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">History</span>
          {history.length > 0 && (
            <span className="text-2xs text-text-muted">{history.length}</span>
          )}
        </button>
        {showHistory && (
          <div className="px-4 pb-2 space-y-1 max-h-40 overflow-y-auto">
            {history.length === 0 && (
              <p className="text-2xs text-text-muted py-1">No hot-patches yet</p>
            )}
            {history.map((entry) => {
              const entryColor = phaseColor(entry.phase);
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 text-2xs py-1"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: entryColor }}
                  />
                  <span className="font-mono text-text-muted w-16 shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="font-mono text-text truncate flex-1">
                    {entry.filePath.split(/[\\/]/).pop()}
                  </span>
                  <span
                    className="font-medium px-1 rounded shrink-0"
                    style={{ color: entryColor, backgroundColor: `${entryColor}${OPACITY_15}` }}
                  >
                    {phaseLabel(entry.phase)}
                  </span>
                  <span className="font-mono text-text-muted w-14 text-right shrink-0">
                    {Math.round(entry.durationMs)}ms
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}
