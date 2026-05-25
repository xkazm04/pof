'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Network, Radio, Bell, ArrowRight, Loader2, XCircle, Upload,
  Clipboard, ClipboardCheck, ShieldCheck,
} from 'lucide-react';
import { useBlueprintTranspiler } from '@/hooks/useBlueprintTranspiler';
import { useProjectStore } from '@/stores/projectStore';
import {
  REPLICATION_INCLUDE,
  lifetimeReplicatedPropsDefinition,
} from '@/lib/replication-scaffolder';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import { UI_TIMEOUTS } from '@/lib/constants';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_INFO,
  OPACITY_20, OPACITY_30, statusBg, statusBorder,
} from '@/lib/chart-colors';

const ACCENT = MODULE_COLORS.systems;

/** Sample Blueprint with a mix of replicated, RepNotify, and local-only properties. */
const SAMPLE_REPLICATED_BP = JSON.stringify({
  ClassName: 'BP_NetCharacter',
  ParentClass: 'ACharacter',
  Variables: [
    { VarName: 'Health', VarType: 'float', PropertyFlags: ['CPF_Net'], DefaultValue: '100.0', Tooltip: 'Server-authoritative health' },
    { VarName: 'CurrentAmmo', VarType: 'int', PropertyFlags: ['CPF_RepNotify'], Tooltip: 'Drives HUD ammo counter on clients' },
    { VarName: 'TeamColor', VarType: 'color', PropertyFlags: ['CPF_RepNotify'] },
    { VarName: 'LocalAimOffset', VarType: 'vector', PropertyFlags: [] },
  ],
  Graphs: [{ GraphName: 'EventGraph', GraphType: 'event', Nodes: [] }],
}, null, 2);

export function ReplicationScaffoldPanel() {
  const projectName = useProjectStore((s) => s.projectName);
  const {
    blueprintJson, setBlueprintJson,
    transpileResult, isLoading, error,
    parse, transpile,
  } = useBlueprintTranspiler();
  const [copied, setCopied] = useState(false);

  const handleScan = useCallback(async () => {
    if (!blueprintJson.trim()) return;
    await parse(blueprintJson);
    await transpile(blueprintJson, projectName || undefined);
  }, [blueprintJson, projectName, parse, transpile]);

  const replication = transpileResult?.replication ?? null;
  const className = transpileResult?.className ?? null;

  // Rebuild the GetLifetimeReplicatedProps body for a focused code preview,
  // reusing the same scaffolder the transpiler uses.
  const lifetimeBody = useMemo(() => {
    if (!replication?.hasReplication || !className) return null;
    return `#include "${REPLICATION_INCLUDE}"\n\n${lifetimeReplicatedPropsDefinition(className, replication.properties)}`;
  }, [replication, className]);

  const repNotifyCount = replication?.properties.filter((p) => p.repNotify).length ?? 0;

  const copyCode = useCallback(async () => {
    if (!lifetimeBody) return;
    await navigator.clipboard.writeText(lifetimeBody);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [lifetimeBody]);

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="rounded-lg border border-border bg-surface-secondary p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Network className="w-4 h-4" style={{ color: ACCENT }} />
          <h3 className="text-sm font-medium text-text">Replication Scaffolder</h3>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Paste a Blueprint JSON export to see every replicated field and its RepNotify status.
          The transpiler generates the mandatory <code className="text-text">GetLifetimeReplicatedProps()</code> body,
          the <code className="text-text">Net/UnrealNetwork.h</code> include, and <code className="text-text">OnRep_</code> handlers
          so the output actually compiles and replicates.
        </p>
      </div>

      {/* Input */}
      <div className="rounded-lg border border-border bg-surface-secondary overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-deep">
          <div className="flex items-center gap-2">
            <Upload className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs font-medium text-text">Blueprint JSON</span>
          </div>
          <button
            onClick={() => setBlueprintJson(SAMPLE_REPLICATED_BP)}
            className="text-2xs px-2 py-0.5 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            Load Sample
          </button>
        </div>
        <textarea
          className="w-full h-40 p-3 bg-background text-xs font-mono text-text resize-none focus:outline-none placeholder-text-muted"
          placeholder="Paste Blueprint JSON (from UE5 commandlet export or copy graph)..."
          value={blueprintJson}
          onChange={(e) => setBlueprintJson(e.target.value)}
          spellCheck={false}
        />
        <div className="px-3 py-2 border-t border-border flex items-center justify-end">
          <button
            onClick={handleScan}
            disabled={!blueprintJson.trim() || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40"
            style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, border: `1px solid ${ACCENT}${OPACITY_30}` }}
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
            Scan Replication
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-status-red-subtle border border-status-red-strong text-xs text-red-400">
          <XCircle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {/* Results */}
      {replication && !isLoading && (
        replication.hasReplication ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4 px-3 py-2 rounded-md border border-border bg-surface-deep">
              <span className="text-2xs text-text-muted">
                <strong className="text-text">{className}</strong>
              </span>
              <span className="flex items-center gap-1 text-2xs" style={{ color: ACCENT }}>
                <Radio className="w-3 h-3" /> {replication.properties.length} replicated
              </span>
              {repNotifyCount > 0 && (
                <span className="flex items-center gap-1 text-2xs" style={{ color: STATUS_INFO }}>
                  <Bell className="w-3 h-3" /> {repNotifyCount} RepNotify
                </span>
              )}
            </div>

            {/* Field list */}
            <div>
              <h4 className="text-xs font-medium text-text mb-2">Replicated Fields</h4>
              <StaggerContainer className="space-y-1.5">
                {replication.properties.map((p) => (
                  <StaggerItem
                    key={p.name}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-surface"
                  >
                    <code className="text-2xs font-mono text-text-muted">{p.cppType}</code>
                    <span className="text-xs font-medium text-text">{p.name}</span>
                    <div className="ml-auto flex items-center gap-2">
                      {p.repNotify ? (
                        <>
                          <span
                            className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded font-medium"
                            style={{ color: STATUS_INFO, backgroundColor: statusBg(STATUS_INFO, 0.12), border: `1px solid ${statusBorder(STATUS_INFO)}` }}
                          >
                            <Bell className="w-2.5 h-2.5" /> RepNotify
                          </span>
                          <code className="text-2xs font-mono text-text-muted">{p.onRepHandler}()</code>
                        </>
                      ) : (
                        <span
                          className="text-2xs px-1.5 py-0.5 rounded font-medium"
                          style={{ color: STATUS_SUCCESS, backgroundColor: statusBg(STATUS_SUCCESS, 0.12), border: `1px solid ${statusBorder(STATUS_SUCCESS)}` }}
                        >
                          Replicated
                        </span>
                      )}
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>

            {/* Generated code */}
            {lifetimeBody && (
              <div className="rounded-lg border border-border bg-surface-secondary overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-deep">
                  <span className="text-2xs font-medium text-text">Generated replication boilerplate</span>
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-1 px-2 py-1 rounded text-2xs text-text-muted hover:text-text transition-colors"
                  >
                    {copied ? (
                      <><ClipboardCheck className="w-3 h-3 text-green-400" /> Copied</>
                    ) : (
                      <><Clipboard className="w-3 h-3" /> Copy</>
                    )}
                  </button>
                </div>
                <pre className="overflow-auto p-3 text-2xs font-mono text-text leading-relaxed whitespace-pre max-h-72">
                  {lifetimeBody}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex items-center gap-2 px-3 py-3 rounded-md border text-xs"
            style={{ color: STATUS_SUCCESS, backgroundColor: statusBg(STATUS_SUCCESS, 0.08), borderColor: statusBorder(STATUS_SUCCESS) }}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              <strong className="text-text">{className}</strong> has no replicated properties — no replication boilerplate is required.
            </span>
          </div>
        )
      )}

      {/* Empty state */}
      {!replication && !isLoading && !error && (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-text-muted">
          <Network className="w-8 h-8 opacity-30" />
          <p className="text-xs text-center max-w-sm">
            Paste a Blueprint JSON export above and scan it to surface every replicated field,
            its RepNotify status, and the generated <code className="text-text">GetLifetimeReplicatedProps()</code> body.
          </p>
        </div>
      )}
    </div>
  );
}
