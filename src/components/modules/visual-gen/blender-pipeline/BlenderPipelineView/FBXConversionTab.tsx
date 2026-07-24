'use client';

import { useState, useCallback } from 'react';
import { FileOutput } from 'lucide-react';
import { convertFbxScript } from '@/lib/blender-mcp/scripts/convert-fbx';
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

/* ─── FBX Conversion Tab ────────────────────────────────────────────────── */

export function FBXConversionTab() {
  const { isRunning, result, error, connected, execute } = useScriptExecution();
  const [inputPath, setInputPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [dracoCompression, setDracoCompression] = useState(true);

  const handleConvert = useCallback(() => {
    if (!inputPath.trim() || !outputPath.trim()) return;

    const code = convertFbxScript({
      inputPath: inputPath.trim(),
      outputPath: outputPath.trim(),
      dracoCompression,
    });
    execute('FBX Conversion', code);
  }, [inputPath, outputPath, dracoCompression, execute]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <TabHeader
        title="FBX to glTF Conversion"
        description="Convert FBX files to GLB format with optional Draco compression"
      />

      <MCPFormCard>
        <MCPField
          label="Input FBX Path"
          htmlFor="fbx-input"
          hint="Absolute path on the machine running Blender, with forward slashes."
        >
          <MCPTextInput
            id="fbx-input"
            value={inputPath}
            onChange={setInputPath}
            placeholder="C:/Assets/model.fbx"
            mono
          />
        </MCPField>

        <MCPField
          label="Output GLB Path"
          htmlFor="fbx-output"
          hint="An existing file at this path is overwritten."
        >
          <MCPTextInput
            id="fbx-output"
            value={outputPath}
            onChange={setOutputPath}
            placeholder="C:/Assets/model.glb"
            mono
          />
        </MCPField>

        <fieldset>
          <legend className="block text-xs font-medium text-text mb-1">
            Compression
          </legend>
          <label className="flex items-center gap-1.5 text-xs text-text">
            <input
              type="checkbox"
              checked={dracoCompression}
              onChange={(e) => setDracoCompression(e.target.checked)}
              className="focus-ring rounded border-border accent-[var(--visual-gen)]"
            />
            Enable Draco Compression
          </label>
          <p className="text-xs text-text-muted mt-1">
            Shrinks the GLB substantially; the importer must support Draco.
          </p>
        </fieldset>

        <MCPSubmitButton
          onClick={handleConvert}
          disabled={!connected || !inputPath.trim() || !outputPath.trim()}
          loading={isRunning}
          loadingLabel="Converting..."
          icon={FileOutput}
        >
          Convert to GLB
        </MCPSubmitButton>

        {!connected && <DisconnectedNotice />}
      </MCPFormCard>

      <ResultBlock result={result} error={error} />
    </div>
  );
}
