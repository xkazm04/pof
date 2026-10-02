'use client';

import { useMemo, useState } from 'react';
import {
  Code, FileCode, ArrowRight, AlertTriangle,
  XCircle, Loader2, Upload, RefreshCw, ChevronDown,
} from 'lucide-react';
import type { BlueprintAsset, TranspileResult } from '@/types/blueprint';
import { describeTranspileFidelity } from '@/lib/blueprint-cpp-codegen';
import { buildResidue, type ResidueFile } from '@/lib/blueprint-transpiler/residue';
import { CodeViewer } from '@/components/ui/CodeViewer';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import { TermChip, DecoratedJargon } from '@/components/ui/TermChip';
import { OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import { ACCENT } from './constants';
import { WriteToProjectButton } from './WriteToProjectButton';
import { ResidueList } from './ResidueList';

const LEDGER_TITLE = 'Counted per node from the transpiler\'s ledger: emitted statements and the variables they read are translated; '
  + 'refused nodes left a // TODO stub; never-reached nodes were not evaluated. Click to list them.';
const WARNING_TITLE = 'Counted from the transpiler\'s own warnings: every node it refused to translate raises one carrying that node\'s id.';

/** A jump to a stub, bound to the result it was computed from; `seq` re-reveals a repeated click. */
interface StubFocus { result: TranspileResult; file: ResidueFile; line: number; seq: number }

// ─── Transpile Pane ─────────────────────────────────────────────────────────

export function TranspilePane({
  blueprintJson, setBlueprintJson,
  onTranspile, onLoadSample,
  isLoading, error, asset, summary, result, stale = false,
  showCode, setShowCode,
  moduleName, onModuleChange, projectPath,
}: {
  blueprintJson: string;
  setBlueprintJson: (v: string) => void;
  onTranspile: () => void;
  onLoadSample: () => void;
  isLoading: boolean;
  error: string | null;
  asset: BlueprintAsset | null;
  summary: string | null;
  result: TranspileResult | null;
  /** The Blueprint JSON changed since `result` was generated from it. */
  stale?: boolean;
  showCode: 'header' | 'source';
  setShowCode: (v: 'header' | 'source') => void;
  /** Target C++ module — decides the API macro AND the Source/<Module>/ path. */
  moduleName: string;
  onModuleChange: (next: string) => void;
  projectPath: string;
}) {
  // Counted from the result's per-node ledger (warning list for an older payload) — never a constant.
  const fidelity = describeTranspileFidelity(result ?? { warnings: [], nodeCount: 0 });
  const residue = useMemo(() => (result ? buildResidue(result) : []), [result]);
  const [residueOpen, setResidueOpen] = useState(false);
  const [focus, setFocus] = useState<StubFocus | null>(null);
  const focusLine = focus && focus.result === result && focus.file === showCode ? focus.line : null;

  function openStub(file: ResidueFile, line: number) {
    setShowCode(file);
    setFocus((prev) => ({ result: result as TranspileResult, file, line, seq: (prev?.seq ?? 0) + 1 }));
  }

  return (
    <div className="flex flex-col md:flex-row h-full overflow-auto md:overflow-hidden">
      {/* Left: Input */}
      <div className="w-full md:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-border min-h-[280px] md:min-h-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-deep">
          <div className="flex items-center gap-2">
            <Upload className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs font-medium text-text">Blueprint JSON</span>
          </div>
          <button
            onClick={onLoadSample}
            className="text-2xs px-2 py-0.5 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            Load Sample
          </button>
        </div>
        <textarea
          className="flex-1 min-h-[160px] p-3 bg-background text-xs font-mono text-text resize-none focus:outline-none placeholder-text-muted"
          placeholder="Paste Blueprint JSON here (from UE5 commandlet export or copy graph)..."
          value={blueprintJson}
          onChange={(e) => setBlueprintJson(e.target.value)}
          spellCheck={false}
        />
        <div className="px-3 py-2 border-t border-border flex items-center justify-between gap-2 flex-wrap">
          <div className="text-2xs text-text-muted">
            {blueprintJson ? `${blueprintJson.length.toLocaleString()} chars` : 'No input'}
          </div>
          <button
            onClick={onTranspile}
            disabled={!blueprintJson.trim() || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40"
            style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, border: `1px solid ${ACCENT}${OPACITY_30}` }}
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
            Transpile to C++
          </button>
        </div>
      </div>

      {/* Right: Output */}
      <div className="w-full md:w-1/2 flex flex-col min-h-[280px] md:min-h-0">
        {error && (
          <div className="px-3 py-2 bg-status-red-subtle border-b border-status-red-strong text-xs text-red-400 flex items-center gap-2">
            <XCircle className="w-3.5 h-3.5" /> {error}
          </div>
        )}

        {!result && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-3 px-8">
            <Code className="w-10 h-10 opacity-30" />
            <p className="text-xs text-center">
              Paste Blueprint JSON on the left and click Transpile to generate C++ with proper{' '}
              <TermChip term="UPROPERTY" />/<TermChip term="UFUNCTION" /> bindings.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
            <span className="text-xs text-text-muted">Transpiling Blueprint graph...</span>
          </div>
        )}

        {result && (
          <>
            {/* Stats bar */}
            <div className="px-3 py-2 border-b border-border bg-surface-deep flex items-center gap-4">
              <span className="text-2xs text-text-muted">
                <strong className="text-text">{result.className}</strong> : {result.parentClass}
              </span>
              <span className="text-2xs text-text-muted">{result.functionCount} functions</span>
              {/* Fidelity — how much of the graph actually became code. Always
                  shown: the warning badge below appears only when non-empty, so
                  a body the walker refused to write used to read as a clean
                  transpile with nothing stating otherwise. With residue it is
                  the toggle for the worklist of every untranslated node. */}
              {residue.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setResidueOpen((o) => !o)}
                  aria-expanded={residueOpen}
                  aria-controls="transpile-residue"
                  title={LEDGER_TITLE}
                  className="flex items-center gap-1 text-2xs text-amber-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-bright rounded"
                >
                  <span data-testid="transpile-fidelity">{fidelity.label}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${residueOpen ? 'rotate-180' : ''}`} aria-hidden />
                </button>
              ) : (
                <span
                  data-testid="transpile-fidelity"
                  className={`text-2xs ${fidelity.todo > 0 ? 'text-amber-400' : 'text-text-muted'}`}
                  title={fidelity.perNode ? LEDGER_TITLE : WARNING_TITLE}
                >
                  {fidelity.label}
                </span>
              )}
              {result.warnings.length > 0 && (
                <span className="text-2xs text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {result.warnings.length} warnings
                </span>
              )}
            </div>

            {residueOpen && residue.length > 0 && (
              <div id="transpile-residue">
                <ResidueList entries={residue} onLocate={openStub} />
              </div>
            )}

            {/* Code tabs */}
            <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border">
              <button
                onClick={() => setShowCode('header')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-colors ${
                  showCode === 'header' ? 'bg-surface-hover text-text' : 'text-text-muted hover:text-text'
                }`}
              >
                <FileCode className="w-3 h-3" />
                {result.className}.h
              </button>
              <button
                onClick={() => setShowCode('source')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-colors ${
                  showCode === 'source' ? 'bg-surface-hover text-text' : 'text-text-muted hover:text-text'
                }`}
              >
                <Code className="w-3 h-3" />
                {result.className}.cpp
              </button>
              <div className="ml-auto flex items-center gap-1">
                {/* Code generated from a Blueprint that is no longer the input
                    must not reach the project: offer the re-transpile instead. */}
                {stale ? (
                  <button
                    onClick={onTranspile}
                    disabled={isLoading || !blueprintJson.trim()}
                    title="The code below was generated from an earlier version of the Blueprint JSON"
                    className="flex items-center gap-1 px-2 py-1 rounded text-2xs text-amber-400 border border-amber-400/40 disabled:opacity-40"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Blueprint changed - re-transpile
                  </button>
                ) : (
                  <WriteToProjectButton
                    className={result.className}
                    header={result.headerCode}
                    source={result.sourceCode}
                    projectPath={projectPath}
                    moduleName={moduleName}
                    onModuleChange={onModuleChange}
                  />
                )}
              </div>
            </div>

            {/* Code display — Shiki-highlighted with copy + download (shared CodeViewer) */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <CodeViewer
                key={focus?.seq ?? 0}
                code={showCode === 'header' ? result.headerCode : result.sourceCode}
                fileName={`${result.className}.${showCode === 'header' ? 'h' : 'cpp'}`}
                lang="cpp"
                maxHeightClass="max-h-full"
                focusLine={focusLine}
              />
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="border-t border-border max-h-32 overflow-y-auto">
                <StaggerContainer className="p-2 space-y-1">
                  {result.warnings.map((w, i) => (
                    <StaggerItem key={i} className="flex items-start gap-2 px-2 py-1 rounded bg-surface text-2xs">
                      <AlertTriangle className={`w-3 h-3 flex-shrink-0 mt-0.5 ${
                        w.severity === 'error' ? 'text-red-400' : w.severity === 'warning' ? 'text-amber-400' : 'text-text-muted'
                      }`} />
                      <DecoratedJargon text={w.message} className="text-text-muted" />
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </div>
            )}
          </>
        )}

        {/* Summary panel */}
        {asset && summary && !result && !isLoading && (
          <div className="p-4">
            <h3 className="text-xs font-semibold text-text mb-2">Parsed Blueprint</h3>
            <pre className="text-2xs font-mono text-text-muted whitespace-pre-wrap leading-relaxed">{summary}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
