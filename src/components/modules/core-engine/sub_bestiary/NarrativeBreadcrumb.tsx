'use client';

import { ACCENT_ORANGE, withOpacity, OPACITY_10 } from '@/lib/chart-colors';
import { BESTIARY_SUBTABS, type BestiarySubtab } from './_shared/data';

const ACCENT = ACCENT_ORANGE;
const FEATURES_STEP = { key: 'features' as BestiarySubtab, narrative: 'Catalog' };
const NARRATIVE_STEPS = [FEATURES_STEP, ...BESTIARY_SUBTABS.map(t => ({ key: t.key, narrative: t.narrative }))];

interface NarrativeBreadcrumbProps {
  activeTab: BestiarySubtab;
  onNavigate: (tab: BestiarySubtab) => void;
}

export function NarrativeBreadcrumb({ activeTab, onNavigate }: NarrativeBreadcrumbProps) {
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
