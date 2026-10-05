'use client';

import { useCallback, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_ORANGE, OVERLAY_WHITE,
  withOpacity, OPACITY_10, OPACITY_50, OPACITY_25, OPACITY_12, OPACITY_37, OPACITY_20,
  OPACITY_3, OPACITY_60,
} from '@/lib/chart-colors';
import { useCollectionEditor } from '@/hooks/useCollectionEditor';
import type { TagRule, EditorEffect, GASLoadoutSlot } from '@/lib/gas-codegen';
import { RULE_VERB, ruleSentence, validateRules } from '@/lib/ability/tag-rules';

const UNMATCHED_TITLE = 'Unmatched: no effect or loadout grants this gating tag';

/**
 * Edits the bound ability's own activation rules, in the canonical ability-owned
 * direction (@/lib/ability/tag-rules): every row is "<ability> blocked by /
 * requires / cancels <gating tag>". Only the gating tag is editable and only it
 * is judged Unmatched — the ability tag is the rule's owner, not a tag an effect
 * is expected to grant.
 */
export function TagRulesEditor({
  abilityTag, rules, onChange, effects, loadout,
}: {
  abilityTag: string;
  rules: TagRule[];
  onChange: (rules: TagRule[]) => void;
  effects: EditorEffect[];
  loadout: GASLoadoutSlot[];
}) {
  const ruleFactory = useCallback((): TagRule => ({
    id: `tr-${Date.now()}`, sourceTag: abilityTag, targetTag: 'State.', type: 'blocks',
  }), [abilityTag]);

  const { add: addRule, remove: removeRule, update: updateRule } = useCollectionEditor(rules, onChange, ruleFactory);

  const ruleColors: Record<TagRule['type'], string> = { blocks: STATUS_ERROR, cancels: ACCENT_ORANGE, requires: STATUS_SUCCESS };

  const validations = useMemo(() => validateRules(rules, effects, loadout), [rules, effects, loadout]);

  return (
    <div className="space-y-2">
      <div className="relative overflow-x-auto custom-scrollbar">
        <svg width="100%" height={Math.max(80, rules.length * 24 + 20)} viewBox={`0 0 380 ${Math.max(80, rules.length * 24 + 20)}`} preserveAspectRatio="xMinYMin" className="overflow-visible">
          {rules.map((rule, i) => {
            const y = 10 + i * 24;
            const color = ruleColors[rule.type];
            const v = validations.get(rule.id);
            return (
              <g key={rule.id}>
                <rect x={4} y={y} width={110} height={18} rx={3} fill={`${withOpacity(color, OPACITY_10)}`} stroke={`${withOpacity(color, OPACITY_25)}`} strokeWidth={0.8} />
                <text x={59} y={y + 12} fill={color} fontSize={8} fontFamily="monospace" textAnchor="middle">{abilityTag}</text>
                <line x1={118} y1={y + 9} x2={138} y2={y + 9} stroke={color} strokeWidth={1.5} strokeDasharray={rule.type === 'cancels' ? '4 2' : undefined} />
                <rect x={142} y={y} width={146} height={18} rx={3} fill={withOpacity(OVERLAY_WHITE, OPACITY_3)} stroke={v?.gateUnmatched ? `${withOpacity(STATUS_WARNING, OPACITY_50)}` : withOpacity(OVERLAY_WHITE, OPACITY_10)} strokeWidth={v?.gateUnmatched ? 1.2 : 0.8} />
                <text x={215} y={y + 12} fill={withOpacity(OVERLAY_WHITE, OPACITY_60)} fontSize={8} fontFamily="monospace" textAnchor="middle">{ruleSentence(rule)}</text>
                {v?.gateUnmatched && <circle cx={288} cy={y} r={3.5} fill={STATUS_WARNING}><title>{UNMATCHED_TITLE}</title></circle>}
                {v?.conflict && (<g><rect x={292} y={y + 2} width={80} height={14} rx={3} fill={`${withOpacity(STATUS_ERROR, OPACITY_12)}`} stroke={`${withOpacity(STATUS_ERROR, OPACITY_37)}`} strokeWidth={0.8} /><text x={332} y={y + 12} fill={STATUS_ERROR} fontSize={6.5} fontFamily="monospace" textAnchor="middle" fontWeight="bold">CONFLICT</text><title>{v.conflict}</title></g>)}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="space-y-1">
        {rules.map((rule) => {
          const color = ruleColors[rule.type];
          const v = validations.get(rule.id);
          return (
            <div key={rule.id} className="flex items-center gap-1.5 text-2xs font-mono">
              <span className="w-32 truncate text-text-muted" title={abilityTag}>{abilityTag}</span>
              <select value={rule.type} onChange={(e) => updateRule(rule.id, { type: e.target.value as TagRule['type'] })} className="bg-surface-deep border border-border/30 rounded px-1 py-0.5 focus:outline-none" style={{ color }}>
                {(Object.keys(RULE_VERB) as TagRule['type'][]).map((t) => <option key={t} value={t}>{RULE_VERB[t]}</option>)}
              </select>
              <div className="relative">
                <input value={rule.targetTag} aria-label="Gating tag" onChange={(e) => updateRule(rule.id, { targetTag: e.target.value })} className="bg-surface-deep border rounded px-1.5 py-0.5 text-text w-32 focus:outline-none" style={{ borderColor: v?.gateUnmatched ? `${withOpacity(STATUS_WARNING, OPACITY_50)}` : undefined }} />
                {v?.gateUnmatched && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_WARNING }} title={UNMATCHED_TITLE} />}
              </div>
              {v?.conflict && <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: `${withOpacity(STATUS_ERROR, OPACITY_12)}`, color: STATUS_ERROR, border: `1px solid ${withOpacity(STATUS_ERROR, OPACITY_25)}` }} title={v.conflict}>CONFLICT</span>}
              <button onClick={() => removeRule(rule.id)} aria-label="Remove rule" className="text-text-muted hover:text-red-400 flex-shrink-0"><Trash2 className="w-3 h-3" /></button>
            </div>
          );
        })}
      </div>
      <button onClick={addRule} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono uppercase tracking-[0.15em] font-medium" style={{ backgroundColor: `${withOpacity(STATUS_ERROR, OPACITY_10)}`, color: STATUS_ERROR, border: `1px solid ${withOpacity(STATUS_ERROR, OPACITY_20)}` }}><Plus className="w-3 h-3" /> Add Rule</button>
    </div>
  );
}
