'use client';

import { useState, useCallback } from 'react';
import { Layers } from 'lucide-react';
import { generateLodsScript } from '@/lib/blender-mcp/scripts/generate-lods';
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

/* ─── LOD Generation Tab ────────────────────────────────────────────────── */

export function LODGenerationTab() {
  const { isRunning, result, error, connected, execute } = useScriptExecution();
  const [objectName, setObjectName] = useState('');
  const [lodRatiosText, setLodRatiosText] = useState('0.75, 0.5, 0.25');

  const handleGenerate = useCallback(() => {
    const ratios = lodRatiosText
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n) && n > 0 && n < 1);

    if (!objectName.trim() || ratios.length === 0) return;

    const code = generateLodsScript({ objectName: objectName.trim(), lodRatios: ratios });
    execute('LOD Generation', code);
  }, [objectName, lodRatiosText, execute]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <TabHeader
        title="LOD Generation"
        description="Generate Level-of-Detail meshes via decimation in Blender"
      />

      <MCPFormCard>
        <MCPField label="Object Name" htmlFor="lod-object">
          <MCPTextInput
            id="lod-object"
            value={objectName}
            onChange={setObjectName}
            placeholder="e.g. SM_Sword"
          />
        </MCPField>

        <MCPField
          label="LOD Ratios (comma-separated, 0-1)"
          htmlFor="lod-ratios"
          hint="Each ratio creates an LOD level. 0.75 = 75% of original polygon count."
        >
          <MCPTextInput
            id="lod-ratios"
            value={lodRatiosText}
            onChange={setLodRatiosText}
            placeholder="0.75, 0.5, 0.25"
          />
        </MCPField>

        <MCPSubmitButton
          onClick={handleGenerate}
          disabled={!connected || !objectName.trim()}
          loading={isRunning}
          loadingLabel="Generating..."
          icon={Layers}
        >
          Generate LODs
        </MCPSubmitButton>

        {!connected && <DisconnectedNotice />}
      </MCPFormCard>

      <ResultBlock result={result} error={error} />
    </div>
  );
}
