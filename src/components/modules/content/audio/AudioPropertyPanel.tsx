'use client';

import { useCallback } from 'react';
import { Volume2, Radio, Waves, Settings2 } from 'lucide-react';
import type {
  AudioZone,
  SoundEmitter,
  ReverbPreset,
  OcclusionMode,
  EmitterType,
} from '@/types/audio-scene';

// ── Zone property panel ──

interface ZonePropertyPanelProps {
  zone: AudioZone;
  onUpdate: (zone: AudioZone) => void;
  onGenerateCode: (zone: AudioZone) => void;
  onGenerateSoundscape: (zone: AudioZone) => void;
  accentColor: string;
  isGenerating: boolean;
}

const REVERB_PRESETS: ReverbPreset[] = [
  'none', 'small-room', 'large-hall', 'cave', 'outdoor',
  'underwater', 'metal-corridor', 'stone-chamber', 'forest', 'custom',
];

const OCCLUSION_MODES: OcclusionMode[] = ['none', 'low', 'medium', 'high', 'full'];

export function ZonePropertyPanel({
  zone,
  onUpdate,
  onGenerateCode,
  onGenerateSoundscape,
  accentColor,
  isGenerating,
}: ZonePropertyPanelProps) {
  const update = useCallback(<K extends keyof AudioZone>(key: K, value: AudioZone[K]) => {
    onUpdate({ ...zone, [key]: value });
  }, [zone, onUpdate]);

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Volume2 className="w-3.5 h-3.5" style={{ color: zone.color }} />
        <h3 className="text-xs font-semibold text-text">Audio Zone</h3>
      </div>

      {/* Name */}
      <Field label="Name">
        <input
          type="text"
          value={zone.name}
          onChange={(e) => update('name', e.target.value)}
          className="field-input"
        />
      </Field>

      {/* Soundscape description */}
      <Field label="Soundscape Description">
        <textarea
          value={zone.soundscapeDescription}
          onChange={(e) => update('soundscapeDescription', e.target.value)}
          placeholder="Describe the soundscape in natural language... e.g., 'dripping water echoing off stone walls, distant machinery hum, occasional metal groans'"
          className="field-input resize-none font-mono"
          rows={4}
        />
      </Field>

      {/* Reverb preset */}
      <Field label="Reverb Preset">
        <div className="flex flex-wrap gap-1">
          {REVERB_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => update('reverbPreset', preset)}
              className={`px-2 py-1 rounded text-2xs transition-colors ${
                zone.reverbPreset === preset
                  ? 'bg-border-bright text-text border-[#3e3e6a]'
                  : 'bg-surface text-text-muted border-border hover:bg-surface-hover'
              }`}
              style={{ border: '1px solid' }}
            >
              {preset}
            </button>
          ))}
        </div>
      </Field>

      {/* Custom reverb params */}
      {zone.reverbPreset === 'custom' && (
        <div className="space-y-2 pl-2 border-l-2 border-border-bright">
          <SliderField label="Decay Time" value={zone.reverbDecayTime} min={0.1} max={10} step={0.1}
            onChange={(v) => update('reverbDecayTime', v)} suffix="s" />
          <SliderField label="Diffusion" value={zone.reverbDiffusion} min={0} max={1} step={0.05}
            onChange={(v) => update('reverbDiffusion', v)} />
          <SliderField label="Wet/Dry" value={zone.reverbWetDry} min={0} max={1} step={0.05}
            onChange={(v) => update('reverbWetDry', v)} />
        </div>
      )}

      {/* Occlusion */}
      <Field label="Occlusion">
        <div className="flex gap-1">
          {OCCLUSION_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => update('occlusionMode', mode)}
              className={`flex-1 py-1 rounded text-2xs text-center transition-colors ${
                zone.occlusionMode === mode
                  ? 'bg-border-bright text-text'
                  : 'bg-surface text-text-muted hover:bg-surface-hover'
              }`}
              style={{ border: `1px solid ${zone.occlusionMode === mode ? '#3e3e6a' : 'var(--border)'}` }}
            >
              {mode}
            </button>
          ))}
        </div>
      </Field>

      {/* Attenuation */}
      <SliderField label="Attenuation Radius" value={zone.attenuationRadius} min={50} max={2000} step={10}
        onChange={(v) => update('attenuationRadius', v)} suffix=" uu" />

      {/* Priority */}
      <SliderField label="Priority" value={zone.priority} min={0} max={10} step={1}
        onChange={(v) => update('priority', v)} />

      {/* Actions */}
      <div className="space-y-1.5 pt-2 border-t border-border">
        <ActionButton
          label={isGenerating ? 'Generating...' : 'Generate Zone Code'}
          onClick={() => onGenerateCode(zone)}
          disabled={isGenerating}
          accentColor={accentColor}
          icon={<Settings2 className="w-3 h-3" />}
        />
        <ActionButton
          label={isGenerating ? 'Generating...' : 'Generate from Description'}
          onClick={() => onGenerateSoundscape(zone)}
          disabled={isGenerating || !zone.soundscapeDescription.trim()}
          accentColor="#a78bfa"
          icon={<Waves className="w-3 h-3" />}
        />
      </div>
    </div>
  );
}

// ── Emitter property panel ──

interface EmitterPropertyPanelProps {
  emitter: SoundEmitter;
  onUpdate: (emitter: SoundEmitter) => void;
  accentColor: string;
}

const EMITTER_TYPES: EmitterType[] = ['ambient', 'point', 'loop', 'oneshot', 'music'];

export function EmitterPropertyPanel({
  emitter,
  onUpdate,
  accentColor,
}: EmitterPropertyPanelProps) {
  const update = useCallback(<K extends keyof SoundEmitter>(key: K, value: SoundEmitter[K]) => {
    onUpdate({ ...emitter, [key]: value });
  }, [emitter, onUpdate]);

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Radio className="w-3.5 h-3.5" style={{ color: accentColor }} />
        <h3 className="text-xs font-semibold text-text">Sound Emitter</h3>
      </div>

      {/* Name */}
      <Field label="Name">
        <input
          type="text"
          value={emitter.name}
          onChange={(e) => update('name', e.target.value)}
          className="field-input"
        />
      </Field>

      {/* Type */}
      <Field label="Type">
        <div className="flex flex-wrap gap-1">
          {EMITTER_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => update('type', type)}
              className={`px-2 py-1 rounded text-2xs capitalize transition-colors ${
                emitter.type === type
                  ? 'bg-border-bright text-text'
                  : 'bg-surface text-text-muted hover:bg-surface-hover'
              }`}
              style={{ border: `1px solid ${emitter.type === type ? '#3e3e6a' : 'var(--border)'}` }}
            >
              {type}
            </button>
          ))}
        </div>
      </Field>

      {/* Sound Cue ref */}
      <Field label="Sound Cue">
        <input
          type="text"
          value={emitter.soundCueRef}
          onChange={(e) => update('soundCueRef', e.target.value)}
          placeholder="/Game/Audio/SC_Ambient..."
          className="field-input font-mono"
        />
      </Field>

      {/* Volume */}
      <SliderField label="Volume" value={emitter.volumeMultiplier} min={0} max={2} step={0.05}
        onChange={(v) => update('volumeMultiplier', v)} />

      {/* Pitch range */}
      <div className="grid grid-cols-2 gap-2">
        <SliderField label="Pitch Min" value={emitter.pitchMin} min={0.5} max={2} step={0.05}
          onChange={(v) => update('pitchMin', v)} />
        <SliderField label="Pitch Max" value={emitter.pitchMax} min={0.5} max={2} step={0.05}
          onChange={(v) => update('pitchMax', v)} />
      </div>

      {/* Attenuation */}
      <SliderField label="Attenuation" value={emitter.attenuationRadius} min={10} max={1000} step={10}
        onChange={(v) => update('attenuationRadius', v)} suffix=" uu" />

      {/* Spawn chance */}
      <SliderField label="Spawn Chance" value={emitter.spawnChance} min={0} max={1} step={0.05}
        onChange={(v) => update('spawnChance', v)} suffix="%" displayValue={Math.round(emitter.spawnChance * 100)} />

      {/* Cooldown */}
      <SliderField label="Cooldown" value={emitter.cooldownSeconds} min={0} max={60} step={0.5}
        onChange={(v) => update('cooldownSeconds', v)} suffix="s" />
    </div>
  );
}

// ── Shared UI components ──

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-2xs uppercase tracking-wider text-text-muted mb-1 block font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

function SliderField({
  label, value, min, max, step, onChange, suffix, displayValue,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string; displayValue?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold">{label}</span>
        <span className="text-xs text-text-muted-hover tabular-nums">{displayValue ?? value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none bg-border accent-[#60a5fa]"
      />
    </div>
  );
}

function ActionButton({
  label, onClick, disabled, accentColor, icon,
}: {
  label: string; onClick: () => void; disabled: boolean; accentColor: string; icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all disabled:opacity-50"
      style={{
        backgroundColor: `${accentColor}24`,
        color: accentColor,
        border: `1px solid ${accentColor}38`,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
