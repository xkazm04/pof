'use client';

import { useState, useCallback, useMemo } from 'react';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { CraftedAffix, ItemBase } from './data';
import type { CraftingActionId } from './types';
import {
  applyCraft, craftRefusal, defaultWallet, deriveLocks, zeroWallet,
} from './craftingKernel';
import type { CraftState } from './craftingKernel';

type Ledger = Omit<CraftState, 'affixes'>;

const freshLedger = (): Ledger => ({ wallet: defaultWallet(), totalSpent: zeroWallet(), craftCount: 0, log: [] });

/* ── Crafting Engine Hook ───────────────────────────────────────────── */

/**
 * Thin React adapter over the pure crafting kernel (`craftingKernel.ts`): it
 * holds the ledger (wallet, spend, count, log), passes `Math.random`, and
 * writes the kernel's next affixes back. The lock badges are derived from the
 * per-affix `locked` flags, never stored.
 */
export function useCraftingEngine(
  selectedBase: ItemBase,
  craftedAffixes: CraftedAffix[],
  setCraftedAffixes: React.Dispatch<React.SetStateAction<CraftedAffix[]>>,
) {
  const [ledger, setLedger] = useState<Ledger>(freshLedger);
  const [showCraftPanel, setShowCraftPanel] = useState(true);
  const [craftFlash, setCraftFlash] = useState<string | null>(null);
  const { prefixLocked, suffixLocked } = useMemo(() => deriveLocks(craftedAffixes), [craftedAffixes]);

  const refusalFor = useCallback(
    (actionId: CraftingActionId) => craftRefusal({ affixes: craftedAffixes, wallet: ledger.wallet }, actionId, selectedBase.rarity),
    [craftedAffixes, ledger.wallet, selectedBase.rarity],
  );

  const executeCraft = useCallback((actionId: CraftingActionId) => {
    const out = applyCraft({ affixes: craftedAffixes, ...ledger }, actionId, {
      rarity: selectedBase.rarity, rng: Math.random, now: Date.now,
    });
    if (out.refused) return;
    const { affixes, ...next } = out.state;
    setLedger(next);
    if (affixes !== craftedAffixes) setCraftedAffixes(affixes);
    setCraftFlash(actionId);
    setTimeout(() => setCraftFlash(null), UI_TIMEOUTS.craftFlash);
  }, [craftedAffixes, ledger, selectedBase.rarity, setCraftedAffixes]);

  const resetWallet = useCallback(() => setLedger(freshLedger()), []);

  return {
    wallet: ledger.wallet, prefixLocked, suffixLocked, craftLog: ledger.log, showCraftPanel,
    craftFlash, totalSpent: ledger.totalSpent, craftCount: ledger.craftCount,
    setShowCraftPanel,
    refusalFor, executeCraft, resetWallet,
  };
}
