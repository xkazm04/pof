'use client';

import { useState, useCallback } from 'react';
import { PersonStanding, CheckCircle, Bone, Loader2, XCircle, CheckCircle2 } from 'lucide-react';
import { ReviewableModuleView } from '@/components/modules/shared/ReviewableModuleView';
import type { ExtraTab } from '@/components/modules/shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { RIG_PRESETS, type RigPreset } from '@/lib/visual-gen/rig-presets';
import { createArmatureScript, type BoneDefinition } from '@/lib/blender-mcp/scripts/create-armature';
import { tryApiFetch } from '@/lib/api-utils';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

/** Convert an IK chain from a rig preset into BoneDefinition[] for Blender. */
function presetToBones(preset: RigPreset): BoneDefinition[] {
  const bones: BoneDefinition[] = [];
  const spacing = 0.15;

  // Root bone
  bones.push({
    name: preset.rootBone,
    head: [0, 0, 0],
    tail: [0, 0, spacing],
  });

  // Build a simplified humanoid skeleton from the IK chains
  const spineChain = preset.ikChains.find((c) => c.name === 'Spine');
  if (spineChain) {
    bones.push(
      { name: spineChain.startBone, head: [0, 0, spacing], tail: [0, 0, spacing * 4], parent: preset.rootBone },
      { name: spineChain.endBone, head: [0, 0, spacing * 4], tail: [0, 0, spacing * 5], parent: spineChain.startBone },
    );
  }

  const armChains = preset.ikChains.filter((c) => c.name.includes('Arm'));
  armChains.forEach((chain) => {
    const side = chain.name.includes('Left') ? -1 : 1;
    const parentBone = spineChain?.endBone ?? preset.rootBone;
    bones.push(
      { name: chain.startBone, head: [side * spacing * 2, 0, spacing * 4], tail: [side * spacing * 4, 0, spacing * 4], parent: parentBone },
      { name: chain.endBone, head: [side * spacing * 4, 0, spacing * 4], tail: [side * spacing * 6, 0, spacing * 4], parent: chain.startBone },
    );
  });

  const legChains = preset.ikChains.filter((c) => c.name.includes('Leg'));
  legChains.forEach((chain) => {
    const side = chain.name.includes('Left') ? -1 : 1;
    const parentBone = spineChain?.startBone ?? preset.rootBone;
    bones.push(
      { name: chain.startBone, head: [side * spacing, 0, spacing], tail: [side * spacing, 0, -spacing * 2], parent: parentBone },
      { name: chain.endBone, head: [side * spacing, 0, -spacing * 2], tail: [side * spacing, 0, -spacing * 3], parent: chain.startBone },
    );
  });

  return bones;
}

const MAX_BONE_COUNT = Math.max(...RIG_PRESETS.map((p) => p.boneCount));

function boneComplexityColor(count: number): string {
  if (count < 50) return 'bg-emerald-500';
  if (count <= 200) return 'bg-amber-500';
  return 'bg-rose-500';
}

function RigPresetCard({ preset, selected, onSelect, onCreateInBlender, isCreating, createResult }: {
  preset: RigPreset;
  selected: boolean;
  onSelect: () => void;
  onCreateInBlender: () => void;
  isCreating: boolean;
  createResult: { status: 'success' | 'error'; message: string } | null;
}) {
  const connected = useBlenderMCPStore((s) => s.connection.connected);
  const barWidth = Math.max(4, (preset.boneCount / MAX_BONE_COUNT) * 100);

  return (
    <div
      className={`relative text-left p-4 rounded-lg border transition-colors ${
        selected
          ? 'border-[var(--visual-gen)] bg-[var(--visual-gen)]/10'
          : 'border-border hover:border-text-muted'
      }`}
    >
      <button onClick={onSelect} className="w-full text-left">
        {selected && (
          <CheckCircle size={16} className="absolute top-2 right-2 text-[var(--visual-gen)]" />
        )}
        <h4 className="text-sm font-medium text-text">{preset.name}</h4>
        <p className="text-xs text-text-muted mt-1">{preset.description}</p>
        <div className="flex gap-3 mt-2 text-xs text-text-muted">
          <span>{preset.boneCount} bones</span>
          {preset.hasFingers && <span>Fingers</span>}
          {preset.hasFaceRig && <span>Face rig</span>}
        </div>
        {/* Bone count complexity bar */}
        <div className="flex items-center gap-1.5 mt-2">
          <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
            <div
              className={`h-full rounded-full ${boneComplexityColor(preset.boneCount)}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <span className="text-[10px] leading-none text-text-muted font-medium tabular-nums">
            {preset.boneCount}
          </span>
        </div>
        <div className="mt-2">
          <span className="text-xs text-text-muted">IK Chains: </span>
          {preset.ikChains.map((chain, i) => (
            <span key={chain.name} className="text-xs text-[var(--visual-gen)]">
              {chain.name}{i < preset.ikChains.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      </button>

      {/* Create in Blender button */}
      <button
        onClick={(e) => { e.stopPropagation(); onCreateInBlender(); }}
        disabled={!connected || isCreating}
        className="flex items-center gap-1.5 mt-3 px-2 py-1 rounded text-[11px] font-medium transition-colors bg-[var(--visual-gen)]/10 text-[var(--visual-gen)] hover:bg-[var(--visual-gen)]/20 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isCreating ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Bone className="w-3 h-3" />
        )}
        {isCreating ? 'Creating...' : 'Create in Blender'}
      </button>

      {createResult?.status === 'success' && (
        <div className="flex items-center gap-1 mt-2 text-xs text-emerald-400">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          Armature created
        </div>
      )}
      {createResult?.status === 'error' && (
        <div className="flex items-start gap-1 mt-2 text-xs text-red-400">
          <XCircle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>{createResult.message}</span>
        </div>
      )}
    </div>
  );
}

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
