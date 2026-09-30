'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_EMERALD, ACCENT_CYAN,
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_NEUTRAL,
  OPACITY_10, OPACITY_20, OPACITY_25, withOpacity,
} from '@/lib/chart-colors';
import { EASE_OUT } from '@/lib/motion';
import { GlowStat } from '../../unique-tabs/_design';
import { SubTabNavigation } from '../../unique-tabs/_shared';
import type { ItemEconomyConfig, ItemEconomyResult } from '@/lib/economy/item-economy-engine';
import {
  endgameCoverage, HORIZON_LADDER,
  type EconomyVerdict, type RunSummary,
} from '@/lib/economy/item-economy-verdicts';
import { ACCENT, SUB_TABS } from './constants';
import { PowerTab, RarityTab } from './PowerRarityTabs';
import { AffixTab, AlertsTab } from './AffixAlertsTabs';
import { VERDICT_COLORS, formatVerdictValue } from './AlertCard';

const TAB_TRANSITION = { duration: 0.16, ease: EASE_OUT };

/** A tile value: an em dash when the bracket was never sampled, never a measured-looking 0. */
const tile = (v: number | null) => (v === null ? '—' : v.toFixed(0));

interface Props {
  summary: RunSummary;
  result: ItemEconomyResult;
  verdicts: EconomyVerdict[];
  config: ItemEconomyConfig;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  /** Re-run at the same seed up the horizon ladder until the endgame is sampled */
  onExtend: () => void;
  /** Outcome of the last extend (which rung measured the endgame, or why none did) */
  extendNote: string | null;
}

/* ── Coverage strip ─ how much of the endgame this run actually sampled ── */

function CoverageStrip({ result, onExtend, extendNote }: Pick<Props, 'result' | 'onExtend' | 'extendNote'>) {
  const c = endgameCoverage(result);
  const color = c.measured ? STATUS_SUCCESS : STATUS_NEUTRAL;
  return (
    <div
      data-testid="econ-coverage"
      className="flex items-center gap-2 flex-wrap px-2.5 py-1.5 rounded-md text-xs font-mono"
      style={{ backgroundColor: `${color}${OPACITY_10}`, border: `1px solid ${withOpacity(color, OPACITY_20)}` }}
    >
      <span className="font-bold text-text">Endgame Lv{c.from}-{c.to}:</span>
      <span className="text-text">{c.agentsReached}/{c.playerCount} agents</span>
      <span className="text-text-muted">&middot; {c.levelsSampled}/{c.levelsTotal} levels sampled &middot;</span>
      <span className="font-bold uppercase" style={{ color: c.measured ? STATUS_SUCCESS : 'var(--text)' }}>
        {c.measured ? 'MEASURED' : 'UNMEASURED'}
      </span>
      <span className="text-text-muted">seed {result.config.seed}, {result.config.maxHours} h</span>
      {extendNote && <span className="text-text-muted">&middot; {extendNote}</span>}
      {!c.measured && (
        <button
          type="button"
          onClick={onExtend}
          className="ml-auto px-2.5 py-1 rounded font-bold focus-ring-inset"
          style={{ color: ACCENT, backgroundColor: `${ACCENT}${OPACITY_20}`, border: `1px solid ${withOpacity(ACCENT, OPACITY_25)}` }}
          title={`Re-run at seed ${result.config.seed} on ${HORIZON_LADDER.join(' / ')} h until the endgame is sampled`}
        >
          Extend horizon to measure endgame
        </button>
      )}
    </div>
  );
}

export function SimulationResults({
  summary, result, verdicts, config, activeTab, setActiveTab, onExtend, extendNote,
}: Props) {
  const inflation = verdicts.find((v) => v.family === 'rarity-inflation')!;
  return (
    <div className="space-y-3">
      <CoverageStrip result={result} onExtend={onExtend} extendNote={extendNote} />

      {/* Summary stats */}
      <div className="grid grid-cols-6 gap-2">
        <GlowStat label="Peak Power" value={tile(summary.peakPower)}
          color={ACCENT} delay={0} />
        <GlowStat label="Mid Power" value={tile(summary.midPower)}
          color={summary.midPower === null ? STATUS_NEUTRAL : ACCENT_EMERALD} delay={0.05} />
        <GlowStat label="End Power" value={tile(summary.endgamePower)}
          color={summary.endgamePower === null ? STATUS_NEUTRAL : ACCENT_CYAN} delay={0.1} />
        <GlowStat label="Inflation" value={formatVerdictValue(inflation)}
          color={VERDICT_COLORS[inflation.state]} delay={0.15} />
        <GlowStat label="Findings" value={String(summary.findings)}
          color={summary.criticalCount > 0 ? STATUS_ERROR
            : summary.findings > 0 ? STATUS_WARNING : STATUS_SUCCESS} delay={0.2} />
        <GlowStat label="Unmeasured" value={String(summary.unmeasuredCount)}
          color={summary.unmeasuredCount > 0 ? STATUS_NEUTRAL : STATUS_SUCCESS} delay={0.25} />
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
          {activeTab === 'rarity' && <RarityTab result={result} config={config} inflation={inflation} />}
          {activeTab === 'affixes' && <AffixTab result={result} />}
          {activeTab === 'alerts' && <AlertsTab verdicts={verdicts} config={config} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
