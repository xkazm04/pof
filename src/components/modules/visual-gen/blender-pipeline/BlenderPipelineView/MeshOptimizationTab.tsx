'use client';

import { useState, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { optimizeMeshScript } from '@/lib/blender-mcp/scripts/optimize-mesh';
import { TabHeader } from '@/components/modules/shared/TabHeader';
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

export function MeshOptimizationTab() {
  const { isRunning, result, error, connected, execute } = useScriptExecution();
  const [objectName, setObjectName] = useState('');
  const [removeDoubles, setRemoveDoubles] = useState(true);
  const [recalcNormals, setRecalcNormals] = useState(true);
  const [mergeDistance, setMergeDistance] = useState('0.0001');

  const handleOptimize = useCallback(() => {
    if (!objectName.trim()) return;

    const code = optimizeMeshScript({
      objectName: objectName.trim(),
      removeDoubles,
      recalcNormals,
      mergeDistance: parseFloat(mergeDistance) || 0.0001,
    });
    execute('Mesh Optimization', code);
  }, [objectName, removeDoubles, recalcNormals, mergeDistance, execute]);

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

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-text">
            <input
              type="checkbox"
              checked={removeDoubles}
              onChange={(e) => setRemoveDoubles(e.target.checked)}
              className="rounded border-border"
            />
            Remove Doubles
          </label>
          <label className="flex items-center gap-1.5 text-xs text-text">
            <input
              type="checkbox"
              checked={recalcNormals}
              onChange={(e) => setRecalcNormals(e.target.checked)}
              className="rounded border-border"
            />
            Recalculate Normals
          </label>
        </div>

        <MCPField label="Merge Distance" htmlFor="mesh-merge">
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
          disabled={!connected || !objectName.trim()}
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
