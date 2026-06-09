'use client';

import { useState, useCallback } from 'react';
import { Settings, Layers, Zap, FileOutput, Boxes } from 'lucide-react';
import { ReviewableModuleView } from '@/components/modules/shared/ReviewableModuleView';
import type { ExtraTab } from '@/components/modules/shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { generateLodsScript } from '@/lib/blender-mcp/scripts/generate-lods';
import { optimizeMeshScript } from '@/lib/blender-mcp/scripts/optimize-mesh';
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
import { BlenderSetup } from './BlenderSetup';
import { ScriptRunner } from './ScriptRunner';
import { executeViaMCP } from './ScriptRunner';
import { AssetBrowser } from './AssetBrowser';

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

/* ─── Pipeline Tab ──────────────────────────────────────────────────────── */

function PipelineTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <TabHeader
        title="Blender Automation Pipeline"
        description="Execute Blender scripts remotely via MCP for batch conversion, LOD generation, and mesh optimization"
      />
      <BlenderSetup />
      <ScriptRunner />
    </div>
  );
}

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
        <MCPField label="Input FBX Path" htmlFor="fbx-input">
          <MCPTextInput
            id="fbx-input"
            value={inputPath}
            onChange={setInputPath}
            placeholder="C:/Assets/model.fbx"
            mono
          />
        </MCPField>

        <MCPField label="Output GLB Path" htmlFor="fbx-output">
          <MCPTextInput
            id="fbx-output"
            value={outputPath}
            onChange={setOutputPath}
            placeholder="C:/Assets/model.glb"
            mono
          />
        </MCPField>

        <label className="flex items-center gap-1.5 text-xs text-text">
          <input
            type="checkbox"
            checked={dracoCompression}
            onChange={(e) => setDracoCompression(e.target.checked)}
            className="rounded border-border"
          />
          Enable Draco Compression
        </label>

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
      id: 'asset-browser',
      label: 'Asset Browser',
      icon: Boxes,
      render: () => <AssetBrowser />,
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
