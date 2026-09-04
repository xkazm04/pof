'use client';

import {
  Code, GitCompare, XCircle, CheckCircle2, Loader2, Upload,
} from 'lucide-react';
import { useBlueprintTranspiler } from '@/hooks/useBlueprintTranspiler';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import { OPACITY_20, OPACITY_30, STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import { ACCENT, CONFLICT_STYLES } from './constants';
import { ChangeCard } from './ChangeCard';

// ─── Diff Pane ──────────────────────────────────────────────────────────────

export function DiffPane({
  blueprintJson, setBlueprintJson,
  existingCpp, setExistingCpp,
  onDiff, onLoadSample,
  isLoading, error, result,
}: {
  blueprintJson: string;
  setBlueprintJson: (v: string) => void;
  existingCpp: string;
  setExistingCpp: (v: string) => void;
  onDiff: () => void;
  onLoadSample: () => void;
  isLoading: boolean;
  error: string | null;
  result: ReturnType<typeof useBlueprintTranspiler>['diffResult'];
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Input area — stacks on narrow viewports, side-by-side on md+ */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Left: Blueprint JSON */}
        <div className="w-full md:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-border min-h-[200px] md:min-h-0">
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
            className="flex-1 min-h-[140px] p-3 bg-background text-xs font-mono text-text resize-none focus:outline-none placeholder-text-muted"
            placeholder="Paste Blueprint JSON..."
            value={blueprintJson}
            onChange={(e) => setBlueprintJson(e.target.value)}
            spellCheck={false}
          />
        </div>

        {/* Right: Existing C++ */}
        <div className="w-full md:w-1/2 flex flex-col min-h-[200px] md:min-h-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-deep">
            <Code className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs font-medium text-text">Existing C++</span>
          </div>
          <textarea
            className="flex-1 min-h-[140px] p-3 bg-background text-xs font-mono text-text resize-none focus:outline-none placeholder-text-muted"
            placeholder="Paste existing C++ header/source to compare..."
            value={existingCpp}
            onChange={(e) => setExistingCpp(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Action bar */}
      <div className="px-3 py-2 border-t border-border flex items-center justify-between gap-2 flex-wrap">
        <div className="text-2xs text-text-muted">
          {blueprintJson ? `BP: ${blueprintJson.length.toLocaleString()} chars` : 'No Blueprint'}
          {' · '}
          {existingCpp ? `C++: ${existingCpp.length.toLocaleString()} chars` : 'No C++'}
        </div>
        <button
          onClick={onDiff}
          disabled={!blueprintJson.trim() || !existingCpp.trim() || isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40"
          style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, border: `1px solid ${ACCENT}${OPACITY_30}` }}
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
          Run Semantic Diff
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-status-red-subtle border-t border-status-red-strong text-xs text-red-400 flex items-center gap-2">
          <XCircle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {/* Diff results — shares vertical space with inputs via flex-1; grows past 50% on tall viewports */}
      {result && (
        <div className="border-t border-border flex-1 min-h-[200px] overflow-y-auto">
          {/* Summary */}
          <div className="px-4 py-3 border-b border-border bg-surface-deep flex items-center gap-4">
            {(() => {
              const style = CONFLICT_STYLES[result.overallConflict];
              const StatusIcon = style.icon;
              return (
                <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: style.color }}>
                  <StatusIcon className="w-4 h-4" />
                  {style.label}
                </span>
              );
            })()}
            <span className="text-2xs text-text-muted">{result.changes.length} changes detected</span>
            <span className="text-2xs text-text-muted">{result.blueprintSummary}</span>
          </div>

          {/* Fidelity rung — what this comparison can and cannot prove.
              Standard: visual-script-to-code-transpilation / the fidelity ladder. */}
          <details className="px-4 py-2 border-b border-border">
            <summary className="text-2xs text-text-muted cursor-pointer focus-ring rounded">
              Rung: <span className="font-mono text-text">{result.fidelityRung}</span>
              {' · '}
              {result.notCompared.length} dimensions NOT compared
            </summary>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <div>
                <div className="text-2xs font-medium text-text mb-1">Compared</div>
                <ul className="space-y-0.5">
                  {result.comparedDimensions.map((d) => (
                    <li key={d} className="text-2xs text-text-muted">· {d}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-2xs font-medium text-text mb-1">Not compared</div>
                <ul className="space-y-0.5">
                  {result.notCompared.map((d) => (
                    <li key={d} className="text-2xs" style={{ color: STATUS_WARNING }}>· {d}</li>
                  ))}
                </ul>
              </div>
            </div>
          </details>

          {/* Change list */}
          {result.changes.length > 0 ? (
            <StaggerContainer className="p-2 space-y-1">
              {result.changes.map((change) => (
                <StaggerItem key={change.id}>
                  <ChangeCard change={change} />
                </StaggerItem>
              ))}
            </StaggerContainer>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-8 px-6 text-text-muted text-center">
              <span className="flex items-center gap-2 text-xs text-text">
                <CheckCircle2 className="w-5 h-5" style={{ color: STATUS_SUCCESS }} />
                No divergence in the {result.comparedDimensions.length} dimensions compared
              </span>
              <span className="text-2xs">
                This is the <span className="font-mono">{result.fidelityRung}</span> rung: declarations match.
                It is not proof the two sides behave the same.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
