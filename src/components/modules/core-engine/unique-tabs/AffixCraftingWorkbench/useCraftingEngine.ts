'use client';

import { useState, useCallback } from 'react';
import {
  AFFIX_POOL, RARITIES, RARITY_AFFIX_COUNTS,
} from './data';
import type { CraftedAffix, ItemBase } from './data';
import type { CurrencyId, CraftingActionId, CraftLogEntry } from './types';
import { CURRENCIES, CRAFTING_ACTIONS } from './constants';

/* ── Wallet Helpers ─────────────────────────────────────────────────── */

function defaultWallet(): Record<CurrencyId, number> {
  return Object.fromEntries(CURRENCIES.map(c => [c.id, c.defaultBalance])) as Record<CurrencyId, number>;
}

function zeroWallet(): Record<CurrencyId, number> {
  return Object.fromEntries(CURRENCIES.map(c => [c.id, 0])) as Record<CurrencyId, number>;
}

/* ── Crafting Engine Hook ───────────────────────────────────────────── */

export function useCraftingEngine(
  selectedBase: ItemBase,
  craftedAffixes: CraftedAffix[],
  setCraftedAffixes: React.Dispatch<React.SetStateAction<CraftedAffix[]>>,
) {
  const [wallet, setWallet] = useState<Record<CurrencyId, number>>(defaultWallet);
  const [prefixLocked, setPrefixLocked] = useState(false);
  const [suffixLocked, setSuffixLocked] = useState(false);
  const [craftLog, setCraftLog] = useState<CraftLogEntry[]>([]);
  const [showCraftPanel, setShowCraftPanel] = useState(true);
  const [craftFlash, setCraftFlash] = useState<string | null>(null);
  const [totalSpent, setTotalSpent] = useState<Record<CurrencyId, number>>(zeroWallet);
  const [craftCount, setCraftCount] = useState(0);

  const canAfford = useCallback((action: { costs: Partial<Record<CurrencyId, number>> }): boolean => {
    for (const [cid, amount] of Object.entries(action.costs)) {
      if ((wallet[cid as CurrencyId] ?? 0) < (amount ?? 0)) return false;
    }
    return true;
  }, [wallet]);

  const spendCurrency = useCallback((costs: Partial<Record<CurrencyId, number>>) => {
    setWallet(prev => {
      const next = { ...prev };
      for (const [cid, amount] of Object.entries(costs)) next[cid as CurrencyId] = Math.max(0, (next[cid as CurrencyId] ?? 0) - (amount ?? 0));
      return next;
    });
    setTotalSpent(prev => {
      const next = { ...prev };
      for (const [cid, amount] of Object.entries(costs)) next[cid as CurrencyId] = (next[cid as CurrencyId] ?? 0) + (amount ?? 0);
      return next;
    });
  }, []);

  const rollRandomAffix = useCallback((exclude: Set<string>): CraftedAffix | null => {
    const rarityIdx = RARITIES.indexOf(selectedBase.rarity);
    const eligible = AFFIX_POOL.filter(a => RARITIES.indexOf(a.minRarity) <= rarityIdx && !exclude.has(a.tag));
    if (eligible.length === 0) return null;
    const tw = eligible.reduce((s, a) => s + a.weight, 0);
    let roll = Math.random() * tw;
    let pick = eligible[0];
    for (const a of eligible) { roll -= a.weight; if (roll <= 0) { pick = a; break; } }
    const mag = pick.minValue + Math.random() * (pick.maxValue - pick.minValue);
    return {
      poolEntryId: pick.id, tag: pick.tag, displayName: pick.displayName,
      bIsPrefix: pick.bIsPrefix, magnitude: Math.round(mag * 10) / 10,
      stat: pick.stat, category: pick.category,
    };
  }, [selectedBase.rarity]);

  const logCraft = useCallback((action: CraftingActionId, costs: Partial<Record<CurrencyId, number>>, success: boolean, detail: string) => {
    setCraftLog(prev => [{ action, timestamp: Date.now(), spent: costs, success, detail }, ...prev].slice(0, 50));
    setCraftCount(c => c + 1);
  }, []);

  const flashAction = useCallback((id: string) => {
    setCraftFlash(id);
    setTimeout(() => setCraftFlash(null), 400);
  }, []);

  const executeCraft = useCallback((actionId: CraftingActionId) => {
    const action = CRAFTING_ACTIONS.find(a => a.id === actionId);
    if (!action || !canAfford(action)) return;
    const unlockedAffixes = craftedAffixes.filter(a => !a.locked);
    if (action.requiresAffixes && unlockedAffixes.length === 0 && actionId !== 'lock_prefix' && actionId !== 'lock_suffix') return;
    const currentMax = RARITY_AFFIX_COUNTS[selectedBase.rarity].max;
    spendCurrency(action.costs);
    flashAction(actionId);
    const succeeded = Math.random() <= action.successChance;
    if (!succeeded) { logCraft(actionId, action.costs, false, `${action.name} failed (${(action.successChance * 100).toFixed(0)}% chance)`); return; }

    switch (actionId) {
      case 'reforge': {
        const locked = craftedAffixes.filter(a => a.locked);
        const usedTags = new Set(locked.map(a => a.tag));
        const slotsToFill = Math.max(0, Math.min(currentMax - locked.length, RARITY_AFFIX_COUNTS[selectedBase.rarity].min + Math.floor(Math.random() * (currentMax - RARITY_AFFIX_COUNTS[selectedBase.rarity].min + 1)) - locked.length));
        const newAffixes = [...locked];
        for (let i = 0; i < slotsToFill; i++) { const r = rollRandomAffix(usedTags); if (r) { newAffixes.push(r); usedTags.add(r.tag); } }
        setCraftedAffixes(newAffixes);
        if (prefixLocked) setPrefixLocked(false);
        if (suffixLocked) setSuffixLocked(false);
        setCraftedAffixes(prev => prev.map(a => ({ ...a, locked: false })));
        logCraft(actionId, action.costs, true, `Reforged -> ${newAffixes.length - locked.length} new affixes`);
        break;
      }
      case 'augment': {
        if (craftedAffixes.length >= currentMax) return;
        const usedTags = new Set(craftedAffixes.map(a => a.tag));
        const rolled = rollRandomAffix(usedTags);
        if (rolled) { setCraftedAffixes(prev => [...prev, rolled]); logCraft(actionId, action.costs, true, `Augmented: +${rolled.displayName}`); }
        break;
      }
      case 'remove_add': {
        if (unlockedAffixes.length === 0) return;
        const removeIdx = Math.floor(Math.random() * unlockedAffixes.length);
        const removed = unlockedAffixes[removeIdx];
        const afterRemove = craftedAffixes.filter(a => a.tag !== removed.tag);
        const usedTags = new Set(afterRemove.map(a => a.tag));
        const rolled = rollRandomAffix(usedTags);
        setCraftedAffixes(rolled ? [...afterRemove, rolled] : afterRemove);
        logCraft(actionId, action.costs, true, `Removed ${removed.displayName}${rolled ? `, added ${rolled.displayName}` : ''}`);
        break;
      }
      case 'divine_roll': {
        setCraftedAffixes(prev => prev.map(a => {
          const pool = AFFIX_POOL.find(p => p.id === a.poolEntryId);
          if (!pool) return a;
          return { ...a, magnitude: Math.round((pool.minValue + Math.random() * (pool.maxValue - pool.minValue)) * 10) / 10 };
        }));
        logCraft(actionId, action.costs, true, 'Re-rolled all magnitudes');
        break;
      }
      case 'lock_prefix': {
        setPrefixLocked(true);
        setCraftedAffixes(prev => prev.map(a => a.bIsPrefix ? { ...a, locked: true } : a));
        logCraft(actionId, action.costs, true, 'Prefixes locked');
        break;
      }
      case 'lock_suffix': {
        setSuffixLocked(true);
        setCraftedAffixes(prev => prev.map(a => !a.bIsPrefix ? { ...a, locked: true } : a));
        logCraft(actionId, action.costs, true, 'Suffixes locked');
        break;
      }
      case 'unlock': {
        setPrefixLocked(false); setSuffixLocked(false);
        setCraftedAffixes(prev => prev.map(a => ({ ...a, locked: false })));
        logCraft(actionId, {}, true, 'All locks removed');
        break;
      }
    }
  }, [canAfford, craftedAffixes, selectedBase.rarity, spendCurrency, rollRandomAffix, logCraft, flashAction, prefixLocked, suffixLocked, setCraftedAffixes]);

  const resetWallet = useCallback(() => {
    setWallet(defaultWallet()); setTotalSpent(zeroWallet()); setCraftLog([]); setCraftCount(0);
  }, []);

  const resetLocks = useCallback(() => {
    setPrefixLocked(false); setSuffixLocked(false);
  }, []);

  return {
    wallet, prefixLocked, suffixLocked, craftLog, showCraftPanel,
    craftFlash, totalSpent, craftCount,
    setShowCraftPanel,
    canAfford, executeCraft, resetWallet, resetLocks,
  };
}
