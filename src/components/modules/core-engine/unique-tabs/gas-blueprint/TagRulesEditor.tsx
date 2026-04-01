'use client';

import { useCallback, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_ORANGE,
} from '@/lib/chart-colors';
import { useCollectionEditor } from '@/hooks/useCollectionEditor';
import type { TagRule, EditorEffect, GASLoadoutSlot } from '@/lib/gas-codegen';
import type { TagValidation } from './types';

/** Check if a tag matches any known tag (supports wildcard .* suffix) */
function tagMatchesKnown(tag: string, knownTags: Set<string>): boolean {
  if (!tag || tag.endsWith('.')) return false;
  if (knownTags.has(tag)) return true;
  if (tag.endsWith('.*')) {
    const prefix = tag.slice(0, -1);
    for (const known of knownTags) {
      if (known.startsWith(prefix)) return true;
    }
  }
  for (const known of knownTags) {
    if (known.endsWith('.*')) {
      const prefix = known.slice(0, -1);
      if (tag.startsWith(prefix)) return true;
    }
  }
  return false;
}

/** Check if two tag patterns can overlap (for contradiction detection) */
function tagsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.endsWith('.*') && b.startsWith(a.slice(0, -1))) return true;
  if (b.endsWith('.*') && a.startsWith(b.slice(0, -1))) return true;
  return false;
}

export function TagRulesEditor({
  rules, onChange, effects, loadout,
}: {
  rules: TagRule[];
  onChange: (rules: TagRule[]) => void;
  effects: EditorEffect[];
  loadout: GASLoadoutSlot[];
}) {
  const ruleFactory = useCallback((): TagRule => ({
    id: `tr-${Date.now()}`,
    sourceTag: 'State.',
    targetTag: 'Ability.',
    type: 'blocks',
  }), []);

  const { add: addRule, remove: removeRule, update: updateRule } = useCollectionEditor(rules, onChange, ruleFactory);

  const ruleColors: Record<TagRule['type'], string> = {
    blocks: STATUS_ERROR,
    cancels: ACCENT_ORANGE,
    requires: STATUS_SUCCESS,
  };

  // Build known tags set from effects grantedTags and loadout cooldownTags only
  const knownTags = useMemo(() => {
    const tags = new Set<string>();
    for (const eff of effects) {
      for (const t of eff.grantedTags) if (t) tags.add(t);
    }
    for (const slot of loadout) {
      if (slot.cooldownTag) tags.add(slot.cooldownTag);
    }
    return tags;
  }, [effects, loadout]);

  // Validate each rule
  const validations = useMemo((): Map<string, TagValidation> => {
    const map = new Map<string, TagValidation>();
    for (const rule of rules) {
      const srcUnmatched = rule.sourceTag.length > 0 && !rule.sourceTag.endsWith('.') && !tagMatchesKnown(rule.sourceTag, knownTags);
      const tgtUnmatched = rule.targetTag.length > 0 && !rule.targetTag.endsWith('.') && !tagMatchesKnown(rule.targetTag, knownTags);

      let conflict: string | null = null;
      if (rule.type === 'blocks' || rule.type === 'requires') {
        const oppositeType = rule.type === 'blocks' ? 'requires' : 'blocks';
        const contradicting = rules.find(other =>
          other.id !== rule.id &&
          other.type === oppositeType &&
          tagsOverlap(other.sourceTag, rule.sourceTag) &&
          tagsOverlap(other.targetTag, rule.targetTag)
        );
        if (contradicting) {
          conflict = `Conflicts with "${contradicting.sourceTag} ${contradicting.type} ${contradicting.targetTag}"`;
        }
      }

      map.set(rule.id, { srcUnmatched, tgtUnmatched, conflict });
    }
    return map;
  }, [rules, knownTags]);

  return (
    <div className="space-y-2">
      {/* Rule visualization */}
      <div className="relative overflow-x-auto custom-scrollbar">
        <svg width="100%" height={Math.max(80, rules.length * 24 + 20)} viewBox={`0 0 380 ${Math.max(80, rules.length * 24 + 20)}`} preserveAspectRatio="xMinYMin" className="overflow-visible">
          {rules.map((rule, i) => {
            const y = 10 + i * 24;
            const color = ruleColors[rule.type];
            const v = validations.get(rule.id);
            return (
              <g key={rule.id}>
                {/* Source tag */}
                <rect x={4} y={y} width={110} height={18} rx={3} fill={`${color}15`} stroke={v?.srcUnmatched ? `${STATUS_WARNING}80` : `${color}40`} strokeWidth={v?.srcUnmatched ? 1.2 : 0.8} />
                <text x={59} y={y + 12} fill={color} fontSize={8} fontFamily="monospace" textAnchor="middle">{rule.sourceTag}</text>
                {v?.srcUnmatched && (
                  <circle cx={4} cy={y} r={3.5} fill={STATUS_WARNING}>
                    <title>Unmatched: no effect or loadout uses this tag</title>
                  </circle>
                )}
                {/* Arrow */}
                <line x1={118} y1={y + 9} x2={168} y2={y + 9} stroke={color} strokeWidth={1.5}
                  strokeDasharray={rule.type === 'cancels' ? '4 2' : undefined} />
                <text x={143} y={y + 6} fill={color} fontSize={7} fontFamily="monospace" textAnchor="middle" fontWeight="bold">{rule.type}</text>
                {/* Target tag */}
                <rect x={172} y={y} width={110} height={18} rx={3} fill="rgba(255,255,255,0.03)" stroke={v?.tgtUnmatched ? `${STATUS_WARNING}80` : 'rgba(255,255,255,0.1)'} strokeWidth={v?.tgtUnmatched ? 1.2 : 0.8} />
                <text x={227} y={y + 12} fill="rgba(255,255,255,0.6)" fontSize={8} fontFamily="monospace" textAnchor="middle">{rule.targetTag}</text>
                {v?.tgtUnmatched && (
                  <circle cx={282} cy={y} r={3.5} fill={STATUS_WARNING}>
                    <title>Unmatched: no effect or loadout uses this tag</title>
                  </circle>
                )}
                {/* Conflict badge */}
                {v?.conflict && (
                  <g>
                    <rect x={290} y={y + 2} width={80} height={14} rx={3} fill={`${STATUS_ERROR}20`} stroke={`${STATUS_ERROR}60`} strokeWidth={0.8} />
                    <text x={330} y={y + 12} fill={STATUS_ERROR} fontSize={6.5} fontFamily="monospace" textAnchor="middle" fontWeight="bold">CONFLICT</text>
                    <title>{v.conflict}</title>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Editable rule list */}
      <div className="space-y-1">
        {rules.map((rule) => {
          const color = ruleColors[rule.type];
          const v = validations.get(rule.id);
          return (
            <div key={rule.id} className="flex items-center gap-1.5 text-2xs font-mono">
              <div className="relative">
                <input
                  value={rule.sourceTag}
                  onChange={(e) => updateRule(rule.id, { sourceTag: e.target.value })}
                  className="bg-surface-deep border rounded px-1.5 py-0.5 text-text w-32 focus:outline-none"
                  style={{ borderColor: v?.srcUnmatched ? `${STATUS_WARNING}80` : undefined }}
                />
                {v?.srcUnmatched && (
                  <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_WARNING }}
                    title="Unmatched: no effect or loadout uses this tag"
                  />
                )}
              </div>
              <select
                value={rule.type}
                onChange={(e) => updateRule(rule.id, { type: e.target.value as TagRule['type'] })}
                className="bg-surface-deep border border-border/30 rounded px-1 py-0.5 focus:outline-none"
                style={{ color }}
              >
                <option value="blocks">blocks</option>
                <option value="cancels">cancels</option>
                <option value="requires">requires</option>
              </select>
              <div className="relative">
                <input
                  value={rule.targetTag}
                  onChange={(e) => updateRule(rule.id, { targetTag: e.target.value })}
                  className="bg-surface-deep border rounded px-1.5 py-0.5 text-text w-32 focus:outline-none"
                  style={{ borderColor: v?.tgtUnmatched ? `${STATUS_WARNING}80` : undefined }}
                />
                {v?.tgtUnmatched && (
                  <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_WARNING }}
                    title="Unmatched: no effect or loadout uses this tag"
                  />
                )}
              </div>
              {v?.conflict && (
                <span
                  className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-bold"
                  style={{ backgroundColor: `${STATUS_ERROR}20`, color: STATUS_ERROR, border: `1px solid ${STATUS_ERROR}40` }}
                  title={v.conflict}
                >
                  CONFLICT
                </span>
              )}
              <button onClick={() => removeRule(rule.id)} className="text-text-muted hover:text-red-400 flex-shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      <button onClick={addRule} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-medium" style={{ backgroundColor: `${STATUS_ERROR}15`, color: STATUS_ERROR, border: `1px solid ${STATUS_ERROR}30` }}>
        <Plus className="w-3 h-3" /> Add Rule
      </button>
    </div>
  );
}
