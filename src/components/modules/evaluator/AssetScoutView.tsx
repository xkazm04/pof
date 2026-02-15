'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ShoppingBag, Star, ArrowRight,
  Zap, Download, Code, ChevronDown, ChevronRight, Package,
  Search, Filter, TrendingUp, AlertCircle, Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useMarketplaceStore } from '@/stores/marketplaceStore';
import { useProjectStore } from '@/stores/projectStore';
import type {
  AssetRecommendation,
  ScoredAsset,
  IntegrationSpec,
  AcquiredAsset,
  IntegrationDifficulty,
} from '@/types/marketplace';

// ── Constants for stable Zustand selectors ──────────────────────────────────

const EMPTY_ACQUIRED: Record<string, AcquiredAsset> = {};
const EMPTY_RECS: AssetRecommendation[] = [];

// ── Difficulty styling ──────────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<IntegrationDifficulty, { bg: string; text: string; label: string }> = {
  'drop-in': { bg: 'bg-green-400/10', text: 'text-green-400', label: 'Drop-in' },
  'adapter': { bg: 'bg-amber-400/10', text: 'text-amber-400', label: 'Adapter' },
  'deep-rewrite': { bg: 'bg-red-400/10', text: 'text-red-400', label: 'Deep Rewrite' },
};

const SOURCE_LABELS = {
  'fab': 'Fab.com',
  'ue-marketplace': 'UE Marketplace',
} as const;

// ── Main Component ──────────────────────────────────────────────────────────

export function AssetScoutView() {
  const recommendations = useMarketplaceStore((s) => s.recommendations) ?? EMPTY_RECS;
  const totalGaps = useMarketplaceStore((s) => s.totalGaps);
  const estimatedTimeSaved = useMarketplaceStore((s) => s.estimatedTimeSaved);
  const isLoading = useMarketplaceStore((s) => s.isLoading);
  const error = useMarketplaceStore((s) => s.error);
  const acquiredAssets = useMarketplaceStore((s) => s.acquiredAssets) ?? EMPTY_ACQUIRED;
  const moduleFilter = useMarketplaceStore((s) => s.moduleFilter);
  const fetchRecommendations = useMarketplaceStore((s) => s.fetchRecommendations);
  const setModuleFilter = useMarketplaceStore((s) => s.setModuleFilter);

  const projectName = useProjectStore((s) => s.projectName);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'recommendations' | 'acquired' | 'integration'>('recommendations');

  // Fetch on mount
  useEffect(() => {
    fetchRecommendations(undefined, moduleFilter ?? undefined);
  }, [fetchRecommendations, moduleFilter]);

  // Filter recommendations by search
  const filteredRecs = useMemo(() => {
    if (!searchQuery) return recommendations;
    const q = searchQuery.toLowerCase();
    return recommendations.filter((rec) =>
      rec.gap.moduleLabel.toLowerCase().includes(q) ||
      rec.gap.featureName.toLowerCase().includes(q) ||
      rec.assets.some((a) => a.asset.name.toLowerCase().includes(q)),
    );
  }, [recommendations, searchQuery]);

  const acquiredCount = Object.keys(acquiredAssets).length;

  // Unique module IDs for filter
  const moduleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rec of recommendations) ids.add(rec.gap.moduleId);
    return [...ids];
  }, [recommendations]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text">Asset Scout</h1>
            <p className="text-xs text-text-muted">
              Marketplace recommendations based on your project gaps
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-3 mb-4">
          <StatCard
            icon={<AlertCircle className="w-4 h-4 text-amber-400" />}
            value={totalGaps}
            label="Feature gaps"
            color="text-amber-400"
          />
          <StatCard
            icon={<Package className="w-4 h-4 text-emerald-400" />}
            value={recommendations.length}
            label="Recommendations"
            color="text-emerald-400"
          />
          <StatCard
            icon={<Clock className="w-4 h-4 text-cyan-400" />}
            value={`${Math.round(estimatedTimeSaved / 60)}h`}
            label="Potential savings"
            color="text-cyan-400"
          />
          <StatCard
            icon={<Download className="w-4 h-4 text-purple-400" />}
            value={acquiredCount}
            label="Acquired"
            color="text-purple-400"
          />
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 border-b border-border">
            <TabBtn label="Recommendations" active={activeTab === 'recommendations'} onClick={() => setActiveTab('recommendations')} />
            <TabBtn label={`Acquired (${acquiredCount})`} active={activeTab === 'acquired'} onClick={() => setActiveTab('acquired')} />
            <TabBtn label="Integration" active={activeTab === 'integration'} onClick={() => setActiveTab('integration')} />
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-emerald-500/40 w-48"
            />
          </div>
          <div className="relative">
            <select
              value={moduleFilter ?? ''}
              onChange={(e) => setModuleFilter(e.target.value || null)}
              className="appearance-none pl-7 pr-6 py-1.5 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-emerald-500/40 cursor-pointer"
            >
              <option value="">All modules</option>
              {moduleIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <span className="ml-3 text-sm text-text-muted">Analyzing feature gaps...</span>
          </div>
        )}

        {error && (
          <SurfaceCard className="p-4 mb-4 border-status-red-strong">
            <p className="text-sm text-red-400">{error}</p>
          </SurfaceCard>
        )}

        {!isLoading && activeTab === 'recommendations' && (
          <RecommendationsList
            recommendations={filteredRecs}
            acquiredAssets={acquiredAssets}
            projectName={projectName}
          />
        )}

        {!isLoading && activeTab === 'acquired' && (
          <AcquiredAssetsList
            acquiredAssets={acquiredAssets}
            projectName={projectName}
          />
        )}

        {!isLoading && activeTab === 'integration' && (
          <IntegrationView acquiredAssets={acquiredAssets} />
        )}
      </div>
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color }: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <SurfaceCard className="flex items-center gap-2.5 px-3 py-2 flex-1" level={2}>
      {icon}
      <div>
        <div className={`text-sm font-semibold ${color}`}>{value}</div>
        <div className="text-2xs text-text-muted">{label}</div>
      </div>
    </SurfaceCard>
  );
}

// ── Tab Button ──────────────────────────────────────────────────────────────

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium transition-colors relative ${
        active ? 'text-emerald-400' : 'text-text-muted hover:text-text'
      }`}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-emerald-500" />
      )}
    </button>
  );
}

// ── Recommendations List ────────────────────────────────────────────────────

function RecommendationsList({ recommendations, acquiredAssets, projectName }: {
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
            transition={{ duration: 0.22 }}
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

// ── Asset Row ───────────────────────────────────────────────────────────────

function AssetRow({ scored, isAcquired, moduleId, projectName }: {
  scored: ScoredAsset;
  isAcquired: boolean;
  moduleId: string;
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

  return (
    <SurfaceCard level={2} className="flex items-center gap-3 px-3 py-2.5">
      {/* Match score ring */}
      <ProgressRing value={matchScore} size={36} strokeWidth={3} color={matchScore > 70 ? '#10b981' : matchScore > 40 ? '#f59e0b' : '#ef4444'} />

      {/* Asset info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text truncate">{asset.name}</span>
          <span className={`px-1.5 py-0.5 rounded text-2xs font-medium ${diff.bg} ${diff.text}`}>
            {diff.label}
          </span>
          {asset.gasCompatible && (
            <span className="px-1.5 py-0.5 bg-blue-400/10 text-blue-400 rounded text-2xs font-medium">GAS</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-2xs text-text-muted">{asset.publisher}</span>
          <span className="text-2xs text-text-muted/50">|</span>
          <span className="text-2xs text-text-muted">{SOURCE_LABELS[asset.source]}</span>
          <span className="text-2xs text-text-muted/50">|</span>
          <span className="flex items-center gap-0.5 text-2xs text-amber-400">
            <Star className="w-3 h-3 fill-amber-400" />
            {asset.rating}
          </span>
          <span className="text-2xs text-text-muted/50">|</span>
          <span className="text-2xs text-emerald-400 font-medium">
            {asset.price === 0 ? 'Free' : `$${asset.price}`}
          </span>
        </div>
        <p className="text-2xs text-text-muted/80 mt-0.5 line-clamp-1">{matchReasons.join(' · ')}</p>
      </div>

      {/* Time saved */}
      {timeSavedMinutes > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-400/5 border border-emerald-400/15 rounded text-emerald-400 flex-shrink-0">
          <Zap className="w-3 h-3" />
          <span className="text-2xs font-medium">Save {formatTime(timeSavedMinutes)}</span>
        </div>
      )}

      {/* Actions */}
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
    </SurfaceCard>
  );
}

// ── Acquired Assets List ────────────────────────────────────────────────────

function AcquiredAssetsList({ acquiredAssets, projectName }: {
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

// ── Integration View ────────────────────────────────────────────────────────

function IntegrationView({ acquiredAssets }: { acquiredAssets: Record<string, AcquiredAsset> }) {
  const entries = Object.values(acquiredAssets).filter((a) => a.integrationGenerated && a.integration);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Code className="w-10 h-10 text-text-muted/30 mb-3" />
        <p className="text-sm text-text-muted">No integrations generated yet</p>
        <p className="text-xs text-text-muted/70 mt-1">
          Acquire an asset and click "Generate Adapter" to create integration code
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <IntegrationCard key={entry.assetId} asset={entry} integration={entry.integration!} />
      ))}
    </div>
  );
}

// ── Integration Card ────────────────────────────────────────────────────────

function IntegrationCard({ asset, integration }: {
  asset: AcquiredAsset;
  integration: IntegrationSpec;
}) {
  const [showCode, setShowCode] = useState<'header' | 'source' | null>(null);

  return (
    <SurfaceCard className="overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Code className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-text">{asset.assetName}</span>
          <Badge variant="success">Adapter Ready</Badge>
        </div>

        {/* Dependencies */}
        {(integration.buildDependencies.length > 0 || integration.pluginDependencies.length > 0) && (
          <div className="flex gap-4 mb-3">
            {integration.buildDependencies.length > 0 && (
              <div>
                <span className="text-2xs text-text-muted font-medium">Build Deps</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {integration.buildDependencies.map((dep) => (
                    <span key={dep} className="px-1.5 py-0.5 bg-surface-hover border border-border rounded text-2xs text-text-muted">{dep}</span>
                  ))}
                </div>
              </div>
            )}
            {integration.pluginDependencies.length > 0 && (
              <div>
                <span className="text-2xs text-text-muted font-medium">Plugins</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {integration.pluginDependencies.map((dep) => (
                    <span key={dep} className="px-1.5 py-0.5 bg-blue-400/10 border border-blue-400/15 rounded text-2xs text-blue-400">{dep}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Steps */}
        <div className="space-y-1.5 mb-3">
          {integration.steps.map((step) => (
            <div key={step.order} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-2xs text-cyan-400 font-medium flex-shrink-0 mt-0.5">
                {step.order}
              </span>
              <div>
                <span className="text-xs font-medium text-text">{step.title}</span>
                <p className="text-2xs text-text-muted">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Code toggles */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowCode(showCode === 'header' ? null : 'header')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-2xs font-medium transition-colors ${
              showCode === 'header'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-surface-hover text-text-muted border border-border hover:text-text'
            }`}
          >
            <Code className="w-3 h-3" />
            Adapter.h
          </button>
          <button
            onClick={() => setShowCode(showCode === 'source' ? null : 'source')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-2xs font-medium transition-colors ${
              showCode === 'source'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-surface-hover text-text-muted border border-border hover:text-text'
            }`}
          >
            <Code className="w-3 h-3" />
            Adapter.cpp
          </button>
        </div>
      </div>

      {/* Code display */}
      <AnimatePresence>
        {showCode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border">
              <pre className="px-4 py-3 text-2xs text-text/80 font-mono overflow-x-auto bg-surface-deep">
                {showCode === 'header' ? integration.adapterHeader : integration.adapterSource}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
