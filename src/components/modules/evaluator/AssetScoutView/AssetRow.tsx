import { useState, useCallback } from 'react';
import { Star, Zap, Download, Code, Package } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useMarketplaceStore } from '@/stores/marketplaceStore';
import { useProjectStore } from '@/stores/projectStore';
import type { ScoredAsset } from '@/types/marketplace';
import type { SubModuleId } from '@/types/modules';
import { ACCENT_EMERALD_DARK, MODULE_COLORS, ACCENT_RED } from '@/lib/chart-colors';
import { DIFFICULTY_COLORS, SOURCE_LABELS } from './constants';
import { formatTime } from './helpers';

// ── Asset Row ───────────────────────────────────────────────────────────────

export function AssetRow({ scored, isAcquired, moduleId, projectName }: {
  scored: ScoredAsset;
  isAcquired: boolean;
  moduleId: SubModuleId;
  projectName: string;
}) {
  const { asset, matchScore, matchReasons, timeSavedMinutes } = scored;
  const diff = DIFFICULTY_COLORS[asset.difficulty];
  const acquireAsset = useMarketplaceStore((s) => s.acquireAsset);
  const generateIntegration = useMarketplaceStore((s) => s.generateIntegration);
  const dynamicContext = useProjectStore((s) => s.dynamicContext);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAcquire = useCallback(() => {
    acquireAsset(asset.id, asset.name);
  }, [acquireAsset, asset.id, asset.name]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    const classes = dynamicContext?.classes?.map((c) => c.name) ?? [];
    await generateIntegration(
      asset.id,
      moduleId,
      projectName,
      `${projectName.toUpperCase()}_API`,
      classes,
    );
    setIsGenerating(false);
  }, [generateIntegration, asset.id, moduleId, projectName, dynamicContext]);

  const ringColor = matchScore > 70 ? ACCENT_EMERALD_DARK : matchScore > 40 ? MODULE_COLORS.content : ACCENT_RED;

  return (
    <SurfaceCard
      level={2}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-border-bright"
    >
      {/* Thumbnail + match score */}
      <div className="flex items-center gap-3">
        <AssetThumbnail url={asset.thumbnailUrl} name={asset.name} />
        <ProgressRing value={matchScore} size={36} strokeWidth={3} color={ringColor} />
      </div>

      {/* Asset info */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text truncate">{asset.name}</span>
          <span className={`px-1.5 py-0.5 rounded text-2xs font-medium ${diff.bg} ${diff.text}`}>
            {diff.label}
          </span>
          {asset.gasCompatible && (
            <span className="px-1.5 py-0.5 bg-blue-400/10 text-blue-400 rounded text-2xs font-medium">GAS</span>
          )}
        </div>
        {/* Metadata chips */}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <MetaChip>{asset.publisher}</MetaChip>
          <MetaChip>{SOURCE_LABELS[asset.source]}</MetaChip>
          <MetaChip tone="amber">
            <Star className="w-3 h-3 fill-amber-400" />
            {asset.rating}
          </MetaChip>
          <MetaChip tone="emerald">
            {asset.price === 0 ? 'Free' : `$${asset.price}`}
          </MetaChip>
        </div>
        <p className="text-2xs text-text-muted/80 mt-1 line-clamp-1">{matchReasons.join(' · ')}</p>
      </div>

      {/* Time saved + actions */}
      <div className="flex items-center gap-3">
        {timeSavedMinutes > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-400/5 border border-emerald-400/15 rounded text-emerald-400 flex-shrink-0">
            <Zap className="w-3 h-3" />
            <span className="text-2xs font-medium">Save {formatTime(timeSavedMinutes)}</span>
          </div>
        )}

        <div className="flex gap-1.5 flex-shrink-0">
          {!isAcquired ? (
            <button
              onClick={handleAcquire}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-400 text-2xs font-medium hover:bg-emerald-500/20 transition-colors"
            >
              <Download className="w-3 h-3" />
              Acquire
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-500/10 border border-cyan-500/25 rounded-lg text-cyan-400 text-2xs font-medium hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
            >
              <Code className="w-3 h-3" />
              {isGenerating ? 'Generating...' : 'Generate Adapter'}
            </button>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}

// ── Asset Thumbnail ─────────────────────────────────────────────────────────

/** 56×56 preview slot; renders the asset image when available, else a Package icon. */
function AssetThumbnail({ url, name }: { url?: string; name: string }) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(url) && !errored;

  return (
    <div className="w-14 h-14 rounded-lg bg-surface-hover border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- thumbnails are arbitrary external marketplace URLs, not project-owned assets
        <img
          src={url}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <Package className="w-6 h-6 text-text-muted/50" />
      )}
    </div>
  );
}

// ── Metadata Chip ───────────────────────────────────────────────────────────

const META_CHIP_TONES = {
  neutral: 'bg-surface-hover border-border text-text-muted',
  amber: 'bg-amber-400/10 border-amber-400/20 text-amber-400',
  emerald: 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400',
} as const;

function MetaChip({ children, tone = 'neutral' }: {
  children: React.ReactNode;
  tone?: keyof typeof META_CHIP_TONES;
}) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-2xs font-medium ${META_CHIP_TONES[tone]}`}>
      {children}
    </span>
  );
}
