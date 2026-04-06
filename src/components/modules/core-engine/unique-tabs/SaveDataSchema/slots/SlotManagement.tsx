'use client';

import { Layers, Play, Trash2, Copy, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_INFO, STATUS_WARNING, ACCENT_CYAN, ACCENT_CYAN_LIGHT, OVERLAY_WHITE,
  withOpacity, OPACITY_5, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../design';
import { ACCENT, ENHANCED_SLOTS } from '../data';

export function SlotManagement() {
  return (
    <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/10 flex items-center justify-between">
        <SectionHeader label="SLOT_MANAGEMENT_DASHBOARD" icon={Layers} color={ACCENT} />
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{ENHANCED_SLOTS.length} slots</span>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
        {ENHANCED_SLOTS.map((slot, i) => (
          <motion.div
            key={slot.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
            className={`border rounded-lg font-mono overflow-hidden group transition-colors ${
              slot.isAuto ? 'border-amber-500/30 hover:border-amber-500/60' : 'border-border/20 hover:border-cyan-500/60'
            }`}
          >
            {/* Thumbnail placeholder */}
            <div className="h-16 flex items-center justify-center text-xs font-mono uppercase tracking-[0.15em] relative overflow-hidden"
              style={{ backgroundColor: slot.isAuto ? withOpacity(STATUS_WARNING, OPACITY_5) : withOpacity(ACCENT, OPACITY_5) }}>
              <span className="text-text-muted relative z-10">[{slot.screenshotPlaceholder}]</span>
              {slot.isAuto && (
                <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-xs font-bold rounded-sm" style={{ backgroundColor: withOpacity(STATUS_WARNING, OPACITY_20), color: STATUS_WARNING, borderWidth: 1, borderStyle: 'solid', borderColor: withOpacity(STATUS_WARNING, OPACITY_30) }}>AUTO</span>
              )}
            </div>

            {/* Slot info */}
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold" style={{ color: slot.isAuto ? STATUS_WARNING : ACCENT_CYAN_LIGHT }}>{slot.characterName}</div>
                  <div className="text-xs text-text-muted">Lv.{slot.level} {slot.className}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-text-muted">{slot.label}</div>
                  <div className="text-text-muted">{slot.fileSize}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block">Zone</span>
                  <span className="truncate block" style={{ color: OVERLAY_WHITE }}>{slot.zone}</span>
                </div>
                <div>
                  <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block">Playtime</span>
                  <span style={{ color: OVERLAY_WHITE }}>{slot.playtime}</span>
                </div>
                <div>
                  <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block">Last</span>
                  <span style={{ color: OVERLAY_WHITE }}>{slot.lastPlayed}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-1.5 pt-1 border-t border-border/10">
                {[
                  { icon: Play, label: 'Load', color: STATUS_SUCCESS },
                  { icon: Trash2, label: 'Delete', color: STATUS_ERROR },
                  { icon: Copy, label: 'Duplicate', color: STATUS_INFO },
                  { icon: Download, label: 'Export', color: ACCENT_CYAN },
                ].map(action => (
                  <button
                    key={action.label}
                    className="flex items-center gap-1 px-2 py-1 rounded-sm border text-xs font-mono uppercase tracking-[0.15em] font-bold transition-colors hover:bg-white/5"
                    style={{ borderColor: `${withOpacity(action.color, OPACITY_20)}`, color: action.color }}
                  >
                    <action.icon className="w-3 h-3" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </BlueprintPanel>
  );
}
