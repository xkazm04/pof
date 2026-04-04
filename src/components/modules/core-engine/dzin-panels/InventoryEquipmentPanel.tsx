'use client';

import { useState } from 'react';
import { Shield } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  SectionLabel,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_EMERALD_DARK, STATUS_NEUTRAL } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface InventoryEquipmentPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_EMERALD_DARK;

const EQUIPMENT_SLOTS = [
  { name: 'Helmet', slot: 'Head', equipped: true },
  { name: 'Chest', slot: 'Torso', equipped: true },
  { name: 'Gloves', slot: 'Hands', equipped: false },
  { name: 'Boots', slot: 'Feet', equipped: true },
  { name: 'MainHand', slot: 'Weapon', equipped: true },
  { name: 'OffHand', slot: 'Shield/Offhand', equipped: false },
  { name: 'Ring1', slot: 'Accessory', equipped: false },
  { name: 'Amulet', slot: 'Accessory', equipped: true },
] as const;

const EQUIPMENT_FEATURES = ['Equipment slot system', 'UARPGItemInstance', 'UARPGInventoryComponent'];

/* ── Micro density ──────────────────────────────────────────────────────── */

function EquipmentMicro() {
  const equipped = EQUIPMENT_SLOTS.filter((s) => s.equipped).length;
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Shield className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{equipped}/{EQUIPMENT_SLOTS.length}</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function EquipmentCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {EQUIPMENT_SLOTS.slice(0, 5).map((slot) => (
        <div key={slot.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: slot.equipped ? ACCENT : STATUS_NEUTRAL }}
          />
          <span className="text-text-muted flex-1">{slot.name}</span>
          <span className="font-mono text-text-muted text-2xs">{slot.slot}</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {EQUIPMENT_SLOTS.length} slots total
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function EquipmentFull({ featureMap, defs }: InventoryEquipmentPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      {/* Description */}
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Equipment system with {EQUIPMENT_SLOTS.length} slots, stat bonuses from equipped items, and
        drag-and-drop swap logic via <span className="font-mono text-xs text-text">UARPGInventoryComponent</span>.
      </SurfaceCard>

      {/* Slot Grid */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Shield} label="Equipment Slots" color={ACCENT} />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gridGap} mt-2`}>
          {EQUIPMENT_SLOTS.map((slot, i) => (
            <motion.div
              key={slot.name}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2 bg-surface-deep border rounded-lg p-2.5 group"
              style={{ borderColor: slot.equipped ? `${ACCENT}50` : 'var(--border)' }}
            >
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  backgroundColor: slot.equipped ? `${ACCENT}20` : 'transparent',
                  border: `1.5px solid ${slot.equipped ? `${ACCENT}50` : `${STATUS_NEUTRAL}40`}`,
                  color: slot.equipped ? ACCENT : STATUS_NEUTRAL,
                }}
              >
                {slot.name.slice(0, 2)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono font-medium text-text truncate">{slot.name}</div>
                <div className="text-2xs text-text-muted">{slot.slot}</div>
              </div>
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: slot.equipped ? ACCENT : STATUS_NEUTRAL }}
              />
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {EQUIPMENT_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function InventoryEquipmentPanel({ featureMap, defs }: InventoryEquipmentPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Equipment" icon={<Shield className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <EquipmentMicro />}
          {density === 'compact' && <EquipmentCompact />}
          {density === 'full' && <EquipmentFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
