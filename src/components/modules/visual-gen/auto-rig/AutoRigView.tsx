'use client';

import { useState } from 'react';
import { PersonStanding, CheckCircle } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { RIG_PRESETS, type RigPreset } from '@/lib/visual-gen/rig-presets';

function RigPresetCard({ preset, selected, onSelect }: {
  preset: RigPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`relative text-left p-4 rounded-lg border transition-colors ${
        selected
          ? 'border-[var(--visual-gen)] bg-[var(--visual-gen)]/10'
          : 'border-border hover:border-text-muted'
      }`}
    >
      {selected && (
        <CheckCircle size={16} className="absolute top-2 right-2 text-[var(--visual-gen)]" />
      )}
      <h4 className="text-sm font-medium text-text">{preset.name}</h4>
      <p className="text-xs text-text-muted mt-1">{preset.description}</p>
      <div className="flex gap-3 mt-2 text-[10px] text-text-muted">
        <span>{preset.boneCount} bones</span>
        {preset.hasFingers && <span>Fingers</span>}
        {preset.hasFaceRig && <span>Face rig</span>}
      </div>
      <div className="mt-2">
        <span className="text-[10px] text-text-muted">IK Chains: </span>
        {preset.ikChains.map((chain, i) => (
          <span key={chain.name} className="text-[10px] text-[var(--visual-gen)]">
            {chain.name}{i < preset.ikChains.length - 1 ? ', ' : ''}
          </span>
        ))}
      </div>
    </button>
  );
}

function RigTab() {
  const [selectedPreset, setSelectedPreset] = useState<string>('ue5-mannequin');
  const activePreset = RIG_PRESETS.find((p) => p.id === selectedPreset);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-base font-semibold text-text">Auto-Rig Setup</h2>
        <p className="text-xs text-text-muted mt-1">
          Choose a target skeleton, then follow the Roadmap checklist for rigging workflow
        </p>
      </div>

      {/* Rig preset selector */}
      <div>
        <label className="text-xs text-text-muted mb-2 block">Target Skeleton Preset</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {RIG_PRESETS.map((preset) => (
            <RigPresetCard
              key={preset.id}
              preset={preset}
              selected={selectedPreset === preset.id}
              onSelect={() => setSelectedPreset(preset.id)}
            />
          ))}
        </div>
      </div>

      {/* Mixamo workflow guide */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h3 className="text-sm font-medium text-text">Mixamo Rigging Workflow</h3>
        <ol className="space-y-2 text-xs text-text-muted">
          <li className="flex gap-2">
            <span className="text-[var(--visual-gen)] font-bold shrink-0">1.</span>
            <span>Export your character mesh as FBX from Blender (mesh only, no armature)</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--visual-gen)] font-bold shrink-0">2.</span>
            <span>Upload to <a href="https://www.mixamo.com" target="_blank" rel="noopener noreferrer" className="text-[var(--visual-gen)] hover:underline">mixamo.com</a> (free Adobe account required)</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--visual-gen)] font-bold shrink-0">3.</span>
            <span>Place bone markers on chin, wrists, elbows, knees, and groin</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--visual-gen)] font-bold shrink-0">4.</span>
            <span>Select skeleton type and finger count, then process</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--visual-gen)] font-bold shrink-0">5.</span>
            <span>Preview with test animations, adjust if needed</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--visual-gen)] font-bold shrink-0">6.</span>
            <span>Download as FBX (with skin, 30 fps)</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--visual-gen)] font-bold shrink-0">7.</span>
            <span>Import into UE5 and retarget to {activePreset?.name ?? 'target skeleton'}</span>
          </li>
        </ol>
      </div>

      {/* Bone mapping preview */}
      {activePreset && activePreset.mixamoMapping.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium text-text mb-2">
            Mixamo → {activePreset.name} Bone Mapping
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs max-h-48 overflow-y-auto">
            <div className="font-medium text-text-muted">Mixamo Bone</div>
            <div className="font-medium text-text-muted">{activePreset.name} Bone</div>
            {activePreset.mixamoMapping.map(({ sourceBone, targetBone }) => (
              <div key={sourceBone} className="contents">
                <div className="text-text-muted font-mono">{sourceBone}</div>
                <div className="text-[var(--visual-gen)] font-mono">{targetBone}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AutoRigView() {
  const mod = SUB_MODULE_MAP['auto-rig'];
  const cat = getCategoryForSubModule('auto-rig');

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    {
      id: 'rig',
      label: 'Rig Setup',
      icon: PersonStanding,
      render: () => <RigTab />,
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="auto-rig"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('auto-rig')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
