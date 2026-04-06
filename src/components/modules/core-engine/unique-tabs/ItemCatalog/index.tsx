'use client';

import { useMemo, useState } from 'react';
import { Package, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { TabHeader, LoadingSpinner, SubTabNavigation, type SubTab } from '../_shared';
import type { SubModuleId } from '@/types/modules';
import { ACCENT, SUBTABS, type ItemCatalogSubtab } from './data';
import { CatalogGearTab } from './catalog/CatalogGearTab';
import { EconomySourcingTab } from './economy/EconomySourcingTab';
import { MechanicsScalingTab } from './mechanics/MechanicsScalingTab';
import FeatureMapTab from '../FeatureMapTab';
import { VisibleSection } from '../VisibleSection';
import { renderItemMetric } from './metrics';
import { withOpacity, OPACITY_10 } from '@/lib/chart-colors';

/* ── Narrative Breadcrumb ────────────────────────────────────────────── */

const FEATURES_STEP = { key: 'features' as ItemCatalogSubtab, narrative: 'Catalog' };
const NARRATIVE_STEPS = [FEATURES_STEP, ...SUBTABS.map(t => ({ key: t.key, narrative: t.narrative }))];

function NarrativeBreadcrumb({ activeTab, onNavigate }: { activeTab: ItemCatalogSubtab; onNavigate: (tab: ItemCatalogSubtab) => void }) {
  const activeIdx = NARRATIVE_STEPS.findIndex(s => s.key === activeTab);
  return (
    <div className="flex items-center gap-0.5 text-[10px] font-mono tracking-wide overflow-x-auto custom-scrollbar pb-0.5">
      {NARRATIVE_STEPS.map((step, i) => {
        const isPast = i < activeIdx;
        const isActive = i === activeIdx;
        return (
          <div key={step.key} className="flex items-center gap-0.5 flex-shrink-0">
            {i > 0 && <span className="text-text-muted/40 mx-0.5">{'>'}</span>}
            <button
              onClick={() => onNavigate(step.key)}
              className="px-1.5 py-0.5 rounded transition-all cursor-pointer"
              style={{
                color: isActive ? ACCENT : isPast ? withOpacity(ACCENT, '99') : 'var(--text-muted)',
                backgroundColor: isActive ? withOpacity(ACCENT, OPACITY_10) : 'transparent',
                fontWeight: isActive ? 700 : isPast ? 600 : 400,
                opacity: !isActive && !isPast ? 0.5 : 1,
              }}
            >
              {step.narrative}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ── Active tab subtitle ─────────────────────────────────────────────── */

function getActiveSubtitle(tab: ItemCatalogSubtab): string | null {
  if (tab === 'features') return 'Feature implementation status & metrics';
  const def = SUBTABS.find(t => t.key === tab);
  return def?.subtitle ?? null;
}

/* ── Component ────────────────────────────────────────────────────────── */

interface ItemCatalogProps {
  moduleId: SubModuleId;
}

export function ItemCatalog({ moduleId }: ItemCatalogProps) {
  const { featureMap, stats, isLoading } = useTabFeatures(moduleId);
  const [activeTab, setActiveTab] = useState<ItemCatalogSubtab>('catalog-gear');

  const tabs: SubTab[] = useMemo(() => [
    { id: 'features', label: 'Features', icon: LayoutGrid },
    ...SUBTABS.map(t => ({ id: t.key, label: t.label, icon: t.icon })),
  ], []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  const subtitle = getActiveSubtitle(activeTab);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <TabHeader
          icon={Package}
          title="Item Catalog"
          implemented={stats.implemented}
          total={stats.total}
          accent={ACCENT}
        />

        {/* ── Narrative Breadcrumb ──────────────────────────────────────── */}
        <NarrativeBreadcrumb activeTab={activeTab} onNavigate={setActiveTab} />

        <SubTabNavigation
          tabs={tabs}
          activeTabId={activeTab}
          onChange={(id) => setActiveTab(id as ItemCatalogSubtab)}
          accent={ACCENT}
        />
      </div>

      {/* ── Active Tab Subtitle ────────────────────────────────────────── */}
      {subtitle && <p className="text-xs font-mono text-text-muted/70 -mt-1 mb-1 pl-0.5">{subtitle}</p>}

      <div className="mt-2.5 relative min-h-[300px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
          {activeTab === 'features' && <FeatureMapTab moduleId={moduleId} renderMetric={renderItemMetric} />}
          {activeTab === 'catalog-gear' && (
            <VisibleSection moduleId={moduleId} sectionId="grid">
            <CatalogGearTab
              key="catalog-gear"
              moduleId={moduleId}
              featureMap={featureMap}
            />
            </VisibleSection>
          )}
          {activeTab === 'economy-sourcing' && (
            <VisibleSection moduleId={moduleId} sectionId="sources">
            <EconomySourcingTab key="economy-sourcing" />
            </VisibleSection>
          )}
          {activeTab === 'mechanics-scaling' && (
            <VisibleSection moduleId={moduleId} sectionId="inv-stats">
            <MechanicsScalingTab
              key="mechanics-scaling"
              moduleId={moduleId}
              featureMap={featureMap}
            />
            </VisibleSection>
          )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
