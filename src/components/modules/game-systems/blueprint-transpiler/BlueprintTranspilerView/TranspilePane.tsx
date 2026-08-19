'use client';

import {
  Code, FileCode, ArrowRight, AlertTriangle,
  XCircle, Loader2, Upload,
} from 'lucide-react';
import { useBlueprintTranspiler } from '@/hooks/useBlueprintTranspiler';
import { CodeViewer } from '@/components/ui/CodeViewer';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import { TermChip, DecoratedJargon } from '@/components/ui/TermChip';
import { OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import { ACCENT } from './constants';
import { WriteToProjectButton } from './WriteToProjectButton';

// ─── Transpile Pane ─────────────────────────────────────────────────────────

export function TranspilePane({
  blueprintJson, setBlueprintJson,
  onTranspile, onLoadSample,
  isLoading, error, asset, summary, result,
  showCode, setShowCode,
  moduleName, onModuleChange, projectPath,
}: {
  blueprintJson: string;
  setBlueprintJson: (v: string) => void;
  onTranspile: () => void;
  onLoadSample: () => void;
  isLoading: boolean;
  error: string | null;
  asset: ReturnType<typeof useBlueprintTranspiler>['asset'];
  summary: string | null;
  result: ReturnType<typeof useBlueprintTranspiler>['transpileResult'];
  showCode: 'header' | 'source';
  setShowCode: (v: 'header' | 'source') => void;
  /** Target C++ module — decides the API macro AND the Source/<Module>/ path. */
  moduleName: string;
  onModuleChange: (next: string) => void;
  projectPath: string;
}) {
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
              <span className="text-2xs text-text-muted">{result.nodeCount} nodes</span>
              <span className="text-2xs text-text-muted">{result.functionCount} functions</span>
              {result.warnings.length > 0 && (
                <span className="text-2xs text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {result.warnings.length} warnings
                </span>
              )}
            </div>

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
                <WriteToProjectButton
                  className={result.className}
                  header={result.headerCode}
                  source={result.sourceCode}
                  projectPath={projectPath}
                  moduleName={moduleName}
                  onModuleChange={onModuleChange}
                />
              </div>
            </div>

            {/* Code display — Shiki-highlighted with copy + download (shared CodeViewer) */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <CodeViewer
                code={showCode === 'header' ? result.headerCode : result.sourceCode}
                fileName={`${result.className}.${showCode === 'header' ? 'h' : 'cpp'}`}
                lang="cpp"
                maxHeightClass="max-h-full"
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
