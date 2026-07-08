'use client';
import { Zap, Volume2 } from 'lucide-react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { ACCENT_VIOLET, OPACITY_15, OPACITY_30 } from '@/lib/chart-colors';
import type {
  AudioSceneDocument,
  AudioZone,
  UpdateAudioScenePayload,
} from '@/types/audio-scene';

interface SoundscapesTabProps {
  activeDoc: AudioSceneDocument;
  handleDescriptionChange: (description: string) => void;
  updateDoc: (payload: UpdateAudioScenePayload) => Promise<AudioSceneDocument | null>;
  handleGenerateSoundscape: (zone: AudioZone) => void;
  audioCli: ReturnType<typeof useModuleCLI>;
}

export function SoundscapesTab({
  activeDoc,
  handleDescriptionChange,
  updateDoc,
  handleGenerateSoundscape,
  audioCli,
}: SoundscapesTabProps) {
  return (
    <div className="overflow-y-auto p-5 space-y-5">
      {/* Scene description */}
      <div>
        <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
          Scene Description
        </label>
        <textarea
          value={activeDoc.description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Describe the overall audio atmosphere for this scene..."
          className="w-full px-4 py-3 bg-surface-deep border border-border rounded-lg text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors resize-none leading-relaxed"
          rows={3}
        />
      </div>

      {/* Per-zone soundscapes */}
      {activeDoc.zones.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-text">Zone Soundscapes</h3>
          {activeDoc.zones.map((zone) => {
            const zoneEmitters = activeDoc.emitters.filter((e) => e.zoneId === zone.id);
            return (
              <div key={zone.id} className="p-3 rounded-lg bg-surface-deep border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: zone.color }} />
                  <h4 className="text-xs font-semibold text-text">{zone.name}</h4>
                  <span className="text-2xs text-text-muted">{zone.reverbPreset} · {zone.occlusionMode}</span>
                </div>
                <textarea
                  value={zone.soundscapeDescription}
                  onChange={(e) => {
                    const zones = activeDoc.zones.map((z) =>
                      z.id === zone.id ? { ...z, soundscapeDescription: e.target.value } : z
                    );
                    updateDoc({ id: activeDoc.id, zones });
                  }}
                  placeholder={`Describe the soundscape for "${zone.name}"...\ne.g., 'dripping water echoing off stone walls, distant machinery hum'`}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-md text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors resize-none leading-relaxed font-mono"
                  rows={3}
                />
                {zoneEmitters.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {zoneEmitters.map((em) => (
                      <span key={em.id} className="px-2 py-0.5 rounded text-2xs bg-surface border border-border text-text-muted-hover">
                        {em.name} ({em.type})
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => handleGenerateSoundscape(zone)}
                  disabled={audioCli.isRunning || !zone.soundscapeDescription.trim()}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: `${ACCENT_VIOLET}${OPACITY_15}`,
                    color: ACCENT_VIOLET,
                    border: `1px solid ${ACCENT_VIOLET}${OPACITY_30}`,
                  }}
                >
                  <Zap className="w-3 h-3" />
                  Generate from Description
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <Volume2 className="w-8 h-8 mx-auto text-border-bright mb-2" />
          <p className="text-xs text-text-muted">
            No zones yet. Switch to the Scene Painter tab to paint audio zones.
          </p>
        </div>
      )}
    </div>
  );
}
