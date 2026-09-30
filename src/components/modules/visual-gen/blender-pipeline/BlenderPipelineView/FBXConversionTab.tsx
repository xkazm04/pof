'use client';

import { useState, useCallback } from 'react';
import { FileOutput, ExternalLink } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import type { FbxConvertResponse } from '@/lib/visual-gen/fbx-convert';
import { TabHeader } from '@/components/modules/shared/TabHeader';
import {
  MCPFormCard,
  MCPField,
  MCPTextInput,
  MCPSubmitButton,
  ResultBlock,
} from '@/components/blender-mcp/McpFormControls';

/* ─── FBX Conversion Tab ────────────────────────────────────────────────── */

const ENDPOINT = '/api/visual-gen/fbx-convert';

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return 'size unknown';
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

/** The receipt line for a converted GLB. Pure. */
function receiptText(r: Extract<FbxConvertResponse, { converted: true }>): string {
  const meshes = r.meshes ?? 0;
  const tris = (r.tris ?? 0).toLocaleString('en-US');
  return `Converted ${meshes} mesh${meshes === 1 ? '' : 'es'} · ${tris} triangles · ${formatBytes(r.bytes)}\n`
    + `-> generated/converted/${r.name}`;
}

/**
 * FBX -> GLB as a headless file job (`POST /api/visual-gen/fbx-convert`).
 *
 * It never goes through the Blender MCP bridge: the conversion runs in its own
 * background Blender, so the operator's open scene is untouched and the button works
 * with the bridge down. Success is the route's receipt, which exists only when the GLB
 * is on disk under `generated/converted/`.
 */
export function FBXConversionTab() {
  const [inputPath, setInputPath] = useState('');
  const [dracoCompression, setDracoCompression] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [done, setDone] = useState<Extract<FbxConvertResponse, { converted: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = useCallback(async () => {
    const path = inputPath.trim();
    if (!path) return;
    setIsRunning(true);
    setDone(null);
    setError(null);
    const res = await tryApiFetch<FbxConvertResponse>(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputPath: path, draco: dracoCompression }),
    });
    if (!res.ok) setError(res.error);
    else if (res.data.converted) setDone(res.data);
    else setError(res.data.reason);
    setIsRunning(false);
  }, [inputPath, dracoCompression]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <TabHeader
        title="FBX to glTF Conversion"
        description="Convert an FBX file to GLB in a background Blender — your open Blender scene is never touched"
      />

      <MCPFormCard>
        <MCPField
          label="Input FBX Path"
          htmlFor="fbx-input"
          hint="Absolute path on this machine, with forward slashes. Blender does not need to be open."
        >
          <MCPTextInput
            id="fbx-input"
            value={inputPath}
            onChange={setInputPath}
            placeholder="C:/Assets/model.fbx"
            mono
          />
        </MCPField>

        <p className="text-xs text-text-muted">
          Output: <span className="font-mono">generated/converted/&lt;name&gt;.glb</span> (rotation and
          scale applied, triangulated). A previous conversion with the same name is replaced.
        </p>

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
            Off by default: PoF&apos;s own 3D viewer cannot open a Draco-compressed GLB.
          </p>
        </fieldset>

        <MCPSubmitButton
          onClick={handleConvert}
          disabled={!inputPath.trim()}
          loading={isRunning}
          loadingLabel="Converting..."
          icon={FileOutput}
        >
          Convert to GLB
        </MCPSubmitButton>
      </MCPFormCard>

      <ResultBlock result={done ? receiptText(done) : null} error={error} />
      {done && (
        <a
          href={done.url}
          target="_blank"
          rel="noreferrer"
          className="focus-ring inline-flex items-center gap-1 text-xs text-[var(--visual-gen)] hover:underline"
        >
          <ExternalLink size={12} aria-hidden="true" />
          Open {done.name}
        </a>
      )}
    </div>
  );
}
