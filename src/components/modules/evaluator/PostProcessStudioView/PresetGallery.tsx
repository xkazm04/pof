'use client';

import { Camera, Zap } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { PPPreset } from '@/types/post-process-studio';
import { ACCENT } from './constants';

// ── Preset Gallery ──────────────────────────────────────────────────────────

export function PresetGallery({
  presets,
  activePresetId,
  onApply,
  onReset,
}: {
  presets: PPPreset[];
  activePresetId: string | null;
  onApply: (id: string) => void;
  onReset: () => void;
}) {
  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Camera className="w-4 h-4" style={{ color: ACCENT }} />
        <h2 className="text-sm font-medium text-text">Cinematic Presets</h2>
        {activePresetId && (
          <button
            onClick={onReset}
            className="ml-auto text-2xs text-text-muted hover:text-text transition-colors"
          >
            Reset to defaults
          </button>
        )}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {presets.map((p) => {
          const isActive = p.id === activePresetId;
          return (
            <button
              key={p.id}
              onClick={() => onApply(p.id)}
              className={`group relative rounded-xl overflow-hidden border transition-all duration-base ${
                isActive
                  ? 'border-violet-500/50 ring-1 ring-violet-500/20'
                  : 'border-border hover:border-border-bright'
              }`}
            >
              {/* Gradient thumbnail */}
              <div
                className="h-14 w-full"
                style={{
                  background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})`,
                }}
              />
              <div className="px-2 py-1.5 bg-surface">
                <div className="text-2xs font-medium text-text truncate">{p.name}</div>
                <div className="text-2xs text-text-muted/60 truncate">{p.description}</div>
              </div>
              {isActive && (
                <div
                  className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: ACCENT }}
                >
                  <Zap className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
