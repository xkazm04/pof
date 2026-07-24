'use client';

import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { BlueprintPanel } from '../../unique-tabs/_design';
import { ACCENT, RARITY_COLORS, ALL_ITEM_TYPES, type ItemData } from '../_shared/data';
import { withOpacity, OPACITY_12, OPACITY_25 } from '@/lib/chart-colors';
import { focusRingStyle } from '@/lib/ui/focus-ring';

export interface NewItemState {
  name: string;
  type: ItemData['type'];
  rarity: string;
  description: string;
}

interface Props {
  newItem: NewItemState;
  setNewItem: React.Dispatch<React.SetStateAction<NewItemState>>;
  isCliRunning: boolean;
  onCreate: () => void;
}

export function AddItemForm({ newItem, setNewItem, isCliRunning, onCreate }: Props) {
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden" style={focusRingStyle(ACCENT)}>
      <BlueprintPanel color={ACCENT} className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="text" placeholder="Item Name" aria-label="Item name" value={newItem.name}
            onChange={e => setNewItem(prev => ({ ...prev, name: e.target.value }))}
            className="col-span-1 text-sm px-3 py-2 rounded-lg bg-surface-deep border border-border/50 text-text placeholder:text-text-muted focus-ring-inset" />
          <select value={newItem.type} aria-label="Item type" onChange={e => setNewItem(prev => ({ ...prev, type: e.target.value as ItemData['type'] }))}
            className="text-sm px-3 py-2 rounded-lg bg-surface-deep border border-border/50 text-text focus-ring-inset">
            {ALL_ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={newItem.rarity} aria-label="Item rarity" onChange={e => setNewItem(prev => ({ ...prev, rarity: e.target.value }))}
            className="text-sm px-3 py-2 rounded-lg bg-surface-deep border border-border/50 text-text focus-ring-inset">
            {Object.keys(RARITY_COLORS).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <textarea placeholder="Brief description..." aria-label="Item description" value={newItem.description}
          onChange={e => setNewItem(prev => ({ ...prev, description: e.target.value }))} rows={2}
          className="w-full text-sm px-3 py-2 rounded-lg bg-surface-deep border border-border/50 text-text placeholder:text-text-muted focus-ring-inset resize-none" />
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={onCreate} disabled={!newItem.name.trim() || isCliRunning}
            aria-describedby="add-item-hint" aria-busy={isCliRunning}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_12)}`, color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_25)}` }}>
            <Sparkles className="w-3.5 h-3.5" />{isCliRunning ? 'Creating…' : 'Create with AI Image'}
          </button>
          {/* Says why the button is disabled instead of leaving a dead control unexplained. */}
          <p id="add-item-hint" className="text-xs text-text-muted">
            {isCliRunning
              ? 'Generating the item icon — this can take a moment.'
              : !newItem.name.trim()
                ? 'Enter an item name to enable creation.'
                : 'Adds the item to the catalog and generates its icon.'}
          </p>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
