'use client';

import { useState, useMemo } from 'react';
import { FileUp, Code, Copy, Check } from 'lucide-react';
import { StyledSlider } from '@/components/ui/StyledSlider';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import {
  generateImportScript,
  generateDataAsset,
  DEFAULT_IMPORT_CONFIG,
  type ImportConfig,
} from '@/lib/visual-gen/ue5-import-templates';

function ConfigTab() {
  const [config, setConfig] = useState<ImportConfig>({ ...DEFAULT_IMPORT_CONFIG });
  const [activeOutput, setActiveOutput] = useState<'import' | 'dataasset'>('import');
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => {
    return activeOutput === 'import'
      ? generateImportScript(config)
      : generateDataAsset(config);
  }, [config, activeOutput]);

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateConfig = <K extends keyof ImportConfig>(key: K, value: ImportConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Left: Config form */}
      <div className="w-72 shrink-0 space-y-4 overflow-y-auto pr-2">
        <div>
          <label className="text-xs text-text-muted mb-1 block">Asset Name</label>
          <input
            type="text"
            value={config.assetName}
            onChange={(e) => updateConfig('assetName', e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-sm text-text focus:outline-none focus:border-[var(--visual-gen)]"
          />
        </div>

        <div>
          <label className="text-xs text-text-muted mb-1 block">Source Format</label>
          <div className="flex gap-1.5">
            {(['fbx', 'gltf', 'glb'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => updateConfig('format', fmt)}
                className={`px-2.5 py-1 rounded text-xs uppercase ${
                  config.format === fmt
                    ? 'bg-[var(--visual-gen)] text-white'
                    : 'text-text-muted border border-border hover:text-text'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-text-muted mb-1 block">Mesh Type</label>
          <div className="flex gap-1.5">
            {(['static', 'skeletal'] as const).map((t) => (
              <button
                key={t}
                onClick={() => updateConfig('meshType', t)}
                className={`flex-1 px-2.5 py-1 rounded text-xs capitalize ${
                  config.meshType === t
                    ? 'bg-[var(--visual-gen)] text-white'
                    : 'text-text-muted border border-border hover:text-text'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <StyledSlider
            min={0.01}
            max={100}
            step={0.1}
            value={config.scale}
            onChange={(v) => updateConfig('scale', v)}
            accentColor="var(--visual-gen)"
            label={`Scale: ${config.scale.toFixed(1)}`}
          />
        </div>

        <div>
          <label className="text-xs text-text-muted mb-1 block">Content Path</label>
          <input
            type="text"
            value={config.contentPath}
            onChange={(e) => updateConfig('contentPath', e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-sm text-text font-mono focus:outline-none focus:border-[var(--visual-gen)]"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={config.generateCollision}
            onChange={(e) => updateConfig('generateCollision', e.target.checked)}
            className="rounded"
          />
          Auto-generate collision
        </label>

        <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={config.importMaterials}
            onChange={(e) => updateConfig('importMaterials', e.target.checked)}
            className="rounded"
          />
          Import materials
        </label>
      </div>

      {/* Right: Code preview */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setActiveOutput('import')}
            className={`px-2.5 py-1 rounded text-xs ${
              activeOutput === 'import'
                ? 'bg-[var(--visual-gen)] text-white'
                : 'text-text-muted border border-border'
            }`}
          >
            Import Script
          </button>
          <button
            onClick={() => setActiveOutput('dataasset')}
            className={`px-2.5 py-1 rounded text-xs ${
              activeOutput === 'dataasset'
                ? 'bg-[var(--visual-gen)] text-white'
                : 'text-text-muted border border-border'
            }`}
          >
            DataAsset
          </button>
          <div className="flex-1" />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-text-muted hover:text-text transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="flex-1 overflow-auto rounded-lg bg-[var(--surface-deep)] border border-border p-4 text-xs font-mono text-text-muted whitespace-pre-wrap">
          {output}
        </pre>
      </div>
    </div>
  );
}

export function ImportAutomationView() {
  const mod = SUB_MODULE_MAP['import-automation'];
  const cat = getCategoryForSubModule('import-automation');

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    {
      id: 'config',
      label: 'Config',
      icon: FileUp,
      render: () => <ConfigTab />,
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="import-automation"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('import-automation')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
