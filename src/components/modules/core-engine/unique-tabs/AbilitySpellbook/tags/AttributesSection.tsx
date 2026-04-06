'use client';

import { useState, useMemo } from 'react';
import { BarChart3, Network, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_IMPROVED, ACCENT_EMERALD_DARK,
  withOpacity, OPACITY_5, OPACITY_15, OPACITY_25,
} from '@/lib/chart-colors';
import {
  FeatureCard as SharedFeatureCard,
} from '../../_shared';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { useSpellbookData } from '../context';
import { ALL_CORE_ATTRIBUTES, ALL_DERIVED_ATTRIBUTES } from '../data';
import type { SectionProps } from '../types';
import { AttributeRelationshipWeb } from './AttributeRelationshipWeb';
import { AttributeGrowthChart } from './AttributeGrowthChart';

export function AttributesSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  const { CORE_ATTRIBUTES: liveCoreAttrs, DERIVED_ATTRIBUTES: liveDerivedAttrs } = useSpellbookData();
  const attrStatus = featureMap.get('Core AttributeSet')?.status ?? 'unknown';
  const [search, setSearch] = useState('');

  // Use expanded attributes, merging with live data
  const coreAttrs = useMemo(() => {
    const set = new Set([...ALL_CORE_ATTRIBUTES, ...liveCoreAttrs]);
    return Array.from(set);
  }, [liveCoreAttrs]);

  const derivedAttrs = useMemo(() => {
    const set = new Set([...ALL_DERIVED_ATTRIBUTES, ...liveDerivedAttrs]);
    return Array.from(set);
  }, [liveDerivedAttrs]);

  const filteredCore = useMemo(() => {
    if (!search) return coreAttrs;
    const q = search.toLowerCase();
    return coreAttrs.filter(a => a.toLowerCase().includes(q));
  }, [coreAttrs, search]);

  const filteredDerived = useMemo(() => {
    if (!search) return derivedAttrs;
    const q = search.toLowerCase();
    return derivedAttrs.filter(a => a.toLowerCase().includes(q));
  }, [derivedAttrs, search]);

  const totalAttrs = coreAttrs.length + derivedAttrs.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SharedFeatureCard name="Core AttributeSet" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT_EMERALD_DARK} />
        <SharedFeatureCard name="Default attribute initialization" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT_EMERALD_DARK} />
      </div>

      {/* Attribute catalog */}
      <BlueprintPanel color={ACCENT_EMERALD_DARK} className="p-3">
        <SectionHeader icon={BarChart3} label={`Attribute Set Catalog (${totalAttrs})`} color={ACCENT_EMERALD_DARK} />

        {/* Search */}
        <div className="relative mt-2 mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter attributes..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-deep border text-xs font-mono focus:outline-none transition-colors"
            style={{
              borderColor: search ? withOpacity(ACCENT_EMERALD_DARK, OPACITY_25) : 'var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>

        {/* Core Attributes */}
        <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted mb-2">
          Core Attributes ({filteredCore.length})
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {filteredCore.map((attr, i) => {
            const isInit = attrStatus === 'implemented' || attrStatus === 'improved';
            const c = isInit ? STATUS_SUCCESS : 'var(--text-muted)';
            return (
              <motion.div
                key={attr}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-[0.15em] font-medium border"
                style={{
                  backgroundColor: isInit ? withOpacity(STATUS_SUCCESS, OPACITY_5) : 'transparent',
                  borderColor: isInit ? withOpacity(STATUS_SUCCESS, OPACITY_15) : 'var(--border)',
                  color: c,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: isInit ? STATUS_SUCCESS : 'var(--border-bright)', boxShadow: isInit ? `0 0 6px ${STATUS_SUCCESS}` : 'none' }} />
                <span className="font-mono truncate" style={isInit ? { textShadow: `0 0 12px ${withOpacity(STATUS_SUCCESS, OPACITY_25)}` } : undefined}>{attr}</span>
              </motion.div>
            );
          })}
        </div>

        {/* Derived Attributes */}
        <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted mb-2">
          Derived Attributes ({filteredDerived.length})
        </div>
        <div className="grid grid-cols-3 gap-2">
          {filteredDerived.map((attr, i) => {
            const isInit = attrStatus === 'implemented' || attrStatus === 'improved';
            const c = isInit ? STATUS_IMPROVED : 'var(--text-muted)';
            return (
              <motion.div
                key={attr}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (filteredCore.length + i) * 0.03 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-[0.15em] font-medium border"
                style={{
                  backgroundColor: isInit ? withOpacity(STATUS_IMPROVED, OPACITY_5) : 'transparent',
                  borderColor: isInit ? withOpacity(STATUS_IMPROVED, OPACITY_15) : 'var(--border)',
                  color: c,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: isInit ? STATUS_IMPROVED : 'var(--border-bright)', boxShadow: isInit ? `0 0 6px ${STATUS_IMPROVED}` : 'none' }} />
                <span className="font-mono truncate" style={isInit ? { textShadow: `0 0 12px ${withOpacity(STATUS_IMPROVED, OPACITY_25)}` } : undefined}>{attr}</span>
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
