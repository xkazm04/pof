'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_EMERALD, ACCENT_CYAN,
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
} from '@/lib/chart-colors';
import { EASE_OUT } from '@/lib/motion';
import { GlowStat } from '../../unique-tabs/_design';
import { SubTabNavigation } from '../../unique-tabs/_shared';
import type { ItemEconomyConfig, ItemEconomyResult } from '@/lib/economy/item-economy-engine';
import { ACCENT, SUB_TABS } from './constants';
import { PowerTab, RarityTab } from './PowerRarityTabs';
import { AffixTab, AlertsTab } from './AffixAlertsTabs';

const TAB_TRANSITION = { duration: 0.16, ease: EASE_OUT };

interface SummaryStats {
  peakPower: number;
  endgamePower: number;
  midPower: number;
  alertCount: number;
  criticalCount: number;
  rarityInflation: number;
}

interface Props {
  summary: SummaryStats;
  result: ItemEconomyResult;
  config: ItemEconomyConfig;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function SimulationResults({ summary, result, config, activeTab, setActiveTab }: Props) {
  return (
    <div className="space-y-3">
      {/* Summary stats */}
      <div className="grid grid-cols-6 gap-2">
        <GlowStat label="Peak Power" value={summary.peakPower.toFixed(0)}
          color={ACCENT} delay={0} />
        <GlowStat label="Mid Power" value={summary.midPower.toFixed(0)}
          color={ACCENT_EMERALD} delay={0.05} />
        <GlowStat label="End Power" value={summary.endgamePower.toFixed(0)}
          color={ACCENT_CYAN} delay={0.1} />
        <GlowStat label="Inflation" value={`${summary.rarityInflation.toFixed(1)}x`}
          color={summary.rarityInflation > 3 ? STATUS_WARNING : STATUS_SUCCESS} delay={0.15} />
        <GlowStat label="Alerts" value={String(summary.alertCount)}
          color={summary.criticalCount > 0 ? STATUS_ERROR
            : summary.alertCount > 0 ? STATUS_WARNING : STATUS_SUCCESS} delay={0.2} />
        <GlowStat label="Critical" value={String(summary.criticalCount)}
          color={summary.criticalCount > 0 ? STATUS_ERROR : STATUS_SUCCESS} delay={0.25} />
      </div>

      {/* Tab navigation */}
      <SubTabNavigation tabs={SUB_TABS} activeTabId={activeTab}
        onChange={setActiveTab} accent={ACCENT} />

      {/* Tab content with 160ms crossfade keyed on activeTab */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={TAB_TRANSITION}
        >
          {activeTab === 'power' && <PowerTab result={result} config={config} />}
          {activeTab === 'rarity' && <RarityTab result={result} config={config} />}
          {activeTab === 'affixes' && <AffixTab result={result} />}
          {activeTab === 'alerts' && <AlertsTab result={result} config={config} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
