'use client';

import { useState, useCallback } from 'react';
import {
  Code, FileCode, ArrowRight, AlertTriangle, CheckCircle2,
  XCircle, Loader2, Clipboard, ClipboardCheck, RotateCcw,
  GitCompare, ChevronDown, ChevronRight, Upload, Save,
} from 'lucide-react';
import { useBlueprintTranspiler } from '@/hooks/useBlueprintTranspiler';
import { useProjectStore } from '@/stores/projectStore';
import { apiFetch } from '@/lib/api-utils';
import { PromptDiffView } from '@/components/modules/evaluator/PromptDiffView';
import type { WritePlan } from '@/lib/blueprint-transpiler-write';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import { TermChip, DecoratedJargon } from '@/components/ui/TermChip';
import type { TranspilerTab, SemanticChange, DiffConflictLevel } from '@/types/blueprint';
import { UI_TIMEOUTS } from '@/lib/constants';
import { CHANGE_TYPE_META } from '@/lib/blueprint-jargon';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  OPACITY_15, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';

const ACCENT = MODULE_COLORS.systems;

const TAB_CONFIG: { id: TranspilerTab; label: string; icon: typeof Code }[] = [
  { id: 'transpile', label: 'Transpile', icon: ArrowRight },
  { id: 'diff', label: 'Semantic Diff', icon: GitCompare },
];

const CONFLICT_STYLES: Record<DiffConflictLevel, { color: string; bg: string; label: string; icon: typeof CheckCircle2 }> = {
  none: { color: STATUS_SUCCESS, bg: `${STATUS_SUCCESS}${OPACITY_15}`, label: 'No Conflicts', icon: CheckCircle2 },
  compatible: { color: STATUS_WARNING, bg: `${STATUS_WARNING}${OPACITY_15}`, label: 'Compatible Changes', icon: AlertTriangle },
  conflict: { color: STATUS_ERROR, bg: `${STATUS_ERROR}${OPACITY_15}`, label: 'Conflicts Detected', icon: XCircle },
};

const SAMPLE_BLUEPRINT = JSON.stringify({
  ClassName: 'BP_PlayerCharacter',
  ParentClass: 'ACharacter',
  Variables: [
    { VarName: 'Health', VarType: 'float', PropertyFlags: ['CPF_Edit'], DefaultValue: '100.0', Tooltip: 'Current health points' },
    { VarName: 'MaxHealth', VarType: 'float', PropertyFlags: ['CPF_Edit'], DefaultValue: '100.0' },
    { VarName: 'MoveSpeed', VarType: 'float', PropertyFlags: ['CPF_Edit'], DefaultValue: '600.0' },
    { VarName: 'bIsDead', VarType: 'bool', DefaultValue: 'false' },
  ],
  Graphs: [
    {
      GraphName: 'EventGraph',
      GraphType: 'event',
      Nodes: [
        { NodeGuid: 'n1', NodeClass: 'K2Node_Event', Name: 'BeginPlay', MemberName: 'BeginPlay', Pins: [{ PinName: 'exec', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output', LinkedTo: ['n2'] }], NodePosX: 0, NodePosY: 0 },
        { NodeGuid: 'n2', NodeClass: 'K2Node_CallFunction', Name: 'PrintString', MemberName: 'PrintString', Pins: [{ PinName: 'exec', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Input' }, { PinName: 'InString', PinType: { PinCategory: 'string' }, Direction: 'EGPD_Input', DefaultValue: 'Player Spawned!' }, { PinName: 'exec', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output' }], NodePosX: 300, NodePosY: 0 },
        { NodeGuid: 'n3', NodeClass: 'K2Node_Event', Name: 'Tick', MemberName: 'Tick', Pins: [{ PinName: 'exec', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output' }], NodePosX: 0, NodePosY: 200 },
      ],
    },
    {
      GraphName: 'TakeDamage',
      GraphType: 'function',
      Nodes: [
        { NodeGuid: 'f1', NodeClass: 'K2Node_FunctionEntry', Name: 'Entry', Pins: [{ PinName: 'DamageAmount', PinType: { PinCategory: 'float' }, Direction: 'EGPD_Output' }, { PinName: 'exec', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output', LinkedTo: ['f2'] }], NodePosX: 0, NodePosY: 0 },
        { NodeGuid: 'f2', NodeClass: 'K2Node_VariableSet', Name: 'Set Health', MemberName: 'Health', Pins: [{ PinName: 'exec', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Input' }, { PinName: 'Health', PinType: { PinCategory: 'float' }, Direction: 'EGPD_Input', DefaultValue: 'Health - DamageAmount' }], NodePosX: 300, NodePosY: 0 },
      ],
    },
  ],
}, null, 2);

export function BlueprintTranspilerView() {
  const [activeTab, setActiveTab] = useState<TranspilerTab>('transpile');
  const [copiedHeader, setCopiedHeader] = useState(false);
  const [copiedSource, setCopiedSource] = useState(false);
  const [showCode, setShowCode] = useState<'header' | 'source'>('header');

  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const {
    blueprintJson, setBlueprintJson,
    existingCpp, setExistingCpp,
    asset, summary,
    transpileResult, diffResult,
    isLoading, error,
    parse, transpile, diff, reset,
  } = useBlueprintTranspiler();

  const handleTranspile = useCallback(async () => {
    if (!blueprintJson.trim()) return;
    await parse(blueprintJson);
    await transpile(blueprintJson, projectName || undefined);
  }, [blueprintJson, projectName, parse, transpile]);

  const handleDiff = useCallback(async () => {
    if (!blueprintJson.trim() || !existingCpp.trim()) return;
    await parse(blueprintJson);
    await diff(blueprintJson, existingCpp, projectName || undefined);
  }, [blueprintJson, existingCpp, projectName, parse, diff]);

  const handleLoadSample = useCallback(() => {
    setBlueprintJson(SAMPLE_BLUEPRINT);
  }, [setBlueprintJson]);

  const copyToClipboard = useCallback(async (text: string, which: 'header' | 'source') => {
    await navigator.clipboard.writeText(text);
    if (which === 'header') { setCopiedHeader(true); setTimeout(() => setCopiedHeader(false), UI_TIMEOUTS.copyFeedback); }
    else { setCopiedSource(true); setTimeout(() => setCopiedSource(false), UI_TIMEOUTS.copyFeedback); }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-border">
        {TAB_CONFIG.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-surface-hover text-text'
                  : 'text-text-muted hover:text-text hover:bg-surface'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          {(transpileResult || diffResult || asset) && (
            <button
              onClick={reset}
              className="flex items-center gap-1 px-2 py-1 rounded text-2xs text-text-muted hover:text-text transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'transpile' ? (
          <TranspilePane
            blueprintJson={blueprintJson}
            setBlueprintJson={setBlueprintJson}
            onTranspile={handleTranspile}
            onLoadSample={handleLoadSample}
            isLoading={isLoading}
            error={error}
            asset={asset}
            summary={summary}
            result={transpileResult}
            showCode={showCode}
            setShowCode={setShowCode}
            copiedHeader={copiedHeader}
            copiedSource={copiedSource}
            onCopy={copyToClipboard}
            projectName={projectName}
            projectPath={projectPath}
          />
        ) : (
          <DiffPane
            blueprintJson={blueprintJson}
            setBlueprintJson={setBlueprintJson}
            existingCpp={existingCpp}
            setExistingCpp={setExistingCpp}
            onDiff={handleDiff}
            onLoadSample={handleLoadSample}
            isLoading={isLoading}
            error={error}
            result={diffResult}
          />
        )}
      </div>
    </div>
  );
}

// ─── Transpile Pane ─────────────────────────────────────────────────────────

function TranspilePane({
  blueprintJson, setBlueprintJson,
  onTranspile, onLoadSample,
  isLoading, error, asset, summary, result,
  showCode, setShowCode,
  copiedHeader, copiedSource, onCopy,
  projectName, projectPath,
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
  copiedHeader: boolean;
  copiedSource: boolean;
  onCopy: (text: string, which: 'header' | 'source') => void;
  projectName: string;
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
                  defaultModule={sanitizeModule(projectName)}
                />
                <button
                  onClick={() => onCopy(
                    showCode === 'header' ? result.headerCode : result.sourceCode,
                    showCode,
                  )}
                  className="flex items-center gap-1 px-2 py-1 rounded text-2xs text-text-muted hover:text-text transition-colors"
                >
                  {(showCode === 'header' ? copiedHeader : copiedSource) ? (
                    <><ClipboardCheck className="w-3 h-3 text-green-400" /> Copied</>
                  ) : (
                    <><Clipboard className="w-3 h-3" /> Copy</>
                  )}
                </button>
              </div>
            </div>

            {/* Code display */}
            <pre className="flex-1 overflow-auto p-3 text-xs font-mono text-text leading-relaxed whitespace-pre">
              {showCode === 'header' ? result.headerCode : result.sourceCode}
            </pre>

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

// ─── Diff Pane ──────────────────────────────────────────────────────────────

function DiffPane({
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
            <div className="flex items-center justify-center py-8 text-text-muted">
              <CheckCircle2 className="w-5 h-5 mr-2 text-green-400" />
              <span className="text-xs">Blueprint and C++ are in sync</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Change Card ────────────────────────────────────────────────────────────

function ChangeCard({ change }: { change: SemanticChange }) {
  const [expanded, setExpanded] = useState(false);
  const conflictStyle = CONFLICT_STYLES[change.conflictLevel];

  const t = CHANGE_TYPE_META[change.type] ?? CHANGE_TYPE_META.modify;

  return (
    <div
      className="rounded-lg border border-border bg-surface px-3 py-2 cursor-pointer hover:border-border-bright transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        {expanded ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
        <TermChip
          term={t.code}
          underline={false}
          className="font-bold px-1.5 py-0.5 rounded"
          style={{ color: t.color, backgroundColor: `${t.color}15` }}
        />
        <TermChip term={change.scope} className="uppercase text-text-muted" />
        <span className="text-xs font-medium text-text">{change.name}</span>
        <span
          className="ml-auto w-2 h-2 rounded-full"
          style={{ backgroundColor: conflictStyle.color }}
        />
      </div>

      {expanded && (
        <div className="mt-2 ml-5 space-y-1.5">
          <p className="text-2xs text-text-muted">{change.description}</p>
          {change.blueprintSide && (
            <div className="flex items-start gap-2">
              <span className="text-2xs font-medium text-text-muted w-8">BP:</span>
              <code className="text-2xs font-mono text-text bg-surface-hover px-1.5 py-0.5 rounded">{change.blueprintSide}</code>
            </div>
          )}
          {change.cppSide && (
            <div className="flex items-start gap-2">
              <span className="text-2xs font-medium text-text-muted w-8">C++:</span>
              <code className="text-2xs font-mono text-text bg-surface-hover px-1.5 py-0.5 rounded">{change.cppSide}</code>
            </div>
          )}
          {change.resolution && (
            <div className="flex items-start gap-2 mt-1 pt-1 border-t border-border">
              <span className="text-2xs font-medium" style={{ color: ACCENT }}>Fix:</span>
              <span className="text-2xs text-text-muted">{change.resolution}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Write to Project (dry-run diff → confirm) ──────────────────────────────

/** Sanitize a project name into a UE C++ module identifier. */
function sanitizeModule(name: string): string {
  const cleaned = (name || '').replace(/[^A-Za-z0-9_]/g, '');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : 'Game';
}

function WriteToProjectButton({ className, header, source, projectPath, defaultModule }: {
  className: string;
  header: string;
  source: string;
  projectPath: string;
  defaultModule: string;
}) {
  const [moduleName, setModuleName] = useState(defaultModule);
  const [plan, setPlan] = useState<WritePlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [written, setWritten] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const body = (confirm?: boolean) => JSON.stringify({ projectPath, moduleName, className, header, source, confirm });

  const dryRun = useCallback(async () => {
    setBusy(true); setErr(null); setWritten(null);
    try {
      const data = await apiFetch<WritePlan>('/api/blueprint-transpiler/write', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body(false),
      });
      setPlan(data);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Dry-run failed'); }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath, moduleName, className, header, source]);

  const confirmWrite = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      const data = await apiFetch<{ written: string[] }>('/api/blueprint-transpiler/write', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body(true),
      });
      setWritten(data.written); setPlan(null);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Write failed'); }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath, moduleName, className, header, source]);

  if (!projectPath) {
    return <span className="text-2xs text-text-muted" title="Set a project path in Project Setup first">No project path</span>;
  }

  return (
    <>
      <button
        onClick={dryRun}
        disabled={busy}
        className="flex items-center gap-1 px-2 py-1 rounded text-2xs transition-colors disabled:opacity-40"
        style={{ backgroundColor: `${ACCENT}${OPACITY_15}`, color: ACCENT }}
        title="Write the header + source into the UE project (with a dry-run diff)"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        Write to Project
      </button>

      {written && (
        <span className="text-2xs text-green-400 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Wrote {written.length} files
        </span>
      )}
      {err && (
        <span className="text-2xs text-red-400 flex items-center gap-1">
          <XCircle className="w-3 h-3" /> {err}
        </span>
      )}

      {plan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setPlan(null)}>
          <div
            className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                <Save className="w-4 h-4" style={{ color: ACCENT }} /> Write {className} to project — dry run
              </h3>
              <label className="text-2xs text-text-muted flex items-center gap-1.5">
                Module
                <input
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  className="w-28 bg-surface-deep border border-border rounded px-1.5 py-0.5 text-xs text-text font-mono"
                />
              </label>
            </div>

            <div className="space-y-3">
              {plan.files.map((f) => (
                <div key={f.path} className="rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-surface-deep">
                    <span className="text-2xs font-mono text-text">{f.relPath}</span>
                    <span className="text-2xs" style={{ color: f.exists ? STATUS_WARNING : STATUS_SUCCESS }}>
                      {f.exists
                        ? `overwrites existing · +${f.diff.summary.added} / -${f.diff.summary.removed}`
                        : `new file · +${f.diff.summary.added}`}
                    </span>
                  </div>
                  <div className="p-2">
                    <PromptDiffView before={f.before} after={f.after} maxHeightClass="max-h-56" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setPlan(null)} className="px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors">
                Cancel
              </button>
              <button
                onClick={confirmWrite}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40"
                style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, border: `1px solid ${ACCENT}${OPACITY_30}` }}
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Confirm write
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
