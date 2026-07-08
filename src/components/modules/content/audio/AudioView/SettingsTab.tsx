'use client';
import type { AudioSceneDocument } from '@/types/audio-scene';

interface SettingsTabProps {
  activeDoc: AudioSceneDocument;
  handleSettingsChange: (
    key: 'soundPoolSize' | 'maxConcurrentSounds' | 'globalReverbPreset',
    value: unknown
  ) => void;
}

export function SettingsTab({ activeDoc, handleSettingsChange }: SettingsTabProps) {
  return (
    <div className="overflow-y-auto p-5 space-y-5">
      <h3 className="text-xs font-semibold text-text">Audio System Settings</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-2xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
            Sound Pool Size
          </label>
          <input
            type="number"
            value={activeDoc.soundPoolSize}
            onChange={(e) => handleSettingsChange('soundPoolSize', Math.max(1, Number(e.target.value)))}
            min={1} max={256}
            className="w-full px-3 py-2 bg-surface-deep border border-border rounded-md text-xs text-text outline-none focus:border-border-bright transition-colors"
          />
          <p className="text-2xs text-text-muted mt-1">Pre-allocated audio components for pooling</p>
        </div>

        <div>
          <label className="text-2xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
            Max Concurrent Sounds
          </label>
          <input
            type="number"
            value={activeDoc.maxConcurrentSounds}
            onChange={(e) => handleSettingsChange('maxConcurrentSounds', Math.max(1, Number(e.target.value)))}
            min={1} max={128}
            className="w-full px-3 py-2 bg-surface-deep border border-border rounded-md text-xs text-text outline-none focus:border-border-bright transition-colors"
          />
          <p className="text-2xs text-text-muted mt-1">Limit on simultaneous active sounds</p>
        </div>
      </div>

      <div>
        <label className="text-2xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
          Global Reverb Fallback
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(['none', 'small-room', 'large-hall', 'outdoor'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => handleSettingsChange('globalReverbPreset', preset)}
              className={`px-2.5 py-1.5 rounded text-xs transition-colors ${
                activeDoc.globalReverbPreset === preset
                  ? 'bg-border-bright text-text'
                  : 'bg-surface text-text-muted hover:bg-surface-hover'
              }`}
              style={{ border: `1px solid ${activeDoc.globalReverbPreset === preset ? 'var(--checkbox-border)' : 'var(--border)'}` }}
            >
              {preset}
            </button>
          ))}
        </div>
        <p className="text-2xs text-text-muted mt-1">Default reverb when player is outside all zones</p>
      </div>

      {/* Zone overview table */}
      {activeDoc.zones.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text mb-3">Zone Overview</h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface text-text-muted">
                  <th className="text-left px-3 py-2 font-semibold">Zone</th>
                  <th className="text-left px-3 py-2 font-semibold">Reverb</th>
                  <th className="text-left px-3 py-2 font-semibold">Occlusion</th>
                  <th className="text-right px-3 py-2 font-semibold">Attenuation</th>
                  <th className="text-right px-3 py-2 font-semibold">Priority</th>
                  <th className="text-right px-3 py-2 font-semibold">Emitters</th>
                </tr>
              </thead>
              <tbody>
                {activeDoc.zones.map((zone) => {
                  const emCount = activeDoc.emitters.filter((e) => e.zoneId === zone.id).length;
                  return (
                    <tr key={zone.id} className="border-t border-border text-text-muted-hover">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: zone.color }} />
                          <span className="text-text">{zone.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">{zone.reverbPreset}</td>
                      <td className="px-3 py-2">{zone.occlusionMode}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{zone.attenuationRadius}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{zone.priority}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{emCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
