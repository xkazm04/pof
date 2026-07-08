'use client';

import { Plus, Monitor } from 'lucide-react';
import {
  type BuildProfile, type PlatformId,
  SUPPORTED_PLATFORMS,
} from '@/lib/packaging/build-profiles';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { PLATFORM_ICONS } from './constants';

export function AddPlatformButtons({ unusedPlatforms, profiles, grouped, onNewProfile }: {
  unusedPlatforms: typeof SUPPORTED_PLATFORMS;
  profiles: BuildProfile[];
  grouped: Map<PlatformId, BuildProfile[]>;
  onNewProfile: (platform: PlatformId) => void;
}) {
  if (unusedPlatforms.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-2xs text-text-muted uppercase tracking-wider font-medium">Add:</span>
      {unusedPlatforms.map((p) => {
        const Icon = PLATFORM_ICONS[p.id] ?? Monitor;
        return (
          <button
            key={p.id}
            onClick={() => onNewProfile(p.id)}
            data-testid={`pof-module-packaging-add-platform-${p.id.toLowerCase()}`}
            className="flex items-center gap-1 px-2 py-1 rounded border border-dashed border-border-bright text-xs text-text-muted hover:text-text hover:border-[var(--systems)]/50 transition-colors"
          >
            <Icon className="w-3 h-3" />
            {p.label}
          </button>
        );
      })}
      {profiles.length > 0 && (
        <button
          onClick={() => {
            const firstPlatform = SUPPORTED_PLATFORMS[0].id;
            onNewProfile(grouped.has(firstPlatform) ? (unusedPlatforms[0]?.id ?? firstPlatform) : firstPlatform);
          }}
          className="flex items-center gap-1 px-2 py-1 rounded border border-dashed border-border-bright text-xs hover:border-[var(--systems)]/50 transition-colors"
          style={{ color: MODULE_COLORS.systems }}
        >
          <Plus className="w-3 h-3" />
          Custom
        </button>
      )}
    </div>
  );
}
