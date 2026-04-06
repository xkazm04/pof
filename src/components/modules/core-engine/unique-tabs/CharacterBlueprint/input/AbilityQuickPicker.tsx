'use client';
import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { ACCENT_EMERALD, OPACITY_8, OPACITY_15, withOpacity } from '@/lib/chart-colors';
import { COMBO_ABILITIES } from '../../AbilitySpellbook/data';

interface AbilityQuickPickerProps {
  onSelect?: (abilityId: string) => void;
  selectedIds?: Set<string>;
}

export function AbilityQuickPicker({ onSelect, selectedIds }: AbilityQuickPickerProps) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => search ? COMBO_ABILITIES.filter(a => a.name.toLowerCase().includes(search.toLowerCase())) : COMBO_ABILITIES,
    [search]
  );

  return (
    <div className="rounded-lg border border-border/30 bg-surface-deep/50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Search className="w-3.5 h-3.5 text-text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search abilities..."
          className="flex-1 bg-transparent text-sm text-text placeholder-text-muted/50 outline-none"
        />
        <span className="text-[10px] text-text-muted">{filtered.length}/{COMBO_ABILITIES.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
        {filtered.map(a => (
          <button
            key={a.id}
            onClick={() => onSelect?.(a.id)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
              selectedIds?.has(a.id)
                ? 'border-border/30'
                : 'border-border/30 bg-surface/30 text-text-muted hover:text-text hover:bg-surface/60'
            }`}
            style={selectedIds?.has(a.id) ? {
              borderColor: withOpacity(ACCENT_EMERALD, OPACITY_15),
              backgroundColor: withOpacity(ACCENT_EMERALD, OPACITY_8),
              color: ACCENT_EMERALD,
              borderLeftColor: a.color, borderLeftWidth: 2,
            } : { borderLeftColor: a.color, borderLeftWidth: 2 }}
          >
            {a.name}
          </button>
        ))}
      </div>
    </div>
  );
}
