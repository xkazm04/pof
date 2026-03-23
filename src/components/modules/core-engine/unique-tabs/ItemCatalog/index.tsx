'use client';

import { useMemo, useState } from 'react';
import { Package, FlaskConical, TrendingUp } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { TabHeader, LoadingSpinner, SubTabNavigation, type SubTab } from '../_shared';
import type { SubModuleId } from '@/types/modules';
import { ACCENT } from './data';
import { CatalogGearTab } from './CatalogGearTab';
import { EconomySourcingTab } from './EconomySourcingTab';
import { MechanicsScalingTab } from './MechanicsScalingTab';

/* ── Animation constants ──────────────────────────────────────────────── */

const ENTER = { opacity: 0, y: 10 } as const;
const VISIBLE = { opacity: 1, y: 0 } as const;
const EXIT = { opacity: 0, y: -10 } as const;
const TRANSITION = { duration: 0.2 } as const;

/* ── Component ────────────────────────────────────────────────────────── */

interface ItemCatalogProps {
  moduleId: SubModuleId;
}

export function ItemCatalog({ moduleId }: ItemCatalogProps) {
  const { featureMap, stats, isLoading } = useTabFeatures(moduleId);
  const [activeTab, setActiveTab] = useState('catalog-gear');

  const tabs: SubTab[] = useMemo(() => [
    { id: 'catalog-gear', label: 'Catalog & Gear', icon: Package },
    { id: 'economy-sourcing', label: 'Economy & Sourcing', icon: FlaskConical },
    { id: 'mechanics-scaling', label: 'Mechanics & Scaling', icon: TrendingUp },
  ], []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

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
        <SubTabNavigation
          tabs={tabs}
          activeTabId={activeTab}
          onChange={setActiveTab}
          accent={ACCENT}
        />
      </div>

      <div className="mt-2.5 relative min-h-[300px]">
        <AnimatePresence mode="sync">
          {activeTab === 'catalog-gear' && (
            <CatalogGearTab
              key="catalog-gear"
              moduleId={moduleId}
              featureMap={featureMap}
            />
          )}
          {activeTab === 'economy-sourcing' && (
            <EconomySourcingTab key="economy-sourcing" />
          )}
          {activeTab === 'mechanics-scaling' && (
            <MechanicsScalingTab
              key="mechanics-scaling"
              moduleId={moduleId}
              featureMap={featureMap}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
