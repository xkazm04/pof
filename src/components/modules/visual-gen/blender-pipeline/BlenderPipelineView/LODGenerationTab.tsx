'use client';

import { useState, useCallback, useMemo } from 'react';
import { Layers, Ruler } from 'lucide-react';
import { generateLodsScript } from '@/lib/blender-mcp/scripts/generate-lods';
import { planLodChain, gradeLodReceipt, type LodTarget } from '@/lib/visual-gen/lod-plan';
import { POLYCOUNT_PRESETS } from '@/lib/visual-gen/polycount-presets';
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
import { LodPlanTable } from './LodPlanTable';

/* ─── LOD Generation Tab ────────────────────────────────────────────────── */

/**
 * Measure → commission → grade, in triangles. "Read scene meshes" measures every
 * mesh in one read-only dispatch; the operator picks one (free text still works)
 * and an asset class; `LodPlanTable` states each level's triangle target and
 * LOD0's standing against the class budget; after Generate each level is graded
 * from the `lod` receipt Blender printed. The run is never painted green whole:
 * the grade is the outcome, and the raw output sits behind a disclosure.
 */

const NO_MESHES: MeshStat[] = [];
const SELECT = `focus-ring w-full bg-surface-tertiary border border-border ${MCP_FORM_RADIUS} px-3 py-1.5 text-xs text-text`;
const fmt = (n: number) => n.toLocaleString('en-US');

export function LODGenerationTab() {
  const { isRunning, result, error, connected, execute } = useScriptExecution();
  const { state: stats, read: readStats } = useMeshStats();
  const [objectName, setObjectName] = useState('');
  const [assetClass, setAssetClass] = useState('');
  const [lodRatiosText, setLodRatiosText] = useState('0.75, 0.5, 0.25');
  /** The levels the last run was commissioned with; cleared by any edit, so a grade never outlives its plan. */
  const [ran, setRan] = useState<LodTarget[] | null>(null);

  const meshes = stats.status === 'read' ? stats.meshes : NO_MESHES;
  const source = meshes.find((m) => m.name === objectName.trim());
  const plan = useMemo(
    () => planLodChain({ sourceTris: source?.tris, assetClass, ratiosText: lodRatiosText }),
    [source?.tris, assetClass, lodRatiosText],
  );
  const grade = useMemo(() => (ran && result !== null ? gradeLodReceipt(result, ran) : null), [ran, result]);

  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    setRan(null);
  };

  const handleGenerate = useCallback(() => {
    const name = objectName.trim();
    if (!name || plan.levels.length === 0) return;
    const targets = plan.levels.map((l) => l.targetTris);
    const code = targets.every((t): t is number => t !== undefined)
      ? generateLodsScript({ objectName: name, targetTris: targets })
      : generateLodsScript({ objectName: name, lodRatios: plan.levels.map((l) => l.ratio) });
    setRan(plan.levels);
    execute('LOD Generation', code);
  }, [objectName, plan, execute]);

  const ratioHint = (
    <>
      <span className="block">
        Each ratio creates one LOD level — 0.5 targets half of the source&apos;s triangles.
      </span>
      {plan.levels.length === 0 && (
        <span className={`block mt-0.5 ${WARNING_TEXT}`}>
          Enter at least one ratio above 0 and below 1 — e.g. 0.5.
        </span>
      )}
      {plan.rejected.length > 0 && (
        <span className={`block mt-0.5 ${WARNING_TEXT}`}>
          Skipping {plan.rejected.length} {plan.rejected.length === 1 ? 'entry' : 'entries'}{' '}
          outside that range: {plan.rejected.map((r) => `"${r}"`).join(', ')}
        </span>
      )}
    </>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <TabHeader
        title="LOD Generation"
        description="Generate Level-of-Detail meshes to triangle targets via decimation in Blender"
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
            onChange={(e) => edit(setObjectName)(e.target.value)}
          >
            <option value="">Pick a measured mesh…</option>
            {meshes.map((m) => (
              <option key={m.name} value={m.name}>{`${m.name} — ${fmt(m.tris)} tris`}</option>
            ))}
          </select>
        )}

        <MCPField label="Object Name" htmlFor="lod-object">
          <MCPTextInput id="lod-object" value={objectName} onChange={edit(setObjectName)} placeholder="e.g. SM_Sword" />
        </MCPField>

        <MCPField label="Asset Class" htmlFor="lod-class">
          <select id="lod-class" className={SELECT} value={assetClass} onChange={(e) => edit(setAssetClass)(e.target.value)}>
            <option value="">No class (LOD0 ungraded)</option>
            {POLYCOUNT_PRESETS.map((p) => (
              <option key={p.assetClass} value={p.assetClass}>{p.label}</option>
            ))}
          </select>
        </MCPField>

        <MCPField label="LOD Ratios (comma-separated, 0-1)" htmlFor="lod-ratios" hint={ratioHint}>
          <MCPTextInput id="lod-ratios" value={lodRatiosText} onChange={edit(setLodRatiosText)} placeholder="0.75, 0.5, 0.25" />
        </MCPField>

        <MCPSubmitButton
          onClick={handleGenerate}
          disabled={!connected || !objectName.trim() || plan.levels.length === 0}
          loading={isRunning}
          loadingLabel="Generating..."
          icon={Layers}
        >
          Generate LODs
        </MCPSubmitButton>

        {!connected && <DisconnectedNotice />}
      </MCPFormCard>

      <LodPlanTable plan={plan} grade={grade} />

      <ResultBlock result={null} error={error} />
      {result !== null && (
        <details className="text-xs text-text-muted">
          <summary>Blender output</summary>
          <pre className="mt-1 font-mono text-text whitespace-pre-wrap break-words">{result}</pre>
        </details>
      )}
    </div>
  );
}
