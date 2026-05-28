'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useLootFilterStore, useRulesetList } from '@/stores/lootFilterStore';
import { withOpacity, OPACITY_15, OPACITY_25 } from '@/lib/chart-colors';
import type { LootFilterRuleset } from '@/lib/loot-filter/types';

/** Switch between rulesets, rename the active one, and create / delete rulesets. */
export function RulesetToolbar({ active, accent }: { active: LootFilterRuleset; accent: string }) {
  const list = useRulesetList();
  const { createRuleset, deleteRuleset, renameRuleset, setActiveRuleset } = useLootFilterStore.getState();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {list.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {list.map((rs) => {
            const isActive = rs.id === active.id;
            return (
              <button key={rs.id} type="button" onClick={() => setActiveRuleset(rs.id)}
                className={`text-xs font-mono px-2 py-1 rounded-md border cursor-pointer transition-colors ${isActive ? '' : 'text-text-muted border-border/50 hover:text-text'}`}
                style={isActive ? { color: accent, backgroundColor: withOpacity(accent, OPACITY_15), borderColor: withOpacity(accent, OPACITY_25) } : undefined}>
                {rs.name}
              </button>
            );
          })}
        </div>
      )}

      <input
        value={active.name}
        onChange={(e) => renameRuleset(active.id, e.target.value)}
        aria-label="Ruleset name"
        className="text-sm font-semibold px-2.5 py-1.5 rounded-lg bg-surface-deep border border-border/40 text-text focus:outline-none min-w-[180px]"
        style={{ borderColor: withOpacity(accent, OPACITY_25) }}
      />

      <button type="button" onClick={() => createRuleset()} title="New ruleset"
        className="flex items-center gap-1 text-xs font-mono px-2 py-1.5 rounded-md cursor-pointer"
        style={{ backgroundColor: withOpacity(accent, OPACITY_15), color: accent }}>
        <Plus className="w-3.5 h-3.5" /> New
      </button>
      <button type="button" onClick={() => deleteRuleset(active.id)} title="Delete this ruleset"
        className="flex items-center gap-1 text-xs font-mono px-2 py-1.5 rounded-md text-text-muted border border-border/40 hover:text-text cursor-pointer">
        <Trash2 className="w-3.5 h-3.5" /> Delete
      </button>
    </div>
  );
}
