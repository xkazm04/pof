'use client';

import { useState, useCallback, useMemo } from 'react';
import { Zap } from 'lucide-react';
import { optimizeMeshScript } from '@/lib/blender-mcp/scripts/optimize-mesh';
import { TabHeader } from '@/components/modules/shared/TabHeader';
import { WARNING_TEXT } from '@/lib/blender-mcp/status-tokens';
import {
  MCPFormCard,
  MCPField,
  MCPTextInput,
  MCPSubmitButton,
  DisconnectedNotice,
  ResultBlock,
} from '@/components/blender-mcp/McpFormControls';
import { useScriptExecution } from './useScriptExecution';

/* ─── Mesh Optimization Tab ─────────────────────────────────────────────── */

/** Checkbox styling shared by the operation toggles — keyboard focus included. */
const CHECKBOX_CLASS =
  'focus-ring rounded border-border accent-[var(--visual-gen)]';

export function MeshOptimizationTab() {
  const { isRunning, result, error, connected, execute } = useScriptExecution();
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

      <ResultBlock result={result} error={error} />
    </div>
  );
}
