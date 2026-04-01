'use client';

import { useState } from 'react';
import { Globe, Award, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_PINK, STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, GlowStat, NeonBar } from '../_design';
import { InteractivePill } from '@/components/ui/InteractivePill';
import {
  LANGUAGES, LANGUAGE_PILLS,
  A11Y_OVERALL_GRADE, A11Y_OVERALL_SCORE, A11Y_CATEGORIES,
} from './data';

const ACCENT = ACCENT_PINK;

export function AccessibilityTab() {
  const [selectedLang, setSelectedLang] = useState(0);
  const lang = LANGUAGES[selectedLang];

  return (
    <motion.div key="a11y" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BlueprintPanel color={ACCENT} className="p-4">
          <SectionHeader label="Localization Expansion Preview" color={ACCENT} icon={Globe} />
          <div className="mb-2.5">
            <InteractivePill items={LANGUAGE_PILLS} activeIndex={selectedLang} onChange={setSelectedLang} accent={ACCENT} layoutId="lang-pill" />
          </div>
          <div className="bg-surface-deep/50 rounded-lg p-3 border border-border/30">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Estimated Expansion</span>
              <span className="text-lg font-mono font-bold" style={{ color: lang.expansion > 110 ? STATUS_WARNING : STATUS_SUCCESS }}>
                {lang.expansion}%
              </span>
            </div>
            <div className="w-full h-3 bg-surface rounded-full overflow-hidden border border-border/20 relative">
              <div className="absolute top-0 bottom-0 left-0 bg-surface-hover z-0" style={{ width: '100%' }} />
              <motion.div
                className="absolute top-0 bottom-0 left-0 z-10"
                style={{ backgroundColor: lang.expansion > 110 ? STATUS_WARNING : STATUS_SUCCESS }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(lang.expansion, 150)}%` }}
                transition={{ type: 'spring' }}
              />
              <div className="absolute top-0 bottom-0 left-[100%] w-0.5 bg-red-500 z-20 shadow-[0_0_4px_red]" />
            </div>
            {lang.overflowWidgets.length > 0 && (
              <div className="mt-2.5 pt-3 border-t border-border/20">
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-amber-500 font-bold mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Potential Overflow Areas
                </span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {lang.overflowWidgets.map(w => (
                    <span key={w} className="px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded border border-amber-500/30 text-xs font-mono">{w}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </BlueprintPanel>

        <BlueprintPanel color={ACCENT} className="p-4 flex flex-col items-center justify-center">
          <div className="w-full"><SectionHeader label="Accessibility Score Card" color={ACCENT} icon={Award} /></div>
          <div className="flex items-center justify-center gap-8 w-full shrink-0">
            <div className="relative flex items-center justify-center w-32 h-32 rounded-full border-4 shadow-lg shrink-0"
              style={{
                borderColor: A11Y_OVERALL_SCORE > 80 ? STATUS_SUCCESS : STATUS_WARNING,
                backgroundColor: `${A11Y_OVERALL_SCORE > 80 ? STATUS_SUCCESS : STATUS_WARNING}10`,
              }}>
              <div className="flex flex-col items-center text-center">
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Grade</span>
                <span className="text-4xl font-black">{A11Y_OVERALL_GRADE}</span>
                <span className="text-xs font-mono" style={{ color: A11Y_OVERALL_SCORE > 80 ? STATUS_SUCCESS : STATUS_WARNING }}>
                  {A11Y_OVERALL_SCORE}/100
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-3 shrink-0 max-w-[50%]">
              {A11Y_CATEGORIES.map(c => (
                <div key={c.name} className="flex items-center justify-between text-xs font-mono bg-surface/50 p-1.5 rounded border border-border/30">
                  <span className="text-text-muted truncate w-[60%] shrink">{c.name}</span>
                  <span className="font-bold shrink-0 w-[40px] text-center" style={{ color: c.color }}>{c.grade}</span>
                </div>
              ))}
            </div>
          </div>
        </BlueprintPanel>
      </div>
    </motion.div>
  );
}
