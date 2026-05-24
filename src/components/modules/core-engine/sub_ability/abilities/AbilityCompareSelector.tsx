'use client';

import {
  ACCENT_PURPLE_BOLD,
  withOpacity, OPACITY_5, OPACITY_8, OPACITY_15,
} from '@/lib/chart-colors';
import { ScalableSelector } from '@/components/shared/ScalableSelector';
import {
  ELEMENT_COLORS,
  type SpellbookAbility, type AbilityElement,
} from '../_shared/data';

interface Props {
  abilities: SpellbookAbility[];
  selectedIds: string[];
  open: boolean;
  onClose: () => void;
  onSelect: (items: SpellbookAbility[]) => void;
}

export function AbilityCompareSelector({ abilities, selectedIds, open, onClose, onSelect }: Props) {
  return (
    <ScalableSelector<SpellbookAbility>
      items={abilities}
      groupBy="category"
      searchKey="name"
      selected={selectedIds}
      onSelect={onSelect}
      mode="multi"
      open={open}
      onClose={onClose}
      title={`Compare Abilities (${abilities.length} available)`}
      placeholder="Search abilities..."
      accent={ACCENT_PURPLE_BOLD}
      renderItem={(item, selected) => (
        <div
          className={`p-2 rounded-lg border text-left transition-colors ${selected ? 'ring-1' : ''}`}
          style={{
            borderColor: withOpacity(item.color, OPACITY_15),
            backgroundColor: selected ? withOpacity(item.color, OPACITY_8) : withOpacity(item.color, OPACITY_5),
            ...(selected ? { outline: `1px solid ${item.color}` } : {}),
          }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-sm font-mono font-bold text-text">{item.name}</span>
            <span className="text-2xs font-mono ml-auto px-1 py-0.5 rounded border border-border/40 text-text-muted">{item.tier}</span>
          </div>
          <div className="text-2xs text-text-muted mt-0.5 truncate">{item.description}</div>
          <div className="flex gap-2 mt-1 text-2xs font-mono text-text-muted">
            {item.damage > 0 && <span>DMG {item.damage}</span>}
            {item.cooldown > 0 && <span>CD {item.cooldown}s</span>}
            {item.manaCost > 0 && <span>MP {item.manaCost}</span>}
            <span className="ml-auto" style={{ color: ELEMENT_COLORS[item.element as AbilityElement] }}>{item.element}</span>
          </div>
        </div>
      )}
    />
  );
}
