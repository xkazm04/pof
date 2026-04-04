'use client';

import { Save, Clock, HardDrive, FolderOpen } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, OPACITY_15 } from '@/lib/chart-colors';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface SaveLoadSystemPanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = MODULE_COLORS.systems;

const SAVE_SLOTS = [
  { name: 'AutoSave_01', timestamp: '2026-03-31 14:22', playtime: '12h 34m', level: 'ShadowCitadel', size: '2.4 MB' },
  { name: 'QuickSave', timestamp: '2026-03-31 15:01', playtime: '13h 02m', level: 'VolcanicRift', size: '2.5 MB' },
  { name: 'Manual_01', timestamp: '2026-03-30 22:15', playtime: '11h 45m', level: 'WhisperWoods', size: '2.3 MB' },
  { name: 'Manual_02', timestamp: '2026-03-29 18:30', playtime: '9h 22m', level: 'Catacombs', size: '2.1 MB' },
  { name: 'AutoSave_02', timestamp: '2026-03-31 13:50', playtime: '12h 20m', level: 'ShadowCitadel', size: '2.4 MB' },
] as const;

const AUTOSAVE_CONFIG = {
  enabled: true,
  intervalMinutes: 5,
  maxSlots: 3,
  saveOnLevelChange: true,
  saveOnQuit: true,
  compressionLevel: 'LZ4' as const,
  asyncSave: true,
  maxSizeWarningMB: 10,
} as const;

const SAVE_SUBSYSTEMS = [
  { name: 'Player State', status: 'serializable' as const, fields: 24 },
  { name: 'Inventory', status: 'serializable' as const, fields: 18 },
  { name: 'Quest Progress', status: 'serializable' as const, fields: 12 },
  { name: 'World State', status: 'partial' as const, fields: 36 },
  { name: 'AI Memory', status: 'partial' as const, fields: 8 },
] as const;

function subsystemColor(status: string): string {
  if (status === 'serializable') return STATUS_SUCCESS;
  return STATUS_WARNING;
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function SaveMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Save className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{SAVE_SLOTS.length} slots</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function SaveCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Save Slots</span>
        <span className="font-mono text-text">Auto: {AUTOSAVE_CONFIG.intervalMinutes}m</span>
      </div>
      {SAVE_SLOTS.slice(0, 4).map((slot) => (
        <div key={slot.name} className="flex items-center gap-2">
          <HardDrive className="w-3 h-3 flex-shrink-0" style={{ color: ACCENT }} />
          <span className="text-text flex-1 truncate">{slot.name}</span>
          <span className="text-text-muted text-2xs">{slot.level}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Full density ──────────────────────────────────────────────────────── */

function SaveFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Save/Load system with slot management, auto-save configuration, and serialization subsystem status.
      </SurfaceCard>

      {/* Auto-Save Config */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Clock} label="Auto-Save Config" color={ACCENT} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
          <span className="text-text-muted">Interval</span>
          <span className="font-mono text-text">{AUTOSAVE_CONFIG.intervalMinutes} min</span>
          <span className="text-text-muted">Max Slots</span>
          <span className="font-mono text-text">{AUTOSAVE_CONFIG.maxSlots}</span>
          <span className="text-text-muted">On Level Change</span>
          <span className="font-mono" style={{ color: STATUS_SUCCESS }}>{AUTOSAVE_CONFIG.saveOnLevelChange ? 'Yes' : 'No'}</span>
          <span className="text-text-muted">On Quit</span>
          <span className="font-mono" style={{ color: STATUS_SUCCESS }}>{AUTOSAVE_CONFIG.saveOnQuit ? 'Yes' : 'No'}</span>
          <span className="text-text-muted">Compression</span>
          <span className="font-mono text-text">{AUTOSAVE_CONFIG.compressionLevel}</span>
          <span className="text-text-muted">Async</span>
          <span className="font-mono" style={{ color: STATUS_INFO }}>{AUTOSAVE_CONFIG.asyncSave ? 'Enabled' : 'Disabled'}</span>
        </div>
      </SurfaceCard>

      {/* Save Slots */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={FolderOpen} label="Save Slots" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {SAVE_SLOTS.map((slot, i) => (
            <motion.div
              key={slot.name}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="text-xs"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-text font-medium">{slot.name}</span>
                <span className="text-text-muted text-2xs">{slot.size}</span>
              </div>
              <div className="flex gap-3 text-text-muted text-2xs">
                <span>{slot.level}</span>
                <span>{slot.playtime}</span>
                <span>{slot.timestamp}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Subsystem Status */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Save} label="Serialization Status" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {SAVE_SUBSYSTEMS.map((sys, i) => (
            <motion.div
              key={sys.name}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: subsystemColor(sys.status) }}
              />
              <span className="text-text flex-1">{sys.name}</span>
              <span className="text-text-muted font-mono text-2xs">{sys.fields} fields</span>
              <span
                className="text-2xs px-1.5 py-0.5 rounded capitalize"
                style={{ backgroundColor: `${subsystemColor(sys.status)}${OPACITY_15}`, color: subsystemColor(sys.status) }}
              >
                {sys.status}
              </span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SaveLoadSystemPanel({ featureMap, defs }: SaveLoadSystemPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Save/Load System" icon={<Save className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <SaveMicro />}
          {density === 'compact' && <SaveCompact />}
          {density === 'full' && <SaveFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
