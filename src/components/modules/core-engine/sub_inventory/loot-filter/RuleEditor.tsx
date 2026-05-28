'use client';

import { useMemo } from 'react';
import { useLootFilterStore } from '@/stores/lootFilterStore';
import { DUMMY_ITEMS } from '../_shared/data';
import { RARITY_COLORS, AFFIX_CATEGORY_COLORS, withOpacity, OPACITY_25 } from '@/lib/chart-colors';
import { RARITIES, ITEM_TYPES, AFFIX_AXES, FILTER_SOUNDS, STYLE_COLOR_PRESETS } from '@/lib/loot-filter/defaults';
import type { AffixAxis, LootFilterRule } from '@/lib/loot-filter/types';
import { Field, ChipGroup, ChipToggle } from './controls';

const SELECT_CLS = 'text-xs font-mono px-2 py-1 rounded-md bg-surface-deep border border-border/40 text-text cursor-pointer';

function toggleIn<T extends string>(arr: readonly T[] | undefined, v: T): T[] {
  const set = new Set<T>(arr ?? []);
  if (set.has(v)) set.delete(v); else set.add(v);
  return [...set];
}

/** Edits one rule's match condition and (for Show/Highlight) its visual styling. */
export function RuleEditor({ rulesetId, rule, accent }: { rulesetId: string; rule: LootFilterRule; accent: string }) {
  const updateRule = useLootFilterStore((s) => s.updateRule);
  const subtypes = useMemo(() => [...new Set(DUMMY_ITEMS.map((i) => i.subtype))].sort(), []);
  const cond = rule.condition;
  const patchCond = (p: Partial<typeof cond>) => updateRule(rulesetId, rule.id, { condition: { ...cond, ...p } });
  const patchStyle = (p: Partial<typeof rule.style>) => updateRule(rulesetId, rule.id, { style: { ...rule.style, ...p } });

  return (
    <div className="space-y-3 pt-1">
      <Field label="Rarity">
        <ChipGroup options={RARITIES} selected={cond.rarities ?? []} color={accent}
          colorFor={(r) => RARITY_COLORS[r] ?? accent}
          onToggle={(v) => patchCond({ rarities: toggleIn(cond.rarities, v) })} />
      </Field>
      <Field label="Item Type">
        <ChipGroup options={ITEM_TYPES} selected={cond.types ?? []} color={accent}
          onToggle={(v) => patchCond({ types: toggleIn(cond.types, v) })} />
      </Field>
      <Field label="Subtype">
        <ChipGroup options={subtypes} selected={cond.subtypes ?? []} color={accent}
          onToggle={(v) => patchCond({ subtypes: toggleIn(cond.subtypes, v) })} />
      </Field>
      <Field label="Affix Axis">
        <ChipGroup options={AFFIX_AXES} selected={cond.affixAxes ?? []} color={accent}
          colorFor={(a) => AFFIX_CATEGORY_COLORS[a]}
          onToggle={(v) => patchCond({ affixAxes: toggleIn<AffixAxis>(cond.affixAxes, v) })} />
      </Field>

      {rule.action !== 'hide' && (
        <div className="flex flex-wrap items-end gap-4 pt-2 border-t border-border/30">
          <Field label="Beam / Text Color">
            <div className="flex items-center gap-1.5">
              {STYLE_COLOR_PRESETS.map((c) => (
                <button key={c} type="button" onClick={() => patchStyle({ color: c })}
                  className="w-5 h-5 rounded-full border-2 cursor-pointer transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: rule.style.color === c ? c : 'transparent', boxShadow: rule.style.color === c ? `0 0 0 2px ${withOpacity(c, OPACITY_25)}` : 'none' }}
                  title={c} />
              ))}
              <button type="button" onClick={() => patchStyle({ color: undefined })}
                className="text-[10px] font-mono text-text-muted hover:text-text px-1 cursor-pointer">clear</button>
            </div>
          </Field>
          <Field label="Alert Sound">
            <select className={SELECT_CLS} value={rule.style.sound ?? 'None'}
              onChange={(e) => patchStyle({ sound: e.target.value === 'None' ? undefined : e.target.value })}>
              {FILTER_SOUNDS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <ChipToggle label="Loot Beam" active={!!rule.style.beam} color={accent}
            onClick={() => patchStyle({ beam: !rule.style.beam })} />
        </div>
      )}
    </div>
  );
}
