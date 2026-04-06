'use client';

import { Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { WORLD_ITEMS } from '../data';
import { DUMMY_ITEMS } from '../../ItemCatalog/data';
import { BlueprintPanel, SectionHeader } from '../design';

import { withOpacity, OVERLAY_WHITE, OPACITY_5, OPACITY_12, OPACITY_50, OPACITY_25, OPACITY_8 } from '@/lib/chart-colors';

const itemMap = new Map(DUMMY_ITEMS.map(i => [i.name, i]));

export function WorldItemPreview() {
  return (
    <div>
      <div className="mb-2 px-1">
        <SectionHeader label="World Item Preview" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WORLD_ITEMS.map((item) => {
          const catalogEntry = itemMap.get(item.name);
          return (
          <motion.div
            key={item.name}
            whileHover={{ y: -4, scale: 1.02 }}
            className="relative group h-full"
            style={{ perspective: 1000 }}
          >
            <BlueprintPanel className="h-full px-3 py-3 flex items-start gap-3 relative overflow-hidden transition-all duration-300 border border-transparent group-hover:border-text-muted/20"
              noBrackets
            >
              {/* Glow & Particles */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(to bottom right, ${withOpacity(OVERLAY_WHITE, OPACITY_5)}, transparent)` }} />
              <div className="absolute top-0 right-0 w-24 h-24 blur-2xl rounded-full pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity" style={{ backgroundColor: item.beamColor }} />
              <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0" style={{ backgroundImage: `radial-gradient(circle at center, ${withOpacity(item.beamColor, OPACITY_12)} 1px, transparent 1px)`, backgroundSize: '8px 8px' }} />

              <div
                className="w-1 self-stretch rounded-full flex-shrink-0 relative z-10 shadow-[0_0_8px_currentColor]"
                style={{ backgroundColor: item.beamColor, color: item.beamColor }}
              />
              <div className="min-w-0 relative z-10 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1 rounded bg-surface border border-border/50 shadow-inner">
                    <Package className="w-3.5 h-3.5 flex-shrink-0" style={{ color: item.beamColor, filter: `drop-shadow(0 0 4px ${withOpacity(item.beamColor, OPACITY_50)})` }} />
                  </div>
                  <span className="text-sm font-bold text-text truncate tracking-wide">{item.name}</span>
                  {catalogEntry && (
                    <span className="ml-auto flex-shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded-full border"
                      style={{ borderColor: withOpacity(item.beamColor, OPACITY_25), color: item.beamColor, backgroundColor: withOpacity(item.beamColor, OPACITY_8) }}
                      title={`${catalogEntry.type} / ${catalogEntry.subtype} — ${catalogEntry.description}`}>
                      {catalogEntry.type} · {catalogEntry.subtype}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mb-1.5 px-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.beamColor, boxShadow: `0 0 5px ${item.beamColor}` }} />
                  <span className="text-xs font-mono uppercase tracking-widest" style={{ color: item.beamColor }}>{item.rarity}</span>
                </div>
                <p className="text-xs text-text-muted bg-surface-deep/50 px-2 py-1.5 rounded border border-border/30 shadow-inner leading-relaxed">{item.pickup}</p>
              </div>
            </BlueprintPanel>
          </motion.div>
          );
        })}
      </div>
    </div>
  );
}
