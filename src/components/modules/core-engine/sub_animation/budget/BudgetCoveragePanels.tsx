'use client';

import { motion } from 'framer-motion';
import { STATUS_WARNING, withOpacity, OPACITY_8, OPACITY_20 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ACCENT, BUDGET_LIMITS } from '../_shared/data';

/* ── Budget Tracker ────────────────────────────────────────────────────────── */

/**
 * The animation budget PoF holds a project to — **targets only**.
 *
 * This panel used to render four ring gauges reading "2/4 montage slots",
 * "65/120 bones" and so on. Each `current` was a literal in `_shared/data.ts`;
 * nothing measured a live animation graph, and the bridge manifest carries none
 * of these four quantities either. So the gauges are gone: the limits stay
 * (they are a real design budget) and the usage says it is unmeasured, which is
 * the honest state until something reads it.
 */
export function BudgetTracker() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Animation Budget Limits" color={ACCENT} />
      <p
        data-testid="anim-budget-measured"
        data-measured="false"
        className="text-xs font-mono text-text-muted mt-1 mb-3 leading-relaxed"
      >
        <span className="font-bold" style={{ color: STATUS_WARNING }}>USAGE NOT MEASURED</span>
        {' — '}these are the budget targets an animation graph is held to. PoF reads none of them: nothing
        here samples a running UE5 animation graph, and the bridge manifest carries no slot, blend, IK or
        skeleton figure. The limits below are what you are aiming at, not what your project is doing.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {BUDGET_LIMITS.map((limit, i) => (
          <motion.div
            key={limit.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-lg px-3 py-2"
            style={{
              backgroundColor: withOpacity(ACCENT, OPACITY_8),
              border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}`,
            }}
          >
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted truncate" title={limit.label}>
              {limit.label}
            </div>
            <div className="text-sm font-mono font-bold text-text">
              &le; {limit.target}{limit.unit}
            </div>
            <div className="text-xs font-mono text-text-muted">budget</div>
          </motion.div>
        ))}
      </div>
    </BlueprintPanel>
  );
}
