'use client';

import { CheckCircle, Bone, Loader2, XCircle, CheckCircle2 } from 'lucide-react';
import { type RigPreset } from '@/lib/visual-gen/rig-presets';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { VISUAL_GEN_FOCUS_RING } from '@/lib/visual-gen/ui';
import { MAX_BONE_COUNT, boneComplexityColor } from './helpers';

export function RigPresetCard({ preset, selected, onSelect, onCreateInBlender, isCreating, createResult }: {
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
      <button
        onClick={onSelect}
        aria-pressed={selected}
        className={`w-full text-left rounded-lg ${VISUAL_GEN_FOCUS_RING}`}
      >
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
