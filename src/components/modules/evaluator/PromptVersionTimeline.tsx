'use client';

import { useCallback, useState } from 'react';
import {
  History, GitBranch, RotateCcw, Trophy, CheckCircle2,
  GitCompareArrows, X, Loader2, FlaskConical,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { PromptDiffView } from './PromptDiffView';
import { usePromptEvolutionStore } from '@/stores/promptEvolutionStore';
import type {
  VariantLineageNode,
  VariantStats,
  VariantStyle,
} from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';
import {
  MODULE_COLORS, STATUS_NEUTRAL, ACCENT_EMERALD_DARK,
} from '@/lib/chart-colors';

const ACCENT = ACCENT_EMERALD_DARK;

const STYLE_COLOR: Record<VariantStyle, string> = {
  imperative: MODULE_COLORS.evaluator,
  descriptive: MODULE_COLORS.core,
  'step-by-step': MODULE_COLORS.content,
  holistic: MODULE_COLORS.systems,
  'example-rich': ACCENT_EMERALD_DARK,
  minimal: STATUS_NEUTRAL,
};

/** Success-rate → badge variant (text carries the % so meaning isn't color-only). */
function rateVariant(stats: VariantStats): 'success' | 'warning' | 'error' | 'default' {
  if (stats.trials === 0) return 'default';
  if (stats.successRate >= 0.7) return 'success';
  if (stats.successRate >= 0.4) return 'warning';
  return 'error';
}

function StatsBadge({ stats }: { stats: VariantStats }) {
  if (stats.trials === 0) {
    return <Badge variant="default" className="text-[11px]">untested</Badge>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={rateVariant(stats)} className="text-[11px]">
        {Math.round(stats.successRate * 100)}% · {stats.successes}/{stats.trials}
      </Badge>
      {stats.wins > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[11px] text-yellow-500" title={`Won ${stats.wins} A/B test${stats.wins === 1 ? '' : 's'}`}>
          <Trophy className="w-3 h-3" />
          {stats.wins}
        </span>
      )}
    </span>
  );
}

// ── One row in the lineage tree ──────────────────────────────────────────────

function VersionNode({
  node,
  compareSlot,
  onToggleCompare,
  onRestore,
  isRestoring,
}: {
  node: VariantLineageNode;
  /** 1 or 2 if this node is picked for compare; 0 otherwise. */
  compareSlot: number;
  onToggleCompare: (id: string) => void;
  onRestore: (id: string) => void;
  isRestoring: boolean;
}) {
  const { variant, stats, isActive } = node;
  const styleColor = STYLE_COLOR[variant.style];
  const picked = compareSlot > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        data-testid={`version-node-${variant.id}`}
        data-active={isActive ? 'true' : 'false'}
        className="flex items-start gap-2 py-1.5"
        style={{ paddingLeft: node.depth * 18 }}
      >
        {/* Lineage glyph */}
        <span className="mt-0.5 flex-shrink-0" aria-hidden>
          {node.depth > 0
            ? <GitBranch className="w-3.5 h-3.5 text-text-muted/60" />
            : <History className="w-3.5 h-3.5 text-text-muted/60" />}
        </span>

        <div
          className="flex-1 min-w-0 rounded-md border p-2.5"
          style={{
            borderColor: picked ? ACCENT : isActive ? `${ACCENT}66` : 'var(--border)',
            backgroundColor: isActive ? `${ACCENT}0d` : undefined,
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: styleColor }} />
            <span className="text-xs font-medium text-text truncate">{variant.label}</span>
            {isActive && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded"
                style={{ color: ACCENT, backgroundColor: `${ACCENT}1a` }}
                data-testid="current-badge"
              >
                <CheckCircle2 className="w-3 h-3" /> current
              </span>
            )}
            <span
              className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded border"
              style={{ borderColor: styleColor, color: styleColor }}
            >
              {variant.style}
            </span>
            {variant.mutationType && (
              <Badge variant="default" className="text-[11px]">{variant.mutationType}</Badge>
            )}
            <StatsBadge stats={stats} />
          </div>

          <div className="flex items-center justify-between gap-2 mt-1.5">
            <span className="text-2xs text-text-muted">
              {variant.origin} · {new Date(variant.createdAt).toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => onToggleCompare(variant.id)}
                aria-pressed={picked}
                data-testid={`compare-${variant.id}`}
                className={`focus-ring inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
                  picked ? 'text-white' : 'border-border text-text-muted hover:text-text'
                }`}
                style={picked ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
              >
                <GitCompareArrows className="w-3 h-3" />
                {picked ? `Compare ${compareSlot}` : 'Compare'}
              </button>
              <button
                onClick={() => onRestore(variant.id)}
                disabled={isActive || isRestoring}
                data-testid={`restore-${variant.id}`}
                title={isActive ? 'Already the current version' : 'Restore this version'}
                className="focus-ring inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-border text-text-muted hover:text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3 h-3" />
                Restore
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Main timeline panel ──────────────────────────────────────────────────────

export function PromptVersionTimeline({
  selectedModuleId,
  itemOptions,
}: {
  selectedModuleId: SubModuleId | null;
  itemOptions: { id: string; label: string }[];
}) {
  const versionHistory = usePromptEvolutionStore((s) => s.versionHistory);
  const isLoadingHistory = usePromptEvolutionStore((s) => s.isLoadingHistory);
  const isRestoring = usePromptEvolutionStore((s) => s.isRestoring);
  const loadVersionHistory = usePromptEvolutionStore((s) => s.loadVersionHistory);
  const restoreVariant = usePromptEvolutionStore((s) => s.restoreVariant);

  const [selectedItemId, setSelectedItemId] = useState('');
  const [compare, setCompare] = useState<string[]>([]);

  const handleSelectItem = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
    setCompare([]);
    if (selectedModuleId && itemId) {
      loadVersionHistory(selectedModuleId, itemId);
    }
  }, [selectedModuleId, loadVersionHistory]);

  // Toggle a version into the (max-2) compare selection; FIFO when a third is added.
  const toggleCompare = useCallback((id: string) => {
    setCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length < 2) return [...prev, id];
      return [prev[1], id];
    });
  }, []);

  const handleRestore = useCallback(async (id: string) => {
    const restored = await restoreVariant(id);
    if (restored) toast.success(`Restored “${restored.label}” as the current version`);
  }, [restoreVariant]);

  const showHistory =
    versionHistory && selectedItemId && versionHistory.checklistItemId === selectedItemId
      ? versionHistory
      : null;

  // Resolve the two compared versions, ordered before→after by creation time.
  const comparePair = (() => {
    if (!showHistory || compare.length !== 2) return null;
    const byId = new Map(showHistory.versions.map((v) => [v.variant.id, v] as const));
    const a = byId.get(compare[0]);
    const b = byId.get(compare[1]);
    if (!a || !b) return null;
    const [before, after] = a.variant.createdAt <= b.variant.createdAt ? [a, b] : [b, a];
    return { before, after };
  })();

  const compareSlot = (id: string) => {
    const idx = compare.indexOf(id);
    return idx === -1 ? 0 : idx + 1;
  };

  return (
    <div className="space-y-4">
      {/* Checklist-item picker */}
      <div className="flex items-center gap-2 flex-wrap">
        <label htmlFor="pe-history-item" className="text-xs text-text-muted">Checklist item</label>
        <select
          id="pe-history-item"
          value={selectedItemId}
          onChange={(e) => handleSelectItem(e.target.value)}
          disabled={!selectedModuleId || itemOptions.length === 0}
          className="px-3 py-1.5 text-xs rounded-md bg-surface border border-border text-text disabled:opacity-50"
        >
          <option value="">Select an item with history…</option>
          {itemOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        {isLoadingHistory && <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" />}
        {!selectedModuleId && <span className="text-xs text-text-muted">Select a module first</span>}
        {selectedModuleId && itemOptions.length === 0 && (
          <span className="text-xs text-text-muted">No variants yet — create some in the Variants tab</span>
        )}
      </div>

      {/* Compare diff */}
      {comparePair && (
        <SurfaceCard level={2} className="p-3 space-y-2" data-testid="version-compare">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-text min-w-0">
              <GitCompareArrows className="w-3.5 h-3.5" style={{ color: ACCENT }} />
              <span className="truncate">
                <span className="text-text-muted">Older:</span> {comparePair.before.variant.label}
                {' → '}
                <span className="text-text-muted">Newer:</span> {comparePair.after.variant.label}
              </span>
            </div>
            <button
              onClick={() => setCompare([])}
              className="focus-ring inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-border text-text-muted hover:text-text transition-colors flex-shrink-0"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
          <PromptDiffView before={comparePair.before.variant.prompt} after={comparePair.after.variant.prompt} />
        </SurfaceCard>
      )}

      {/* Lineage tree */}
      {showHistory ? (
        showHistory.versions.length === 0 ? (
          <EmptyHistory />
        ) : (
          <SurfaceCard level={2} className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <History className="w-3.5 h-3.5" style={{ color: ACCENT }} />
              <span className="text-xs font-medium text-text">{showHistory.checklistItemId}</span>
              <Badge variant="default" className="text-[11px]">
                {showHistory.versions.length} version{showHistory.versions.length === 1 ? '' : 's'}
              </Badge>
              <span className="text-2xs text-text-muted ml-auto flex items-center gap-1">
                <FlaskConical className="w-3 h-3" /> success rate from A/B tests
              </span>
            </div>
            <div className="flex flex-col">
              {showHistory.roots.map((root) => (
                <CompareTree
                  key={root.variant.id}
                  node={root}
                  compareSlot={compareSlot}
                  onToggleCompare={toggleCompare}
                  onRestore={handleRestore}
                  isRestoring={isRestoring}
                />
              ))}
            </div>
            <p className="text-2xs text-text-muted mt-2">
              Pick two versions’ <span className="text-text">Compare</span> buttons to see a side-by-side diff, or
              <span className="text-text"> Restore</span> any version to make it current.
            </p>
          </SurfaceCard>
        )
      ) : (
        selectedModuleId && itemOptions.length > 0 && !selectedItemId && (
          <EmptyHistory prompt />
        )
      )}
    </div>
  );
}

/** Recursive renderer that resolves each node's live compare slot. */
function CompareTree({
  node,
  compareSlot,
  onToggleCompare,
  onRestore,
  isRestoring,
}: {
  node: VariantLineageNode;
  compareSlot: (id: string) => number;
  onToggleCompare: (id: string) => void;
  onRestore: (id: string) => void;
  isRestoring: boolean;
}) {
  return (
    <>
      <VersionNode
        node={node}
        compareSlot={compareSlot(node.variant.id)}
        onToggleCompare={onToggleCompare}
        onRestore={onRestore}
        isRestoring={isRestoring}
      />
      {node.children.map((child) => (
        <CompareTree
          key={child.variant.id}
          node={child}
          compareSlot={compareSlot}
          onToggleCompare={onToggleCompare}
          onRestore={onRestore}
          isRestoring={isRestoring}
        />
      ))}
    </>
  );
}

function EmptyHistory({ prompt = false }: { prompt?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <History className="w-8 h-8 text-text-muted/30 mb-3" />
      <p className="text-sm font-medium text-text-muted mb-1">
        {prompt ? 'Pick a checklist item' : 'No version history'}
      </p>
      <p className="text-xs text-text-muted/70 max-w-xs">
        {prompt
          ? 'Choose an item above to browse its lineage, compare versions, and roll back.'
          : 'Create variants and mutations for this item to build a version timeline.'}
      </p>
    </div>
  );
}
