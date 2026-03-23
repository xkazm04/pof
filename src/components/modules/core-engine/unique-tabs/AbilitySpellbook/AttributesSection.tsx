'use client';

import { BarChart3, Network } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_IMPROVED, ACCENT_EMERALD_DARK,
} from '@/lib/chart-colors';
import {
  FeatureCard as SharedFeatureCard,
} from '../_shared';
import { BlueprintPanel, SectionHeader } from '../_design';
import { useSpellbookData } from './context';
import type { SectionProps } from './types';
import { AttributeRelationshipWeb } from './AttributeRelationshipWeb';
import { AttributeGrowthChart } from './AttributeGrowthChart';

export function AttributesSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  const { CORE_ATTRIBUTES, DERIVED_ATTRIBUTES } = useSpellbookData();
  const attrStatus = featureMap.get('Core AttributeSet')?.status ?? 'unknown';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SharedFeatureCard name="Core AttributeSet" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT_EMERALD_DARK} />
        <SharedFeatureCard name="Default attribute initialization" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT_EMERALD_DARK} />
      </div>

      {/* Attribute catalog */}
      <BlueprintPanel color={ACCENT_EMERALD_DARK} className="p-3">
        <SectionHeader icon={BarChart3} label="Attribute Set Catalog" color={ACCENT_EMERALD_DARK} />

        {/* Core Attributes */}
        <div className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-text-muted mb-2">Core Attributes</div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {CORE_ATTRIBUTES.map((attr, i) => {
            const isInit = attrStatus === 'implemented' || attrStatus === 'improved';
            const c = isInit ? STATUS_SUCCESS : 'var(--text-muted)';
            return (
              <motion.div
                key={attr}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-mono uppercase tracking-[0.15em] font-medium border"
                style={{
                  backgroundColor: isInit ? `${STATUS_SUCCESS}08` : 'transparent',
                  borderColor: isInit ? `${STATUS_SUCCESS}25` : 'var(--border)',
                  color: c,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: isInit ? STATUS_SUCCESS : 'var(--border-bright)', boxShadow: isInit ? `0 0 6px ${STATUS_SUCCESS}` : 'none' }} />
                <span className="font-mono" style={isInit ? { textShadow: `0 0 12px ${STATUS_SUCCESS}40` } : undefined}>{attr}</span>
              </motion.div>
            );
          })}
        </div>

        {/* Derived Attributes */}
        <div className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-text-muted mb-2">Derived Attributes</div>
        <div className="grid grid-cols-3 gap-2">
          {DERIVED_ATTRIBUTES.map((attr, i) => {
            const isInit = attrStatus === 'implemented' || attrStatus === 'improved';
            const c = isInit ? STATUS_IMPROVED : 'var(--text-muted)';
            return (
              <motion.div
                key={attr}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (CORE_ATTRIBUTES.length + i) * 0.05 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-mono uppercase tracking-[0.15em] font-medium border"
                style={{
                  backgroundColor: isInit ? `${STATUS_IMPROVED}08` : 'transparent',
                  borderColor: isInit ? `${STATUS_IMPROVED}25` : 'var(--border)',
                  color: c,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: isInit ? STATUS_IMPROVED : 'var(--border-bright)', boxShadow: isInit ? `0 0 6px ${STATUS_IMPROVED}` : 'none' }} />
                <span className="font-mono" style={isInit ? { textShadow: `0 0 12px ${STATUS_IMPROVED}40` } : undefined}>{attr}</span>
              </motion.div>
            );
          })}
        </div>
      </BlueprintPanel>

      {/* Attribute Relationship Web */}
      <BlueprintPanel color={ACCENT_EMERALD_DARK} className="p-3">
        <SectionHeader icon={Network} label="Attribute Relationship Web" color={ACCENT_EMERALD_DARK} />
        <div className="mt-4 flex justify-center min-h-[200px]">
          <AttributeRelationshipWeb />
        </div>
      </BlueprintPanel>

      {/* Attribute Growth Projections */}
      <BlueprintPanel color={ACCENT_EMERALD_DARK} className="p-3">
        <SectionHeader icon={BarChart3} label="Attribute Growth Projections (Lv 1-50)" color={ACCENT_EMERALD_DARK} />
        <div className="mt-4 min-h-[200px]">
          <AttributeGrowthChart />
        </div>
      </BlueprintPanel>
    </div>
  );
}
