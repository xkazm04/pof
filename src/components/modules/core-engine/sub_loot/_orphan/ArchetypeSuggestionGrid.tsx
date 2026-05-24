'use client';

import { motion } from 'framer-motion';
import { Wand2 } from 'lucide-react';
import {
  STATUS_ERROR, ACCENT_EMERALD, ACCENT_CYAN,
  OPACITY_5, OPACITY_10, OPACITY_15, OPACITY_20,
  withOpacity,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import {
  AFFIX_POOL, SYNERGY_RULES, SYNERGY_COLORS, RARITY_COLORS,
} from './data';
import type { RarityArchetype, CraftedAffix, Rarity } from './data';

interface ArchetypeSuggestionGridProps {
  archetypes: RarityArchetype[];
  craftedAffixes: CraftedAffix[];
  onApplyArchetype: (arch: RarityArchetype) => void;
  rarity: Rarity;
}

export function ArchetypeSuggestionGrid({
  archetypes, craftedAffixes, onApplyArchetype, rarity,
}: ArchetypeSuggestionGridProps) {
  if (archetypes.length === 0) return null;

  const rarityColor = RARITY_COLORS[rarity];

  return (
    <SurfaceCard level={2} className="p-4 relative overflow-hidden">
      <SectionLabel label="Smart Rarity Patterns" />
      <p className="text-2xs text-text-muted mt-1 mb-3">
        Synergy-optimized affix loadouts for <span className="font-bold" style={{ color: rarityColor }}>{rarity}</span> items. Click to auto-fill.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {archetypes.map((arch, ai) => {
          const isActive = craftedAffixes.length > 0 &&
            arch.affixTags.every(t => craftedAffixes.some(a => a.tag === t)) &&
            craftedAffixes.every(a => arch.affixTags.includes(a.tag));

          return (
            <motion.button
              key={arch.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ai * 0.06 }}
              onClick={() => onApplyArchetype(arch)}
              className="text-left p-3 rounded-lg border transition-all hover:scale-[1.02] group"
              style={{
                borderColor: isActive ? arch.color : `${arch.color}${OPACITY_20}`,
                backgroundColor: isActive ? `${arch.color}${OPACITY_15}` : `${arch.color}${OPACITY_5}`,
                boxShadow: isActive ? `0 0 12px ${withOpacity(arch.color, OPACITY_20)}` : 'none',
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Wand2 className="w-3.5 h-3.5 transition-transform group-hover:rotate-12" style={{ color: arch.color }} />
                <span className="text-xs font-bold" style={{ color: arch.color }}>{arch.name}</span>
                {isActive && (
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${arch.color}${OPACITY_20}`, color: arch.color }}>
                    Active
                  </span>
                )}
              </div>

              {/* Synergy badges */}
              <div className="flex flex-wrap gap-1 mb-2">
                {arch.synergies.map(s => {
                  const rule = SYNERGY_RULES.find(r => r.label === s);
                  const sevColor = rule ? SYNERGY_COLORS[rule.severity] : ACCENT_EMERALD;
                  return (
                    <span
                      key={s}
                      className="text-xs font-mono px-1.5 py-0.5 rounded border"
                      style={{ color: sevColor, borderColor: `${sevColor}${OPACITY_20}`, backgroundColor: `${sevColor}${OPACITY_10}` }}
                    >
                      {s}
                    </span>
                  );
                })}
              </div>

              {/* Affix preview list */}
              <div className="space-y-0.5">
                {arch.affixTags.map(tag => {
                  const entry = AFFIX_POOL.find(a => a.tag === tag);
                  if (!entry) return null;
                  const catColor = entry.category === 'offensive' ? STATUS_ERROR : entry.category === 'defensive' ? ACCENT_EMERALD : ACCENT_CYAN;
                  return (
                    <div key={tag} className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                      <span className="text-text-muted truncate">{entry.displayName}</span>
                      <span className="ml-auto text-text-muted opacity-60">{entry.stat}</span>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="mt-2 pt-1.5 border-t border-border/30 flex items-center justify-between text-xs font-mono text-text-muted">
                <span>{arch.affixTags.length} affixes</span>
                <span>{arch.synergies.length} synergies</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
