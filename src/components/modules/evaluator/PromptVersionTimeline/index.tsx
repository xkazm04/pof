'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  History, GitCompareArrows, X, Loader2, FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { PromptDiffView } from '../PromptDiffView';
import { usePromptEvolutionStore } from '@/stores/promptEvolutionStore';
import type { SubModuleId } from '@/types/modules';
import { ACCENT } from './constants';
import { CompareTree } from './CompareTree';
import { EmptyHistory } from './EmptyHistory';
import { ChallengePreflight } from './ChallengePreflight';
import { planChallenge } from '@/lib/prompt-evolution/challenge';

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
  const abTests = usePromptEvolutionStore((s) => s.abTests);
  const variantFitness = usePromptEvolutionStore((s) => s.variantFitness);
  const loadVariantFitness = usePromptEvolutionStore((s) => s.loadVariantFitness);
  const startChallenge = usePromptEvolutionStore((s) => s.startChallenge);
  const setActiveSubTab = usePromptEvolutionStore((s) => s.setActiveSubTab);

  // A suggestion ("start A/B test") may open History on an item: start there.
  const [selectedItemId, setSelectedItemId] = useState(
    () => usePromptEvolutionStore.getState().selectedChecklistItemId ?? '',
  );
  const [compare, setCompare] = useState<string[]>([]);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const handleSelectItem = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
    setCompare([]);
    setChallengeId(null);
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

  const openChallenge = useCallback((id: string) => {
    setChallengeId(id);
    setStartError(null);
    loadVariantFitness();
  }, [loadVariantFitness]);

  const handleStartChallenge = useCallback(async () => {
    if (!challengeId) return;
    setIsStarting(true);
    const started = await startChallenge(challengeId);
    setIsStarting(false);
    if (!started.ok) {
      setStartError(started.reason);
      return;
    }
    setChallengeId(null);
    toast.success('A/B test started — dispatch this checklist item a few times to collect trials.');
  }, [challengeId, startChallenge]);

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

  const challengePlan = useMemo(
    () => (showHistory && challengeId
      ? planChallenge({ history: showHistory, candidateId: challengeId, runningTests: abTests, fitness: variantFitness })
      : null),
    [showHistory, challengeId, abTests, variantFitness],
  );

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

      {challengePlan && (
        <ChallengePreflight
          plan={challengePlan}
          isStarting={isStarting}
          startError={startError}
          onStart={handleStartChallenge}
          onCancel={() => setChallengeId(null)}
          onOpenTests={() => setActiveSubTab('tests')}
        />
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
                  onChallenge={openChallenge}
                  isRestoring={isRestoring}
                />
              ))}
            </div>
            <p className="text-2xs text-text-muted mt-2">
              Pick two versions’ <span className="text-text">Compare</span> buttons to see a side-by-side diff, or
              <span className="text-text"> Restore</span> any version to make it current, or
              <span className="text-text"> Challenge current</span> to A/B test it against the current one.
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
