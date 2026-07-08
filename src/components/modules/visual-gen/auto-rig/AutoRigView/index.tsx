'use client';

import { useState, useCallback } from 'react';
import { PersonStanding } from 'lucide-react';
import { ReviewableModuleView } from '@/components/modules/shared/ReviewableModuleView';
import type { ExtraTab } from '@/components/modules/shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { RIG_PRESETS, type RigPreset } from '@/lib/visual-gen/rig-presets';
import { createArmatureScript } from '@/lib/blender-mcp/scripts/create-armature';
import { tryApiFetch } from '@/lib/api-utils';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { RigPresetCard } from './RigPresetCard';
import { presetToBones } from './helpers';

function RigTab() {
  const [selectedPreset, setSelectedPreset] = useState<string>('ue5-mannequin');
  const [creatingPresetId, setCreatingPresetId] = useState<string | null>(null);
  const [createResults, setCreateResults] = useState<Record<string, { status: 'success' | 'error'; message: string }>>({});
  const activePreset = RIG_PRESETS.find((p) => p.id === selectedPreset);

  const handleCreateInBlender = useCallback(async (preset: RigPreset) => {
    setCreatingPresetId(preset.id);
    setCreateResults((prev) => {
      const next = { ...prev };
      delete next[preset.id];
      return next;
    });

    const bones = presetToBones(preset);
    const code = createArmatureScript({
      armatureName: preset.name.replace(/\s+/g, '_'),
      bones,
    });

    const result = await tryApiFetch<unknown>('/api/blender-mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (result.ok) {
      setCreateResults((prev) => ({ ...prev, [preset.id]: { status: 'success', message: 'Armature created' } }));
    } else {
      setCreateResults((prev) => ({ ...prev, [preset.id]: { status: 'error', message: result.error } }));
    }
    setCreatingPresetId(null);
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Blender Connection */}
      <BlenderConnectionBar />

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
              onCreateInBlender={() => handleCreateInBlender(preset)}
              isCreating={creatingPresetId === preset.id}
              createResult={createResults[preset.id] ?? null}
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
