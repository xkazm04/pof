'use client';

import { useMemo, useState } from 'react';
import { Activity, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { useCatalogEntities } from '@/stores/catalogStore';
import { useGeneration } from '@/hooks/useGeneration';
import { CatalogLifecycleCell } from '@/components/catalog/CatalogLifecycleCell';
import type { AnimationEntry } from '@/lib/catalog/types';
import type { GenerationStep } from '@/lib/catalog/recipe';
import { ALL_MONTAGES } from './_shared/data';
import {
  TabHeader,
  LoadingSpinner,
  SubTabNavigation,
  NarrativeBreadcrumb,
  type NarrativeBreadcrumbStep,
  type SubTab,
} from '../unique-tabs/_shared';
import type { SubModuleId } from '@/types/modules';
import { ACCENT, ANIM_SUBTABS, type AnimSubtab } from './_shared/data';
import { VisibleSection } from '../unique-tabs/VisibleSection';
import FeatureMapTab from '../unique-tabs/FeatureMapTab';
import { renderAnimMetric } from './metrics';
import {
  StateGraphTabContent,
  CombosMontagesTabContent,
  RetargetingTabContent,
  BudgetTabContent,
} from './AnimTabContent';

/* ── Narrative Breadcrumb steps ────────────────────────────────────────── */

const NARRATIVE_STEPS: ReadonlyArray<NarrativeBreadcrumbStep<AnimSubtab>> = [
  { key: 'features', narrative: 'Catalog' },
  ...ANIM_SUBTABS.map((t) => ({ key: t.key, narrative: t.narrative })),
];

/* ── Active tab subtitle ──────────────────────────────────────────────── */

function getActiveSubtitle(tab: AnimSubtab): string | null {
  if (tab === 'features') return 'Feature implementation status & metrics';
  const def = ANIM_SUBTABS.find(t => t.key === tab);
  return def?.subtitle ?? null;
}

interface AnimationStateGraphProps {
  moduleId: SubModuleId;
}

const TABS: SubTab[] = [
  { id: 'features', label: 'Features', icon: LayoutGrid },
  ...ANIM_SUBTABS.map(t => ({ id: t.key, label: t.label, icon: t.icon } as SubTab)),
];

export function AnimationStateGraph({ moduleId }: AnimationStateGraphProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [activeTab, setActiveTab] = useState<AnimSubtab>('state-graph');
  const [selectedComboNode, setSelectedComboNode] = useState<string | null>(null);

  /* folder-09 R3 UI: lifecycle + (Re)generate for the primary montage.
   * NB: the State Graph recipe loudly flags `author-python` as MANUAL — the AnimBP
   * graph itself cannot be authored from Python. The cell still drives dispatch;
   * the recipe's prompt text handles the MANUAL framing. */
  const animEntries = useCatalogEntities('state-graph') as AnimationEntry[];
  const entryByMontageId = useMemo(
    () => new Map(animEntries.map((e) => [e.data.id, e])),
    [animEntries],
  );
  const primaryMontageId = ALL_MONTAGES[0]?.id;
  const primaryEntry =
    (primaryMontageId != null ? entryByMontageId.get(primaryMontageId) : undefined)
    ?? animEntries[0];
  const gen = useGeneration(primaryEntry!);
  const nextStep: GenerationStep =
    primaryEntry?.lifecycle === 'generated' ? 'wire'
      : primaryEntry?.lifecycle === 'wired' ? 'verify'
        : 'author-python';

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  const subtitle = getActiveSubtitle(activeTab);

  return (
    <div className="space-y-4">
      <TabHeader icon={Activity} title="Animation State Graph" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* ── Narrative Breadcrumb ─────────────────────────────────────────── */}
      <NarrativeBreadcrumb
        steps={NARRATIVE_STEPS}
        activeKey={activeTab}
        accent={ACCENT}
        onNavigate={setActiveTab}
      />

      {/* ── Sub-Tab Navigation ──────────────────────────────────────────── */}
      <SubTabNavigation tabs={TABS} activeTabId={activeTab} onChange={(id) => setActiveTab(id as AnimSubtab)} accent={ACCENT} />

      {/* folder-09 R3: catalog lifecycle cell for the primary montage */}
      {primaryEntry && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            {primaryEntry.data.name ?? primaryEntry.data.id}
          </span>
          <CatalogLifecycleCell
            lifecycle={primaryEntry.lifecycle}
            ueAssetCount={primaryEntry.ueAssets?.length ?? 0}
            busy={gen.isRunning}
            onRegenerate={() => gen.generate(nextStep)}
          />
        </div>
      )}

      {/* ── Active Tab Subtitle ─────────────────────────────────────────── */}
      {subtitle && <p className="text-xs font-mono text-text-muted/70 -mt-1 mb-1 pl-0.5">{subtitle}</p>}

      {/* ── Tab Content with Animated Transitions ─────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {activeTab === 'features' && <FeatureMapTab moduleId={moduleId} renderMetric={renderAnimMetric} />}

          {activeTab === 'state-graph' && (
            <VisibleSection moduleId={moduleId} sectionId="states">
              <StateGraphTabContent featureMap={featureMap} />
            </VisibleSection>
          )}

          {activeTab === 'combos-montages' && (
            <VisibleSection moduleId={moduleId} sectionId="chain">
              <CombosMontagesTabContent
                selectedComboNode={selectedComboNode}
                setSelectedComboNode={setSelectedComboNode}
              />
            </VisibleSection>
          )}

          {activeTab === 'retargeting' && (
            <VisibleSection moduleId={moduleId} sectionId="skeleton">
              <RetargetingTabContent />
            </VisibleSection>
          )}

          {activeTab === 'budget' && (
            <VisibleSection moduleId={moduleId} sectionId="assets">
              <BudgetTabContent featureMap={featureMap} defs={defs} />
            </VisibleSection>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
