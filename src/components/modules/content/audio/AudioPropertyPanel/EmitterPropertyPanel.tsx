'use client';

import { Radio } from 'lucide-react';
import type { SoundEmitter } from '@/types/audio-scene';
import { AssetSetPicker } from './AssetSetPicker';
import { EMITTER_TYPES } from './constants';
import { Field, SliderField } from './controls';
import { SaveErrorBanner } from './SaveErrorBanner';
import { useRecordCommit } from './useRecordCommit';

interface EmitterPropertyPanelProps {
  emitter: SoundEmitter;
  /**
   * Persist ONE patch of this emitter. Rejects when the server refused it.
   * Mount with `key={emitter.id}` so a pending edit is flushed on deselect.
   */
  onCommit: (patch: Partial<SoundEmitter>) => void | Promise<unknown>;
  accentColor: string;
}

export function EmitterPropertyPanel({
  emitter,
  onCommit,
  accentColor,
}: EmitterPropertyPanelProps) {
  const buf = useRecordCommit(emitter, onCommit);
  const v = buf.value;

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Radio className="w-3.5 h-3.5" style={{ color: accentColor }} />
        <h3 className="text-xs font-semibold text-text">Sound Emitter</h3>
      </div>

      <SaveErrorBanner error={buf.error} onRetry={buf.retry} onDismiss={buf.dismissError} />

      {/* Name */}
      <Field label="Name">
        <input
          type="text"
          value={v.name}
          onChange={(e) => buf.edit('name', e.target.value)}
          onBlur={buf.release}
          aria-label="Emitter name"
          className="field-input focus-ring-inset"
        />
      </Field>

      {/* Type */}
      <Field label="Type">
        <div className="flex flex-wrap gap-1">
          {EMITTER_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => buf.pick('type', type)}
              aria-label={`Emitter type ${type}`}
              aria-pressed={v.type === type}
              className={`px-2 py-1 rounded text-2xs capitalize transition-colors ${
                v.type === type
                  ? 'bg-border-bright text-text'
                  : 'bg-surface text-text-muted hover:bg-surface-hover'
              }`}
              style={{ border: `1px solid ${v.type === type ? 'var(--checkbox-border)' : 'var(--border)'}` }}
            >
              {type}
            </button>
          ))}
        </div>
      </Field>

      {/* What this emitter is actually pointed at. The binding is the primary
          route (codegen resolves the set's REAL imported cue path); the raw path
          box below it is the manual override. */}
      <AssetSetPicker
        assetSetId={v.assetSetId ?? null}
        onBind={(setId) => buf.pick('assetSetId', setId)}
      />

      {/* Sound Cue ref — manual override, deliberately secondary */}
      <Field label="Sound Cue path (manual override)">
        <input
          type="text"
          value={v.soundCueRef}
          onChange={(e) => buf.edit('soundCueRef', e.target.value)}
          onBlur={buf.release}
          aria-label="Sound cue path"
          placeholder="/Game/Audio/SC_Ambient..."
          className="field-input font-mono focus-ring-inset"
        />
        <p className="mt-1 text-2xs text-text-muted">
          {v.assetSetId
            ? 'The bound set’s imported path wins; this is used only if it has no recorded import.'
            : 'Nothing is bound, so codegen uses this path — or, if it is blank, a labelled placeholder.'}
        </p>
      </Field>

      {/* Volume */}
      <SliderField label="Volume" value={v.volumeMultiplier} min={0} max={2} step={0.05}
        onChange={(n) => buf.edit('volumeMultiplier', n)} onRelease={buf.release} />

      {/* Pitch range */}
      <div className="grid grid-cols-2 gap-2">
        <SliderField label="Pitch Min" value={v.pitchMin} min={0.5} max={2} step={0.05}
          onChange={(n) => buf.edit('pitchMin', n)} onRelease={buf.release} />
        <SliderField label="Pitch Max" value={v.pitchMax} min={0.5} max={2} step={0.05}
          onChange={(n) => buf.edit('pitchMax', n)} onRelease={buf.release} />
      </div>

      {/* Attenuation */}
      <SliderField label="Attenuation" value={v.attenuationRadius} min={10} max={1000} step={10}
        onChange={(n) => buf.edit('attenuationRadius', n)} onRelease={buf.release} suffix=" uu" />

      {/* Spawn chance */}
      <SliderField label="Spawn Chance" value={v.spawnChance} min={0} max={1} step={0.05}
        onChange={(n) => buf.edit('spawnChance', n)} onRelease={buf.release}
        suffix="%" displayValue={Math.round(v.spawnChance * 100)} />

      {/* Cooldown */}
      <SliderField label="Cooldown" value={v.cooldownSeconds} min={0} max={60} step={0.5}
        onChange={(n) => buf.edit('cooldownSeconds', n)} onRelease={buf.release} suffix="s" />
    </div>
  );
}
