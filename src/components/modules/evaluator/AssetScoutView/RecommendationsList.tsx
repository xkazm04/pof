import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { AssetRecommendation, AcquiredAsset } from '@/types/marketplace';
import { MOTION } from '@/lib/constants';
import { AssetRow } from './AssetRow';
import { formatTime } from './helpers';

// ── Recommendations List ────────────────────────────────────────────────────

export function RecommendationsList({ recommendations, acquiredAssets, projectName }: {
  recommendations: AssetRecommendation[];
  acquiredAssets: Record<string, AcquiredAsset>;
  projectName: string;
}) {
  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <TrendingUp className="w-10 h-10 text-text-muted/30 mb-3" />
        <p className="text-sm text-text-muted">No recommendations found</p>
        <p className="text-xs text-text-muted/70 mt-1">
          Run a feature review on your modules to detect gaps
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec, i) => (
        <RecommendationCard
          key={`${rec.gap.moduleId}-${i}`}
          recommendation={rec}
          acquiredAssets={acquiredAssets}
          projectName={projectName}
        />
      ))}
    </div>
  );
}

// ── Recommendation Card ─────────────────────────────────────────────────────

function RecommendationCard({ recommendation, acquiredAssets, projectName }: {
  recommendation: AssetRecommendation;
  acquiredAssets: Record<string, AcquiredAsset>;
  projectName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { gap, assets } = recommendation;
  const gapFeatures = gap.description.split(', ');

  return (
    <SurfaceCard className="overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover/50 transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
          }
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text truncate">{gap.moduleLabel}</span>
              <Badge variant="warning">{gapFeatures.length} gaps</Badge>
            </div>
            <p className="text-2xs text-text-muted truncate mt-0.5">
              {gapFeatures.slice(0, 3).join(', ')}
              {gapFeatures.length > 3 && ` +${gapFeatures.length - 3} more`}
            </p>
          </div>
        </div>

        {/* Time comparison */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <div className="text-2xs text-text-muted">DIY</div>
            <div className="text-xs font-medium text-red-400">
              {formatTime(gap.diyHours * 60)}
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
          <div className="text-right">
            <div className="text-2xs text-text-muted">Asset</div>
            <div className="text-xs font-medium text-emerald-400">
              {assets.length > 0 ? formatTime(assets[0].integrationMinutes) : '—'}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded asset list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.base }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 py-3 space-y-2">
              {/* Missing features list */}
              <div className="mb-3">
                <div className="text-2xs text-text-muted font-medium mb-1.5">Missing Features</div>
                <div className="flex flex-wrap gap-1">
                  {gapFeatures.map((feat) => (
                    <span key={feat} className="px-2 py-0.5 bg-amber-400/5 border border-amber-400/15 rounded text-2xs text-amber-400">
                      {feat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Asset recommendations */}
              <div className="text-2xs text-text-muted font-medium mb-1.5">Recommended Assets</div>
              {assets.map((scored) => (
                <AssetRow
                  key={scored.asset.id}
                  scored={scored}
                  isAcquired={scored.asset.id in acquiredAssets}
                  moduleId={gap.moduleId}
                  projectName={projectName}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}
