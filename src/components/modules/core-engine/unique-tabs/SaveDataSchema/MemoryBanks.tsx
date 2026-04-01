'use client';

import { Database, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader } from './design';
import { SAVE_SLOTS, ACCENT } from './data';

export function MemoryBanks() {
  return (
    <div className="space-y-4 h-full flex flex-col">
      <BlueprintPanel color={ACCENT} className="p-0 flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border/10 flex items-center gap-2">
          <SectionHeader label="MEMORY_BANKS" icon={Database} color={ACCENT} />
        </div>

        <div className="p-4 space-y-3 relative z-10 flex-1 overflow-y-auto">
          {SAVE_SLOTS.map((slot, i) => (
            <motion.div
              key={slot.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className={`font-mono p-3 relative overflow-hidden group transition-colors rounded-lg ${
                slot.empty
                  ? 'border border-dashed border-border/20'
                  : `border ${slot.isAuto ? 'border-amber-500/30' : 'border-border/20'} hover:border-cyan-500`
              }`}
              style={!slot.empty ? { backgroundColor: slot.isAuto ? 'rgba(120,53,15,0.1)' : `${ACCENT}08` } : undefined}
            >
              {slot.empty ? (
                <div className="flex flex-col items-center justify-center py-3 gap-2">
                  <div className="w-8 h-8 rounded-full border border-dashed border-border/20 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-text-muted" />
                  </div>
                  <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{slot.label}</span>
                  <span className="text-xs text-text-muted">New Save</span>
                </div>
              ) : (
                <>
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${slot.isAuto ? 'bg-amber-500' : 'bg-cyan-500 opacity-50 group-hover:opacity-100 transition-opacity'}`} />

                  <div className="flex justify-between items-start mb-2 pl-2">
                    <span className={`text-xs font-bold tracking-[0.15em] uppercase ${slot.isAuto ? 'text-amber-400' : 'text-cyan-300'}`}>{slot.label}</span>
                    <span className="text-xs font-mono text-text-muted">{slot.ts}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-1.5 text-xs pl-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Location</span>
                      <span className="text-cyan-100 truncate pr-2">{slot.zone}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Integrity</span>
                      <span className="text-emerald-400">{slot.integrity}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Level</span>
                      <span className="text-cyan-100">Lv.{slot.level!.toString().padStart(2, '0')}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Uptime</span>
                      <span className="text-cyan-100">{slot.playtime}</span>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>
      </BlueprintPanel>
    </div>
  );
}
