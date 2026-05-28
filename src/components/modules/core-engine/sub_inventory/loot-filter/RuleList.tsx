'use client';

import { useState } from 'react';
import { Plus, ChevronUp, ChevronDown, Copy, Trash2, Eye, EyeOff, ChevronRight } from 'lucide-react';
import { useLootFilterStore } from '@/stores/lootFilterStore';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_MUTED, STATUS_ERROR, withOpacity, OPACITY_15, OPACITY_25,
} from '@/lib/chart-colors';
import type { FilterAction, LootFilterRule } from '@/lib/loot-filter/types';
import { RuleEditor } from './RuleEditor';

const ACTION_COLOR: Record<FilterAction, string> = {
  show: STATUS_SUCCESS, highlight: STATUS_WARNING, hide: STATUS_MUTED,
};
const ACTIONS: FilterAction[] = ['show', 'highlight', 'hide'];

function summarize(rule: LootFilterRule): string {
  const c = rule.condition;
  const parts = [c.rarities, c.types, c.subtypes, c.affixAxes].flatMap((a) => a ?? []);
  return parts.length ? parts.join(' · ') : 'any item';
}

/** Ordered, editable list of rules — add / reorder / enable / duplicate / delete + inline editor. */
export function RuleList({ rulesetId, rules, accent }: { rulesetId: string; rules: LootFilterRule[]; accent: string }) {
  const { addRule, updateRule, removeRule, moveRule, duplicateRule } = useLootFilterStore.getState();
  const [expanded, setExpanded] = useState<string | null>(null);

  const onAdd = () => { const id = addRule(rulesetId); setExpanded(id); };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-text-muted">{rules.length} rule{rules.length === 1 ? '' : 's'} · first match wins</span>
        <button type="button" onClick={onAdd}
          className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-md cursor-pointer transition-colors"
          style={{ backgroundColor: withOpacity(accent, OPACITY_15), color: accent }}>
          <Plus className="w-3.5 h-3.5" /> Add rule
        </button>
      </div>

      {rules.length === 0 && (
        <p className="text-xs font-mono text-text-muted/70 py-4 text-center">No rules yet — every drop shows by default.</p>
      )}

      {rules.map((rule, i) => {
        const color = ACTION_COLOR[rule.action];
        const open = expanded === rule.id;
        return (
          <div key={rule.id} className="rounded-lg border border-border/40 bg-surface-deep/60 overflow-hidden"
            style={{ borderLeft: `3px solid ${rule.enabled ? color : withOpacity(color, OPACITY_25)}` }}>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <button type="button" data-testid="lf-rule-toggle" title={rule.enabled ? 'Enabled' : 'Disabled'}
                onClick={() => updateRule(rulesetId, rule.id, { enabled: !rule.enabled })}
                className="text-text-muted hover:text-text cursor-pointer">
                {rule.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 opacity-50" />}
              </button>
              <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded capitalize"
                style={{ color, backgroundColor: withOpacity(color, OPACITY_15) }}>{rule.action}</span>
              <button type="button" onClick={() => setExpanded(open ? null : rule.id)}
                className="flex-1 flex items-center gap-1 text-left min-w-0 cursor-pointer">
                <ChevronRight className={`w-3.5 h-3.5 text-text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
                <span className="text-sm font-medium text-text truncate">{rule.name}</span>
                <span className="text-[10px] font-mono text-text-muted/60 truncate hidden md:inline">— {summarize(rule)}</span>
              </button>
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => moveRule(rulesetId, rule.id, -1)} disabled={i === 0} title="Move up"
                  className="p-0.5 text-text-muted hover:text-text disabled:opacity-30 cursor-pointer disabled:cursor-default"><ChevronUp className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => moveRule(rulesetId, rule.id, 1)} disabled={i === rules.length - 1} title="Move down"
                  className="p-0.5 text-text-muted hover:text-text disabled:opacity-30 cursor-pointer disabled:cursor-default"><ChevronDown className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => duplicateRule(rulesetId, rule.id)} title="Duplicate"
                  className="p-0.5 text-text-muted hover:text-text cursor-pointer"><Copy className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => removeRule(rulesetId, rule.id)} title="Delete"
                  className="p-0.5 cursor-pointer opacity-70 hover:opacity-100" style={{ color: STATUS_ERROR }}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            {open && (
              <div className="px-3 pb-3">
                <input value={rule.name} onChange={(e) => updateRule(rulesetId, rule.id, { name: e.target.value })}
                  className="w-full text-sm px-2 py-1 mb-2 rounded-md bg-surface-deep border border-border/40 text-text" placeholder="Rule name" />
                <div className="flex gap-1 mb-1">
                  {ACTIONS.map((a) => (
                    <button key={a} type="button" onClick={() => updateRule(rulesetId, rule.id, { action: a })}
                      className="text-xs font-mono px-2 py-0.5 rounded-md border cursor-pointer capitalize text-text-muted"
                      style={rule.action === a
                        ? { color: ACTION_COLOR[a], backgroundColor: withOpacity(ACTION_COLOR[a], OPACITY_15), borderColor: withOpacity(ACTION_COLOR[a], OPACITY_25) }
                        : { borderColor: 'transparent' }}>{a}</button>
                  ))}
                </div>
                <RuleEditor rulesetId={rulesetId} rule={rule} accent={accent} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
