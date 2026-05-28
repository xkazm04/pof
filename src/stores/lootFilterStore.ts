'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { LootFilterRule, LootFilterRuleset } from '@/lib/loot-filter/types';
import { createDefaultRuleset, emptyRule } from '@/lib/loot-filter/defaults';

interface LootFilterState {
  rulesetsById: Record<string, LootFilterRuleset>;
  order: string[];
  activeRulesetId: string;

  createRuleset: (name?: string) => string;
  deleteRuleset: (id: string) => void;
  renameRuleset: (id: string, name: string) => void;
  setActiveRuleset: (id: string) => void;

  addRule: (rulesetId: string, seed?: Partial<LootFilterRule>) => string;
  updateRule: (rulesetId: string, ruleId: string, patch: Partial<LootFilterRule>) => void;
  removeRule: (rulesetId: string, ruleId: string) => void;
  moveRule: (rulesetId: string, ruleId: string, dir: -1 | 1) => void;
  duplicateRule: (rulesetId: string, ruleId: string) => void;
}

let _seq = 0;
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(_seq++).toString(36)}`;
const now = () => new Date().toISOString();

function createInitial() {
  const def = createDefaultRuleset();
  return { rulesetsById: { [def.id]: def }, order: [def.id], activeRulesetId: def.id };
}

/** Immutably replace a ruleset's rules (and bump updatedAt) via a transform; no-op preserves refs. */
function withRules(
  s: LootFilterState,
  rulesetId: string,
  fn: (rules: LootFilterRule[]) => LootFilterRule[],
): Partial<LootFilterState> | LootFilterState {
  const rs = s.rulesetsById[rulesetId];
  if (!rs) return s;
  const rules = fn(rs.rules);
  if (rules === rs.rules) return s;
  return { rulesetsById: { ...s.rulesetsById, [rulesetId]: { ...rs, rules, updatedAt: now() } } };
}

export const useLootFilterStore = create<LootFilterState>()(
  persist(
    (set) => ({
      ...createInitial(),

      createRuleset: (name) => {
        const id = uid('rs');
        const rs: LootFilterRuleset = { id, name: name?.trim() || 'New Filter', updatedAt: now(), rules: [] };
        set((s) => ({ rulesetsById: { ...s.rulesetsById, [id]: rs }, order: [...s.order, id], activeRulesetId: id }));
        return id;
      },

      deleteRuleset: (id) =>
        set((s) => {
          if (!s.rulesetsById[id]) return s;
          const rest = { ...s.rulesetsById };
          delete rest[id];
          let order = s.order.filter((x) => x !== id);
          let active = s.activeRulesetId;
          if (order.length === 0) {
            const def = createDefaultRuleset(uid('rs'));
            rest[def.id] = def;
            order = [def.id];
            active = def.id;
          } else if (active === id) {
            active = order[0];
          }
          return { rulesetsById: rest, order, activeRulesetId: active };
        }),

      renameRuleset: (id, name) =>
        set((s) => {
          const rs = s.rulesetsById[id];
          if (!rs) return s;
          return { rulesetsById: { ...s.rulesetsById, [id]: { ...rs, name: name.trim() || rs.name, updatedAt: now() } } };
        }),

      setActiveRuleset: (id) => set((s) => (s.rulesetsById[id] ? { activeRulesetId: id } : s)),

      addRule: (rulesetId, seed) => {
        const id = uid('rule');
        set((s) => withRules(s, rulesetId, (rules) => [...rules, { ...emptyRule(id), ...seed, id }]));
        return id;
      },

      updateRule: (rulesetId, ruleId, patch) =>
        set((s) =>
          withRules(s, rulesetId, (rules) => {
            const i = rules.findIndex((r) => r.id === ruleId);
            if (i < 0) return rules;
            const next = rules.slice();
            next[i] = { ...next[i], ...patch, id: ruleId };
            return next;
          }),
        ),

      removeRule: (rulesetId, ruleId) =>
        set((s) =>
          withRules(s, rulesetId, (rules) => {
            const next = rules.filter((r) => r.id !== ruleId);
            return next.length === rules.length ? rules : next;
          }),
        ),

      moveRule: (rulesetId, ruleId, dir) =>
        set((s) =>
          withRules(s, rulesetId, (rules) => {
            const i = rules.findIndex((r) => r.id === ruleId);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= rules.length) return rules;
            const next = rules.slice();
            [next[i], next[j]] = [next[j], next[i]];
            return next;
          }),
        ),

      duplicateRule: (rulesetId, ruleId) => {
        const id = uid('rule');
        set((s) =>
          withRules(s, rulesetId, (rules) => {
            const i = rules.findIndex((r) => r.id === ruleId);
            if (i < 0) return rules;
            const orig = rules[i];
            const copy: LootFilterRule = {
              ...orig, id, name: `${orig.name} (copy)`,
              condition: { ...orig.condition }, style: { ...orig.style },
            };
            const next = rules.slice();
            next.splice(i + 1, 0, copy);
            return next;
          }),
        );
      },
    }),
    {
      name: 'pof-loot-filter',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ rulesetsById: s.rulesetsById, order: s.order, activeRulesetId: s.activeRulesetId }),
      merge: (persisted, current) => {
        const p = persisted as Partial<LootFilterState> | undefined;
        const byId = p?.rulesetsById;
        if (!byId || Object.keys(byId).length === 0) return current;
        const order = p?.order?.length ? p.order : Object.keys(byId);
        const active = p?.activeRulesetId && byId[p.activeRulesetId] ? p.activeRulesetId : order[0];
        return { ...current, rulesetsById: byId, order, activeRulesetId: active };
      },
    },
  ),
);

/** The currently-selected ruleset (always defined — the store keeps ≥1). */
export function useActiveRuleset(): LootFilterRuleset {
  return useLootFilterStore((s) => s.rulesetsById[s.activeRulesetId] ?? s.rulesetsById[s.order[0]]);
}

/** Rulesets in display order. */
export function useRulesetList(): LootFilterRuleset[] {
  return useLootFilterStore(useShallow((s) => s.order.map((id) => s.rulesetsById[id]).filter(Boolean)));
}
