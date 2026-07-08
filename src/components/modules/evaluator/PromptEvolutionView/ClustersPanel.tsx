import { Sparkles, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { StatTerm } from '@/components/ui/StatTerm';
import type { PromptCluster } from '@/types/prompt-evolution';
import { plainClusterSummary } from '@/lib/prompt-evolution/plain-language';
import { ACCENT } from './constants';
import { EmptyState } from './EmptyState';

// ── Clusters Panel ──────────────────────────────────────────────────────────

export function ClustersPanel({
  clusters,
  selectedModuleId,
  isClustering,
  handleCluster,
}: {
  clusters: PromptCluster[];
  selectedModuleId: string | null;
  isClustering: boolean;
  handleCluster: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={handleCluster}
          disabled={!selectedModuleId || isClustering}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-white disabled:opacity-40 transition-colors"
          style={{ backgroundColor: ACCENT }}
        >
          {isClustering ? (
            <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          Analyze Clusters
        </button>
        {!selectedModuleId && (
          <span className="text-xs text-text-muted">Select a module first</span>
        )}
      </div>

      {clusters.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No clusters"
          description="Run cluster analysis on a module to discover prompt patterns that correlate with success"
        />
      ) : (
        <div className="space-y-2">
          {/* How clustering works — surfaces the engine's jargon as tooltips. */}
          <p className="text-xs text-text-muted leading-relaxed">
            Similar prompts are grouped using{' '}
            <StatTerm term="jaccard">Jaccard similarity</StatTerm> and{' '}
            <StatTerm term="agglomerative clustering">agglomerative clustering</StatTerm>. Each
            group shows its most typical prompt (its{' '}
            <StatTerm term="centroid">centroid</StatTerm>).
          </p>

          {clusters.map((cluster, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <SurfaceCard level={2} className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-text-muted" />
                    <span className="text-xs font-medium text-text capitalize">{cluster.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={cluster.successRate >= 0.7 ? 'success' : cluster.successRate >= 0.4 ? 'warning' : 'error'}
                      className="text-[11px]"
                    >
                      {Math.round(cluster.successRate * 100)}% success
                    </Badge>
                    <span className="text-xs text-text-muted">{cluster.sessionIds.length} sessions</span>
                  </div>
                </div>

                {/* Plain-language one-liner */}
                <p className="text-xs text-text mb-2 leading-relaxed">{plainClusterSummary(cluster)}</p>

                {/* Keywords */}
                <div className="flex items-center gap-1 mb-2 flex-wrap">
                  {cluster.keywords.map((kw) => (
                    <span key={kw} className="px-1.5 py-0.5 text-[11px] rounded bg-surface border border-border text-text-muted">
                      {kw}
                    </span>
                  ))}
                </div>

                {/* Representative prompt */}
                <p className="text-xs text-text-muted font-mono leading-relaxed">
                  {cluster.representative}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                  <span>Avg length: {cluster.avgLength} chars</span>
                </div>
              </SurfaceCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
