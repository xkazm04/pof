'use client';

import { BridgeStatusCard } from './BridgeStatusCard';
import { AssetManifestCard } from './AssetManifestCard';
import { LiveStatePlaceholderCards } from './LiveStatePlaceholderCards';
import { CatalogLiveGrid } from './CatalogLiveGrid';

/**
 * Top-level body for the Live State L1 tab. Phase 6 focused scope:
 * BridgeStatusCard (left) + AssetManifestCard (right), then a grid of
 * placeholder cards announcing Phase 6b + Phase 10 enhancements (live
 * UObject inspector, crash watchtower, 3D zone twin, time-travel replay).
 */
export function LiveStateTab() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">Live State</h1>
        <p className="text-sm text-text-muted">
          What&apos;s actually in UE right now. Live UObject + crash watchtower + 3D zone twin land in Phase 6b / Phase 10.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 max-w-5xl">
        <BridgeStatusCard />
        <AssetManifestCard />
      </div>

      <div className="mb-6">
        <CatalogLiveGrid />
      </div>

      <div className="max-w-5xl">
        <LiveStatePlaceholderCards />
      </div>
    </div>
  );
}
