'use client';

import { useState, useCallback, useMemo } from 'react';
import { Layers } from 'lucide-react';
import { generateLodsScript } from '@/lib/blender-mcp/scripts/generate-lods';
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

/* ─── LOD Generation Tab ────────────────────────────────────────────────── */

/**
 * Splits the comma-separated ratio field into the levels that will actually be
 * generated and the entries the script would otherwise drop on the floor
 * (unparseable, or outside the exclusive 0–1 decimation range).
 *
 * Parsing lives here rather than inside the click handler so the form can both
 * gate the submit and *tell the user* what it made of their input — previously a
 * field like `1.0, abc` left the button enabled and clicking it did nothing at
 * all.
 */
function parseLodRatios(text: string): { ratios: number[]; rejected: string[] } {
  const ratios: number[] = [];
  const rejected: string[] = [];
  for (const raw of text.split(',')) {
    const token = raw.trim();
    if (!token) continue;
    const n = parseFloat(token);
    if (Number.isFinite(n) && n > 0 && n < 1) ratios.push(n);
    else rejected.push(token);
  }
  return { ratios, rejected };
}

const asPercent = (ratio: number) => `${Math.round(ratio * 100)}%`;

export function LODGenerationTab() {
  const { isRunning, result, error, connected, execute } = useScriptExecution();
  const [objectName, setObjectName] = useState('');
  const [lodRatiosText, setLodRatiosText] = useState('0.75, 0.5, 0.25');

  const { ratios, rejected } = useMemo(
    () => parseLodRatios(lodRatiosText),
    [lodRatiosText],
  );

  const handleGenerate = useCallback(() => {
    if (!objectName.trim() || ratios.length === 0) return;

    const code = generateLodsScript({ objectName: objectName.trim(), lodRatios: ratios });
    execute('LOD Generation', code);
  }, [objectName, ratios, execute]);

  const ratioHint = (
    <>
      <span className="block">
        Each ratio creates one LOD level — 0.75 keeps 75% of the original polygon
        count.
      </span>
      {ratios.length > 0 ? (
        <span className="block mt-0.5">
          Will generate {ratios.length} {ratios.length === 1 ? 'level' : 'levels'}:{' '}
          {ratios.map((r, i) => `LOD${i + 1} ${asPercent(r)}`).join(' · ')}
        </span>
      ) : (
        <span className={`block mt-0.5 ${WARNING_TEXT}`}>
          Enter at least one ratio above 0 and below 1 — e.g. 0.5.
        </span>
      )}
      {rejected.length > 0 && (
        <span className={`block mt-0.5 ${WARNING_TEXT}`}>
          Skipping {rejected.length} {rejected.length === 1 ? 'entry' : 'entries'}{' '}
          outside that range:{' '}
          {rejected.map((r) => `"${r}"`).join(', ')}
        </span>
      )}
    </>
  );

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
          hint={ratioHint}
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
          disabled={!connected || !objectName.trim() || ratios.length === 0}
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
