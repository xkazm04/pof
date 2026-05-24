'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FeatureCard } from '../../unique-tabs/_shared';
import { ACCENT, ASSET_FEATURES } from '../_shared/data';
import type { FeatureRow } from '@/types/feature-matrix';
import { MontageAssetBrowser } from './MontageAssetBrowser';
import { BudgetTracker, NotifyCoverage } from './BudgetCoveragePanels';

interface BudgetTabProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

export function BudgetTab({ featureMap, defs }: BudgetTabProps) {
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const toggleAsset = useCallback((name: string) => {
    setExpandedAsset((prev) => (prev === name ? null : name));
  }, []);

  return (
    <>
      {/* Asset list */}
      <div className="space-y-3 pt-2">
        <div className="px-1">
          <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">
            Anim Architecture Modules
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ASSET_FEATURES.map((name, i) => (
            <motion.div key={name} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <FeatureCard name={name} featureMap={featureMap} defs={defs} expanded={expandedAsset} onToggle={toggleAsset} accent={ACCENT} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Montage Asset Browser */}
      <MontageAssetBrowser />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <BudgetTracker />
        <NotifyCoverage />
      </div>
    </>
  );
}
