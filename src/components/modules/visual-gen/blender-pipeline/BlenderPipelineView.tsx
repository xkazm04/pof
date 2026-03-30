'use client';

import { useState, useCallback } from 'react';
import { Settings, Layers, Zap, FileOutput, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { ReviewableModuleView } from '@/components/modules/shared/ReviewableModuleView';
import type { ExtraTab } from '@/components/modules/shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { tryApiFetch } from '@/lib/api-utils';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';
import { generateLodsScript } from '@/lib/blender-mcp/scripts/generate-lods';
import { optimizeMeshScript } from '@/lib/blender-mcp/scripts/optimize-mesh';
import { convertFbxScript } from '@/lib/blender-mcp/scripts/convert-fbx';
import { BlenderSetup } from './BlenderSetup';
import { ScriptRunner } from './ScriptRunner';
import { executeViaMCP } from './ScriptRunner';

/* ─── Shared execution hook ─────────────────────────────────────────────── */

function useScriptExecution() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connected = useBlenderMCPStore((s) => s.connection.connected);

  const execute = useCallback(
    async (scriptName: string, code: string) => {
      setIsRunning(true);
      setResult(null);
      setError(null);

      const res = await executeViaMCP(scriptName, code);

      if (res.ok) {
        setResult(res.data.output);
      } else {
        setError(res.error);
      }
      setIsRunning(false);
    },
    [],
  );

  return { isRunning, result, error, connected, execute };
}

function ResultBlock({ result, error }: { result: string | null; error: string | null }) {
  if (!result && !error) return null;
  return (
    <div className="mt-3">
      {result && (
        <div className="flex items-start gap-2 p-3 rounded bg-emerald-400/5 border border-emerald-400/20">
          <CheckCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" />
          <pre className="text-[10px] font-mono text-text-muted whitespace-pre-wrap">{result}</pre>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded bg-red-400/5 border border-red-400/20">
          <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}
    </div>
  );
}

/* ─── Pipeline Tab ──────────────────────────────────────────────────────── */

function PipelineTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-base font-semibold text-text">Blender Automation Pipeline</h2>
        <p className="text-xs text-text-muted mt-1">
          Execute Blender scripts remotely via MCP for batch conversion, LOD generation, and mesh optimization
        </p>
      </div>
      <BlenderSetup />
      <ScriptRunner />
    </div>
  );
}

/* ─── LOD Generation Tab ────────────────────────────────────────────────── */

function LODGenerationTab() {
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
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="text-center">
        <h2 className="text-base font-semibold text-text">LOD Generation</h2>
        <p className="text-xs text-text-muted mt-1">
          Generate Level-of-Detail meshes via decimation in Blender
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface-secondary p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-text mb-1">Object Name</label>
          <input
            type="text"
            value={objectName}
            onChange={(e) => setObjectName(e.target.value)}
            placeholder="e.g. SM_Sword"
            className="w-full bg-surface-tertiary border border-border rounded px-3 py-1.5 text-xs text-text placeholder:text-text-muted"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text mb-1">
            LOD Ratios (comma-separated, 0-1)
          </label>
          <input
            type="text"
            value={lodRatiosText}
            onChange={(e) => setLodRatiosText(e.target.value)}
            placeholder="0.75, 0.5, 0.25"
            className="w-full bg-surface-tertiary border border-border rounded px-3 py-1.5 text-xs text-text placeholder:text-text-muted"
          />
          <p className="text-[10px] text-text-muted mt-1">
            Each ratio creates an LOD level. 0.75 = 75% of original polygon count.
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!connected || isRunning || !objectName.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium
                     bg-[var(--visual-gen)] text-white hover:brightness-110 transition-all
                     disabled:opacity-50"
        >
          {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
          {isRunning ? 'Generating...' : 'Generate LODs'}
        </button>

        {!connected && (
          <p className="text-[10px] text-amber-400">Connect to Blender MCP first.</p>
        )}
      </div>

      <ResultBlock result={result} error={error} />
    </div>
  );
}

/* ─── Mesh Optimization Tab ─────────────────────────────────────────────── */

function MeshOptimizationTab() {
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
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="text-center">
        <h2 className="text-base font-semibold text-text">Mesh Optimization</h2>
        <p className="text-xs text-text-muted mt-1">
          Clean up meshes by removing doubles and recalculating normals
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface-secondary p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-text mb-1">Object Name</label>
          <input
            type="text"
            value={objectName}
            onChange={(e) => setObjectName(e.target.value)}
            placeholder="e.g. SM_Character"
            className="w-full bg-surface-tertiary border border-border rounded px-3 py-1.5 text-xs text-text placeholder:text-text-muted"
          />
        </div>

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

        <div>
          <label className="block text-xs font-medium text-text mb-1">Merge Distance</label>
          <input
            type="text"
            value={mergeDistance}
            onChange={(e) => setMergeDistance(e.target.value)}
            placeholder="0.0001"
            className="w-32 bg-surface-tertiary border border-border rounded px-3 py-1.5 text-xs text-text placeholder:text-text-muted"
          />
        </div>

        <button
          onClick={handleOptimize}
          disabled={!connected || isRunning || !objectName.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium
                     bg-[var(--visual-gen)] text-white hover:brightness-110 transition-all
                     disabled:opacity-50"
        >
          {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          {isRunning ? 'Optimizing...' : 'Optimize Mesh'}
        </button>

        {!connected && (
          <p className="text-[10px] text-amber-400">Connect to Blender MCP first.</p>
        )}
      </div>

      <ResultBlock result={result} error={error} />
    </div>
  );
}

/* ─── FBX Conversion Tab ────────────────────────────────────────────────── */

function FBXConversionTab() {
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
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="text-center">
        <h2 className="text-base font-semibold text-text">FBX to glTF Conversion</h2>
        <p className="text-xs text-text-muted mt-1">
          Convert FBX files to GLB format with optional Draco compression
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface-secondary p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-text mb-1">Input FBX Path</label>
          <input
            type="text"
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            placeholder="C:/Assets/model.fbx"
            className="w-full bg-surface-tertiary border border-border rounded px-3 py-1.5 text-xs text-text font-mono placeholder:text-text-muted"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text mb-1">Output GLB Path</label>
          <input
            type="text"
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
            placeholder="C:/Assets/model.glb"
            className="w-full bg-surface-tertiary border border-border rounded px-3 py-1.5 text-xs text-text font-mono placeholder:text-text-muted"
          />
        </div>

        <label className="flex items-center gap-1.5 text-xs text-text">
          <input
            type="checkbox"
            checked={dracoCompression}
            onChange={(e) => setDracoCompression(e.target.checked)}
            className="rounded border-border"
          />
          Enable Draco Compression
        </label>

        <button
          onClick={handleConvert}
          disabled={!connected || isRunning || !inputPath.trim() || !outputPath.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium
                     bg-[var(--visual-gen)] text-white hover:brightness-110 transition-all
                     disabled:opacity-50"
        >
          {isRunning ? <Loader2 size={14} className="animate-spin" /> : <FileOutput size={14} />}
          {isRunning ? 'Converting...' : 'Convert to GLB'}
        </button>

        {!connected && (
          <p className="text-[10px] text-amber-400">Connect to Blender MCP first.</p>
        )}
      </div>

      <ResultBlock result={result} error={error} />
    </div>
  );
}

/* ─── Main View ─────────────────────────────────────────────────────────── */

export function BlenderPipelineView() {
  const mod = SUB_MODULE_MAP['blender-pipeline'];
  const cat = getCategoryForSubModule('blender-pipeline');

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    {
      id: 'pipeline',
      label: 'Pipeline',
      icon: Settings,
      render: () => <PipelineTab />,
    },
    {
      id: 'lod-gen',
      label: 'LOD Generation',
      icon: Layers,
      render: () => <LODGenerationTab />,
    },
    {
      id: 'mesh-opt',
      label: 'Mesh Optimization',
      icon: Zap,
      render: () => <MeshOptimizationTab />,
    },
    {
      id: 'fbx-conv',
      label: 'FBX Conversion',
      icon: FileOutput,
      render: () => <FBXConversionTab />,
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="blender-pipeline"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('blender-pipeline')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
