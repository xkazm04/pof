'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { exportSceneScript } from '@/lib/blender-mcp/scripts/export-scene';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';

export function SceneExporter() {
  const [outputPath, setOutputPath] = useState('');
  const [format, setFormat] = useState<'fbx' | 'gltf'>('gltf');
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = async () => {
    if (!outputPath) return;
    setStatus('Exporting...');
    const code = exportSceneScript({ outputPath, format });
    const result = await tryApiFetch<ExecuteOutput>(
      '/api/blender-mcp/execute',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      },
    );
    setStatus(
      result.ok
        ? `Exported: ${result.data.output}`
        : `Error: ${result.error}`,
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as 'fbx' | 'gltf')}
          className="bg-surface-tertiary border border-border rounded px-2 py-1 text-xs text-text"
        >
          <option value="gltf">GLB (glTF Binary)</option>
          <option value="fbx">FBX</option>
        </select>
        <input
          type="text"
          value={outputPath}
          onChange={(e) => setOutputPath(e.target.value)}
          placeholder="Output file path..."
          className="flex-1 bg-surface-tertiary border border-border rounded px-2 py-1 text-xs text-text"
        />
        <button
          onClick={handleExport}
          disabled={!outputPath}
          className="flex items-center gap-1 px-3 py-1 rounded bg-accent/10 text-accent text-xs hover:bg-accent/20 disabled:opacity-40"
        >
          <Download className="w-3 h-3" /> Export
        </button>
      </div>
      {status && (
        <div className="text-[11px] text-text-muted">{status}</div>
      )}
    </div>
  );
}
