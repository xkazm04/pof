'use client';

import { useState, useCallback, useMemo } from 'react';
import { Zap, Ruler } from 'lucide-react';
import { optimizeMeshScript } from '@/lib/blender-mcp/scripts/optimize-mesh';
import { readReceipt } from '@/lib/blender-mcp/receipt';
import type { MeshStat } from '@/lib/blender-mcp/scripts/mesh-stats';
import { TabHeader } from '@/components/modules/shared/TabHeader';
import { WARNING_TEXT } from '@/lib/blender-mcp/status-tokens';
import {
  MCPFormCard,
  MCPField,
  MCPTextInput,
  MCPSubmitButton,
  DisconnectedNotice,
  ResultBlock,
  MCP_FORM_RADIUS,
} from '@/components/blender-mcp/McpFormControls';
import { useScriptExecution } from './useScriptExecution';
import { useMeshStats } from './useMeshStats';

/* ─── Mesh Optimization Tab ─────────────────────────────────────────────── */

/** Checkbox styling shared by the operation toggles — keyboard focus included. */
const NO_MESHES: MeshStat[] = [];
const SELECT = `focus-ring w-full bg-surface-tertiary border border-border ${MCP_FORM_RADIUS} px-3 py-1.5 text-xs text-text`;
const fmt = (n: number) => n.toLocaleString('en-US');

const CHECKBOX_CLASS =
  'focus-ring rounded border-border accent-[var(--visual-gen)]';

/**
 * The run's outcome is its `optimize-mesh` receipt `{ before, after }`, never
 * the bare fact that the call returned (docs/architecture/runtime-patterns.md:
 * "only `confirmed` renders as success"). No receipt, or one without numeric
 * counts, is `unconfirmed` and carries its reason. Pure.
 */
export function readOptimizeOutcome(output: string): { ok: true; text: string } | { ok: false; reason: string } {
  const read = readReceipt(output, 'optimize-mesh');
  if (read.state !== 'confirmed') return { ok: false, reason: read.reason };
  const { before, after } = read.data;
  if (typeof before !== 'number' || typeof after !== 'number') {
    return { ok: false, reason: "Blender's optimize-mesh receipt carried no vertex counts, so the outcome could not be confirmed" };
  }
  return { ok: true, text: `${before} → ${after} vertices (removed ${before - after})` };
}

export function MeshOptimizationTab() {
  const { isRunning, result, error, connected, execute } = useScriptExecution();
  const { state: stats, read: readStats } = useMeshStats();
  const [objectName, setObjectName] = useState('');
  const [removeDoubles, setRemoveDoubles] = useState(true);
  const [recalcNormals, setRecalcNormals] = useState(true);
  const [mergeDistance, setMergeDistance] = useState('0.0001');

  /**
   * `null` when the field is not a usable positive number. The script only reads
   * it for the remove-doubles threshold, so it is only a blocker when that
   * operation is on — previously a typo here was silently swallowed by a
   * `|| 0.0001` fallback and the run used a threshold the user never chose.
   */
  const parsedMergeDistance = useMemo(() => {
    const n = parseFloat(mergeDistance.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [mergeDistance]);

  const meshes = stats.status === 'read' ? stats.meshes : NO_MESHES;
  const source = meshes.find((m) => m.name === objectName.trim());

  const outcome = useMemo(() => (result === null ? null : readOptimizeOutcome(result)), [result]);

  const noOperations = !removeDoubles && !recalcNormals;
  const mergeDistanceInvalid = removeDoubles && parsedMergeDistance === null;

  const handleOptimize = useCallback(() => {
    if (!objectName.trim() || noOperations) return;
    if (removeDoubles && parsedMergeDistance === null) return;

    const code = optimizeMeshScript({
      objectName: objectName.trim(),
      removeDoubles,
      recalcNormals,
      mergeDistance: parsedMergeDistance ?? 0.0001,
    });
    execute('Mesh Optimization', code);
  }, [objectName, removeDoubles, recalcNormals, parsedMergeDistance, noOperations, execute]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <TabHeader
        title="Mesh Optimization"
        description="Clean up meshes by removing doubles and recalculating normals"
      />

      <MCPFormCard>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={readStats}
            disabled={!connected || stats.status === 'reading'}
            className={`focus-ring flex items-center gap-1.5 px-3 py-1.5 ${MCP_FORM_RADIUS} border border-border text-xs text-text hover:bg-surface-tertiary disabled:opacity-50`}
          >
            <Ruler size={14} aria-hidden="true" />
            {stats.status === 'reading' ? 'Reading…' : 'Read scene meshes'}
          </button>
          {stats.status === 'read' && meshes.length === 0 && (
            <span className="text-xs text-text-muted">No mesh objects in the scene.</span>
          )}
          {stats.status === 'failed' && <span className={`text-xs ${WARNING_TEXT}`}>{stats.reason}</span>}
        </div>

        {meshes.length > 0 && (
          <select
            aria-label="Measured meshes"
            className={SELECT}
            value={source ? source.name : ''}
            onChange={(e) => setObjectName(e.target.value)}
          >
            <option value="">Pick a measured mesh…</option>
            {meshes.map((m) => (
              <option key={m.name} value={m.name}>{`${m.name} — ${fmt(m.tris)} tris`}</option>
            ))}
          </select>
        )}

        <MCPField label="Object Name" htmlFor="mesh-object">
          <MCPTextInput
            id="mesh-object"
            value={objectName}
            onChange={setObjectName}
            placeholder="e.g. SM_Character"
          />
        </MCPField>

        <fieldset>
          <legend className="block text-xs font-medium text-text mb-1">
            Operations
          </legend>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-text">
              <input
                type="checkbox"
                checked={removeDoubles}
                onChange={(e) => setRemoveDoubles(e.target.checked)}
                className={CHECKBOX_CLASS}
              />
              Remove Doubles
            </label>
            <label className="flex items-center gap-1.5 text-xs text-text">
              <input
                type="checkbox"
                checked={recalcNormals}
                onChange={(e) => setRecalcNormals(e.target.checked)}
                className={CHECKBOX_CLASS}
              />
              Recalculate Normals
            </label>
          </div>
          {noOperations && (
            <p className={`text-xs mt-1 ${WARNING_TEXT}`}>
              Pick at least one operation — with both off the run would change
              nothing.
            </p>
          )}
        </fieldset>

        <MCPField
          label="Merge Distance"
          htmlFor="mesh-merge"
          hint={
            mergeDistanceInvalid ? (
              <span className={WARNING_TEXT}>
                Enter a positive number, e.g. 0.0001.
              </span>
            ) : (
              'Vertices closer together than this (in Blender units) are merged into one. Used by Remove Doubles.'
            )
          }
        >
          <MCPTextInput
            id="mesh-merge"
            value={mergeDistance}
            onChange={setMergeDistance}
            placeholder="0.0001"
            className="w-32"
          />
        </MCPField>

        <MCPSubmitButton
          onClick={handleOptimize}
          disabled={
            !connected || !objectName.trim() || noOperations || mergeDistanceInvalid
          }
          loading={isRunning}
          loadingLabel="Optimizing..."
          icon={Zap}
        >
          Optimize Mesh
        </MCPSubmitButton>

        {!connected && <DisconnectedNotice />}
      </MCPFormCard>

      <ResultBlock result={outcome?.ok ? outcome.text : null} error={error} />
      {outcome && !outcome.ok && (
        <p role="status" className={`text-xs ${WARNING_TEXT}`}>
          {outcome.reason}
        </p>
      )}
      {result !== null && (
        <details className="text-xs text-text-muted">
          <summary>Blender output</summary>
          <pre className="mt-1 font-mono text-text whitespace-pre-wrap break-words">{result}</pre>
        </details>
      )}
    </div>
  );
}
