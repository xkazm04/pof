'use client';

import { withOpacity, OPACITY_10 } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { ACCENT, LOOT_SUBTABS, type LootSubtab } from './_shared/data';

const FEATURES_STEP = { key: 'features' as LootSubtab, narrative: 'Catalog' };
const NARRATIVE_STEPS = [FEATURES_STEP, ...LOOT_SUBTABS.map(t => ({ key: t.key, narrative: t.narrative }))];

export function NarrativeBreadcrumb({ activeTab, onNavigate }: { activeTab: LootSubtab; onNavigate: (tab: LootSubtab) => void }) {
  const activeIdx = NARRATIVE_STEPS.findIndex(s => s.key === activeTab);
  return (
    <nav aria-label="Loot workflow" className={`flex items-center gap-0.5 ${TEXT_SCALE.meta} font-mono tracking-wide overflow-x-auto custom-scrollbar pb-0.5`}>
      {NARRATIVE_STEPS.map((step, i) => {
        const isPast = i < activeIdx;
        const isActive = i === activeIdx;
        return (
          <div key={step.key} className="flex items-center gap-0.5 flex-shrink-0">
            {i > 0 && <span className="text-text-subtle mx-0.5">{'>'}</span>}
            <button
              type="button"
              aria-current={isActive ? 'step' : undefined}
              onClick={() => onNavigate(step.key)}
              className="px-1.5 py-0.5 rounded transition-all cursor-pointer"
              style={{
                color: isActive ? ACCENT : isPast ? withOpacity(ACCENT, '99') : 'var(--text-subtle)',
                backgroundColor: isActive ? withOpacity(ACCENT, OPACITY_10) : 'transparent',
                fontWeight: isActive ? 700 : isPast ? 600 : 400,
              }}
            >
              {step.narrative}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
