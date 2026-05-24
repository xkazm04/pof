'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { withOpacity, OPACITY_10 } from '@/lib/chart-colors';
import type { SubTab } from '../unique-tabs/_shared';
import { FOCUS_RING_CLASS, focusRingStyle } from '@/lib/ui/focus-ring';
import { ACCENT, COMBAT_SUBTABS, type CombatSubtab } from './_shared/data';

/* ── Narrative Breadcrumb ──────────────────────────────────────────────── */

const FEATURES_STEP = { key: 'features' as CombatSubtab, narrative: 'Catalog' };
const NARRATIVE_STEPS = [FEATURES_STEP, ...COMBAT_SUBTABS.map(t => ({ key: t.key, narrative: t.narrative }))];

export function NarrativeBreadcrumb({ activeTab, onNavigate }: { activeTab: CombatSubtab; onNavigate: (tab: CombatSubtab) => void }) {
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

/* ── Sub-Tab Navigation (local copy of shared SubTabNavigation, with testIds) ── */

export function CombatSubTabNav({
  tabs,
  activeTabId,
  onChange,
}: {
  tabs: SubTab[];
  activeTabId: string;
  onChange: (id: string) => void;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <div className="flex gap-1 mb-2 border-b border-border/40 pb-1.5 overflow-x-auto custom-scrollbar">
      {tabs.map(tab => {
        const isActive = activeTabId === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            data-testid={`pof-module-arpg-combat-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            style={focusRingStyle(ACCENT)}
            className={`
              relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold
              transition-all duration-300 focus:outline-none whitespace-nowrap ${FOCUS_RING_CLASS}
              ${isActive ? 'text-white' : 'text-text-muted hover:text-text hover:bg-surface/50'}
            `}
          >
            {isActive && (
              <motion.div
                layoutId="activeCombatSubTabBg"
                className="absolute inset-0 rounded-lg opacity-20"
                style={{ backgroundColor: ACCENT }}
                transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 25 }}
              />
            )}
            {Icon && (
              <Icon
                className="w-3.5 h-3.5 relative z-10 transition-colors duration-300"
                style={{ color: isActive ? ACCENT : 'currentColor' }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Active tab subtitle ──────────────────────────────────────────────── */

export function getActiveSubtitle(tab: CombatSubtab): string | null {
  if (tab === 'features') return 'Feature implementation status & metrics';
  const def = COMBAT_SUBTABS.find(t => t.key === tab);
  return def?.subtitle ?? null;
}
