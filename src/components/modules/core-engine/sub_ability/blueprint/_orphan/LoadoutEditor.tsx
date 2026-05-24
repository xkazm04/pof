'use client';

import { useCallback, useState, useMemo } from 'react';
import { Plus, Trash2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCollectionEditor } from '@/hooks/useCollectionEditor';
import type { GASLoadoutSlot } from '@/lib/gas-codegen';
import { ACCENT_RED, ACCENT_EMERALD_DARK, MODULE_COLORS, STATUS_STALE, OVERLAY_WHITE,
  withOpacity, OPACITY_8, OPACITY_10, OPACITY_12, OPACITY_20, OPACITY_25, OPACITY_30, OPACITY_37,
} from '@/lib/chart-colors';

const SLOT_COLORS = [ACCENT_RED, ACCENT_EMERALD_DARK, MODULE_COLORS.core, STATUS_STALE, MODULE_COLORS.content];

export function LoadoutEditor({
  loadout, onChange,
}: {
  loadout: GASLoadoutSlot[];
  onChange: (slots: GASLoadoutSlot[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const slotFactory = useCallback((): GASLoadoutSlot => ({
    id: `ls-${Date.now()}`,
    slot: loadout.length + 1,
    abilityName: 'NewAbility',
    iconColor: SLOT_COLORS[loadout.length % SLOT_COLORS.length],
    cooldownTag: '',
  }), [loadout.length]);

  const { add: addSlot, remove: removeSlot, update: updateSlot } = useCollectionEditor(loadout, onChange, slotFactory);

  const nextSlotColor = useMemo(
    () => SLOT_COLORS[loadout.length % SLOT_COLORS.length],
    [loadout.length],
  );

  const handleRemove = useCallback((id: string) => {
    if (selectedId === id) setSelectedId(null);
    removeSlot(id);
  }, [selectedId, removeSlot]);

  return (
    <div className="space-y-2">
      {/* Visual hotbar */}
      <div className="flex items-center gap-2 justify-center py-3">
        <AnimatePresence mode="popLayout">
          {loadout.map((slot) => {
            const isSelected = selectedId === slot.id;
            return (
              <motion.button
                key={slot.id}
                layout
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  borderColor: isSelected ? slot.iconColor : `${withOpacity(slot.iconColor, OPACITY_37)}`,
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                whileHover={{
                  scale: 1.08,
                  boxShadow: `0 0 12px 2px ${withOpacity(slot.iconColor, OPACITY_25)}`,
                }}
                whileTap={{ scale: 0.95 }}
                className="relative w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 group cursor-pointer"
                style={{
                  backgroundColor: `${withOpacity(slot.iconColor, OPACITY_8)}`,
                  ...(isSelected ? {
                    animation: 'loadout-pulse 1.5s ease-in-out infinite',
                    boxShadow: `0 0 8px 1px ${withOpacity(slot.iconColor, OPACITY_30)}`,
                  } : {}),
                }}
                onClick={() => setSelectedId(isSelected ? null : slot.id)}
              >
                <Zap className="w-5 h-5" style={{ color: slot.iconColor }} />
                <span className="text-xs font-mono font-bold truncate w-full text-center px-0.5" style={{ color: slot.iconColor }}>
                  {slot.abilityName}
                </span>
                <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center bg-surface border border-border/60 text-text-muted">
                  {slot.slot}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
        <motion.button
          onClick={addSlot}
          className="w-14 h-14 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors"
          style={{ borderColor: `var(--border-40, ${withOpacity(OVERLAY_WHITE, OPACITY_10)})` }}
          whileHover={{
            borderColor: nextSlotColor,
            boxShadow: `0 0 10px 1px ${withOpacity(nextSlotColor, OPACITY_20)}`,
            scale: 1.05,
          }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <Plus className="w-5 h-5 text-text-muted" />
        </motion.button>
      </div>

      {/* Editable slot list */}
      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {loadout.map((slot) => (
            <motion.div
              key={slot.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10, height: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5 text-2xs font-mono"
            >
              <span className="w-5 h-5 rounded text-center leading-5 font-bold" style={{ backgroundColor: `${withOpacity(slot.iconColor, OPACITY_12)}`, color: slot.iconColor }}>
                {slot.slot}
              </span>
              <input
                value={slot.abilityName}
                onChange={(e) => updateSlot(slot.id, { abilityName: e.target.value })}
                className="bg-surface-deep border border-border/30 rounded px-1.5 py-0.5 text-text w-28 focus:outline-none"
              />
              <input
                value={slot.cooldownTag}
                onChange={(e) => updateSlot(slot.id, { cooldownTag: e.target.value })}
                placeholder="Cooldown.Tag"
                className="bg-surface-deep border border-border/30 rounded px-1.5 py-0.5 text-text-muted w-36 focus:outline-none"
              />
              <motion.button
                onClick={() => handleRemove(slot.id)}
                className="text-text-muted hover:text-red-400 flex-shrink-0"
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              >
                <Trash2 className="w-3 h-3" />
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Keyframe for selected-slot border pulse */}
      <style>{`
        @keyframes loadout-pulse {
          0%, 100% { border-opacity: 1; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
