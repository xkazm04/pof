import { Download, Package } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { useMarketplaceStore } from '@/stores/marketplaceStore';
import type { AcquiredAsset } from '@/types/marketplace';

// ── Acquired Assets List ────────────────────────────────────────────────────

export function AcquiredAssetsList({ acquiredAssets, projectName }: {
  acquiredAssets: Record<string, AcquiredAsset>;
  projectName: string;
}) {
  const entries = Object.values(acquiredAssets);
  const removeAcquiredAsset = useMarketplaceStore((s) => s.removeAcquiredAsset);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Download className="w-10 h-10 text-text-muted/30 mb-3" />
        <p className="text-sm text-text-muted">No acquired assets yet</p>
        <p className="text-xs text-text-muted/70 mt-1">
          Mark assets as acquired from the Recommendations tab
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((asset) => (
        <SurfaceCard key={asset.assetId} className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-purple-400/10 border border-purple-400/20 flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-text">{asset.assetName}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-2xs text-text-muted">
                Acquired {new Date(asset.acquiredAt).toLocaleDateString()}
              </span>
              {asset.integrationGenerated && (
                <Badge variant="success">Integration ready</Badge>
              )}
            </div>
          </div>
          <button
            onClick={() => removeAcquiredAsset(asset.assetId)}
            className="text-2xs text-text-muted hover:text-red-400 transition-colors px-2 py-1"
          >
            Remove
          </button>
        </SurfaceCard>
      ))}
    </div>
  );
}
