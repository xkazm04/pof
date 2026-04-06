'use client';

import { Settings, CheckCircle2 } from 'lucide-react';
import { ACCENT_CYAN, ACCENT_CYAN_LIGHT, ACCENT_EMERALD, STATUS_ERROR, OVERLAY_WHITE,
  withOpacity, OPACITY_8, OPACITY_25, OPACITY_5, OPACITY_12, OPACITY_20, OPACITY_30, GLOW_MD,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, GlowStat } from '../design';
import { ACCENT } from '../data';
import { AUTO_SAVE_TRIGGERS, AUTO_SAVE_CONFIG } from '../data-panels';

export function AutoSaveConfigPanel() {
  return (
    <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/10">
        <SectionHeader label="AUTO_SAVE_CONFIG" icon={Settings} color={ACCENT} />
      </div>

      <div className="p-4 space-y-4 relative z-10">
        {/* Interval slider (visual only) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Save Interval</span>
            <span className="font-bold" style={{ color: ACCENT_CYAN_LIGHT }}>{AUTO_SAVE_CONFIG.intervalSeconds}s</span>
          </div>
          <div className="relative h-2 rounded-full border border-border/10" style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_8)}` }}>
            <div
              className="absolute top-0 bottom-0 left-0 rounded-full"
              style={{
                width: `${((AUTO_SAVE_CONFIG.intervalSeconds - 30) / (300 - 30)) * 100}%`,
                backgroundColor: ACCENT_CYAN,
                boxShadow: `${GLOW_MD} ${withOpacity(ACCENT_CYAN, OPACITY_25)}`,
              }}
            />
            <div className="absolute top-full mt-1 flex justify-between w-full text-xs font-mono text-text-muted">
              <span>30s</span>
              <span>120s</span>
              <span>300s</span>
            </div>
          </div>
        </div>

        {/* Triggers */}
        <div className="space-y-1.5 mt-6">
          <span className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: ACCENT }}>Triggers</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {AUTO_SAVE_TRIGGERS.map(trigger => (
              <div
                key={trigger.id}
                className={`flex items-center gap-4 px-3 py-2 border rounded-lg font-mono text-xs transition-colors ${
                  trigger.enabled
                    ? 'border-border/20'
                    : 'border-border/10 opacity-50'
                }`}
                style={{ backgroundColor: trigger.enabled ? `${withOpacity(ACCENT, OPACITY_8)}` : `${withOpacity(ACCENT, OPACITY_5)}` }}
              >
                <div
                  className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${
                    trigger.enabled ? '' : 'border-border/20'
                  }`}
                  style={trigger.enabled ? { borderColor: ACCENT_CYAN, backgroundColor: withOpacity(ACCENT_CYAN, OPACITY_20) } : undefined}
                >
                  {trigger.enabled && <CheckCircle2 className="w-3 h-3" style={{ color: ACCENT_CYAN }} />}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs uppercase tracking-[0.15em]" style={{ color: ACCENT_CYAN_LIGHT }}>{trigger.label}</div>
                  <div className="text-xs text-text-muted truncate">{trigger.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Additional settings */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          <GlowStat label="Max Auto-Saves" value={AUTO_SAVE_CONFIG.maxAutoSaves} unit="slots" color={ACCENT} delay={0} />
          <div className="relative p-3 rounded-lg border overflow-hidden" style={{ borderColor: `${withOpacity(ACCENT, OPACITY_12)}`, backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>
            <div className="text-xs font-mono uppercase tracking-[0.15em] mb-1.5 text-text-muted">Combat Save</div>
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-3 rounded-full relative" style={{ backgroundColor: AUTO_SAVE_CONFIG.combatSaveEnabled ? withOpacity(ACCENT_CYAN, OPACITY_30) : withOpacity(STATUS_ERROR, OPACITY_30) }}>
                <span className="absolute top-0.5 w-2 h-2 rounded-full transition-all" style={AUTO_SAVE_CONFIG.combatSaveEnabled ? { left: '0.875rem', backgroundColor: ACCENT_CYAN } : { left: '0.125rem', backgroundColor: STATUS_ERROR }} />
              </span>
              <span className="font-mono text-xs font-bold" style={{ color: AUTO_SAVE_CONFIG.combatSaveEnabled ? ACCENT_CYAN_LIGHT : STATUS_ERROR }}>{AUTO_SAVE_CONFIG.combatSaveEnabled ? 'ON' : 'OFF'}</span>
            </div>
            <div className="text-xs text-text-muted mt-0.5">Disabled during boss fights</div>
          </div>
          <div className="relative p-3 rounded-lg border overflow-hidden" style={{ borderColor: `${withOpacity(ACCENT, OPACITY_12)}`, backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>
            <div className="text-xs font-mono uppercase tracking-[0.15em] mb-1.5 text-text-muted">Compression</div>
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-3 rounded-full relative" style={{ backgroundColor: AUTO_SAVE_CONFIG.compressionEnabled ? withOpacity(ACCENT_EMERALD, OPACITY_30) : withOpacity(ACCENT_CYAN, OPACITY_12) }}>
                <span className="absolute top-0.5 w-2 h-2 rounded-full transition-all" style={AUTO_SAVE_CONFIG.compressionEnabled ? { left: '0.875rem', backgroundColor: ACCENT_EMERALD } : { left: '0.125rem', backgroundColor: ACCENT_CYAN }} />
              </span>
              <span className={`font-mono text-xs font-bold ${AUTO_SAVE_CONFIG.compressionEnabled ? '' : 'text-text-muted'}`} style={AUTO_SAVE_CONFIG.compressionEnabled ? { color: ACCENT_EMERALD } : undefined}>{AUTO_SAVE_CONFIG.compressionEnabled ? 'ON' : 'OFF'}</span>
            </div>
            <div className="text-xs text-text-muted mt-0.5">LZ4 fast compression</div>
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
