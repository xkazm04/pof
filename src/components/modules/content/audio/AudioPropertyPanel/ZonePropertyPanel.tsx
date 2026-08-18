'use client';

import { Volume2, Waves, Settings2 } from 'lucide-react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { ZONE_COLORS } from '../AudioScenePainter';
import { ReverbDecayGlyph } from '../ReverbDecayGlyph';
import type { AudioZone } from '@/types/audio-scene';
import { REVERB_PRESETS, OCCLUSION_MODES } from './constants';
import { Field, SliderField, ActionButton } from './controls';
import { SaveErrorBanner } from './SaveErrorBanner';
import { useRecordCommit } from './useRecordCommit';

interface ZonePropertyPanelProps {
  zone: AudioZone;
  /**
   * Persist ONE patch of this zone. Rejects when the server refused it — the
   * panel keeps the edit and shows a retry. Mount this panel with
   * `key={zone.id}` so a pending edit is flushed when the selection changes.
   */
  onCommit: (patch: Partial<AudioZone>) => void | Promise<unknown>;
  onGenerateCode: (zone: AudioZone) => void;
  onGenerateSoundscape: (zone: AudioZone) => void;
  accentColor: string;
  isGenerating: boolean;
}

export function ZonePropertyPanel({
  zone,
  onCommit,
  onGenerateCode,
  onGenerateSoundscape,
  accentColor,
  isGenerating,
}: ZonePropertyPanelProps) {
  const buf = useRecordCommit(zone, onCommit);
  const v = buf.value;

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Volume2 className="w-3.5 h-3.5" style={{ color: v.color }} />
        <h3 className="text-xs font-semibold text-text">Audio Zone</h3>
      </div>

      <SaveErrorBanner error={buf.error} onRetry={buf.retry} onDismiss={buf.dismissError} />

      {/* Name */}
      <Field label="Name">
        <input
          type="text"
          value={v.name}
          onChange={(e) => buf.edit('name', e.target.value)}
          onBlur={buf.release}
          aria-label="Zone name"
          className="field-input focus-ring-inset"
        />
      </Field>

      {/* Soundscape description */}
      <Field label="Soundscape Description">
        <textarea
          value={v.soundscapeDescription}
          onChange={(e) => buf.edit('soundscapeDescription', e.target.value)}
          onBlur={buf.release}
          aria-label="Zone soundscape description"
          placeholder="Describe the soundscape in natural language... e.g., 'dripping water echoing off stone walls, distant machinery hum, occasional metal groans'"
          className="field-input resize-none font-mono focus-ring-inset"
          rows={4}
        />
      </Field>

      {/* Reverb preset — each chip previews its acoustic decay signature */}
      <Field label="Reverb Preset">
        <div className="grid grid-cols-2 gap-1">
          {REVERB_PRESETS.map((preset) => {
            const selected = v.reverbPreset === preset;
            const color = ZONE_COLORS[preset] ?? 'var(--text-muted)';
            return (
              <button
                key={preset}
                type="button"
                onClick={() => buf.pick('reverbPreset', preset)}
                title={`${preset} — hover to preview its acoustic decay`}
                aria-label={`Reverb preset ${preset}`}
                aria-pressed={selected}
                className={`group flex flex-col items-center gap-0.5 px-1.5 py-1 rounded transition-colors focus-ring-inset ${
                  selected
                    ? 'bg-border-bright text-text'
                    : 'bg-surface text-text-muted hover:bg-surface-hover'
                }`}
                style={{ border: `1px solid ${selected ? 'var(--checkbox-border)' : 'var(--border)'}` }}
              >
                <ReverbDecayGlyph preset={preset} color={color} decayTimeSeconds={v.reverbDecayTime} />
                <span className="text-2xs leading-none truncate max-w-full">{preset}</span>
              </button>
            );
          })}
        </div>
      </Field>

      {/* Custom reverb params */}
      {v.reverbPreset === 'custom' && (
        <div className="space-y-2 pl-2 border-l-2 border-border-bright">
          <SliderField label="Decay Time" value={v.reverbDecayTime} min={0.1} max={10} step={0.1}
            onChange={(n) => buf.edit('reverbDecayTime', n)} onRelease={buf.release} suffix="s" />
          <SliderField label="Diffusion" value={v.reverbDiffusion} min={0} max={1} step={0.05}
            onChange={(n) => buf.edit('reverbDiffusion', n)} onRelease={buf.release} />
          <SliderField label="Wet/Dry" value={v.reverbWetDry} min={0} max={1} step={0.05}
            onChange={(n) => buf.edit('reverbWetDry', n)} onRelease={buf.release} />
        </div>
      )}

      {/* Occlusion */}
      <Field label="Occlusion">
        <div className="flex gap-1">
          {OCCLUSION_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => buf.pick('occlusionMode', mode)}
              aria-label={`Occlusion ${mode}`}
              aria-pressed={v.occlusionMode === mode}
              className={`flex-1 py-1 rounded text-2xs text-center transition-colors ${
                v.occlusionMode === mode
                  ? 'bg-border-bright text-text'
                  : 'bg-surface text-text-muted hover:bg-surface-hover'
              }`}
              style={{ border: `1px solid ${v.occlusionMode === mode ? 'var(--checkbox-border)' : 'var(--border)'}` }}
            >
              {mode}
            </button>
          ))}
        </div>
      </Field>

      {/* Attenuation */}
      <SliderField label="Attenuation Radius" value={v.attenuationRadius} min={50} max={2000} step={10}
        onChange={(n) => buf.edit('attenuationRadius', n)} onRelease={buf.release} suffix=" uu" />

      {/* Priority */}
      <SliderField label="Priority" value={v.priority} min={0} max={10} step={1}
        onChange={(n) => buf.edit('priority', n)} onRelease={buf.release} />

      {/* Actions — unchanged behaviour, but they now read the on-screen zone. */}
      <div className="space-y-1.5 pt-2 border-t border-border">
        <ActionButton
          label={isGenerating ? 'Generating...' : 'Generate Zone Code'}
          onClick={() => onGenerateCode(v)}
          disabled={isGenerating}
          accentColor={accentColor}
          icon={<Settings2 className="w-3 h-3" />}
        />
        <ActionButton
          label={isGenerating ? 'Generating...' : 'Generate from Description'}
          onClick={() => onGenerateSoundscape(v)}
          disabled={isGenerating || !v.soundscapeDescription.trim()}
          accentColor={ACCENT_VIOLET}
          icon={<Waves className="w-3 h-3" />}
        />
      </div>
    </div>
  );
}
