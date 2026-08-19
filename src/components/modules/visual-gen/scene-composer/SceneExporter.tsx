'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { executeViaMCP } from '@/components/modules/visual-gen/blender-pipeline/ScriptRunner';
import {
  exportSceneScript,
  EXPORT_OK_MARKER,
} from '@/lib/blender-mcp/scripts/export-scene';

export function SceneExporter() {
  const [outputPath, setOutputPath] = useState('');
  const [format, setFormat] = useState<'fbx' | 'gltf'>('gltf');
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const handleExport = async () => {
    if (!outputPath) return;
    setStatus('Exporting…');
    setFailed(false);
    const code = exportSceneScript({ outputPath, format });
    const result = await executeViaMCP(`Export scene (${format})`, code);

    if (!result.ok) {
      setFailed(true);
      setStatus(`Export failed: ${result.error}`);
      return;
    }

    // A 200 from the execute route means the ADDON accepted the script, not
    // that a file exists. The bridge may be on another machine, so PoF cannot
    // check — the honest ceiling is what Blender itself printed. If the marker
    // is absent, say we could not confirm rather than claiming "Exported".
    const output = result.data.output ?? '';
    if (output.includes(EXPORT_OK_MARKER)) {
      setStatus(`Blender reported the export finished: ${outputPath}`);
    } else {
      setFailed(true);
      setStatus(
        `Script ran without error, but Blender printed no export confirmation — ` +
          `could not confirm ${outputPath} was written. Blender said: ` +
          `${output.trim() || '(nothing)'}`,
      );
    }
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
        <div
          role="status"
          aria-live="polite"
          className={`text-xs ${failed ? 'text-amber-400' : 'text-text-muted'}`}
        >
          {status}
        </div>
      )}
    </div>
  );
}
