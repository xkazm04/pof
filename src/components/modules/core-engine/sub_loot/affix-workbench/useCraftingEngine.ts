'use client';

import { useState, useCallback, useMemo } from 'react';
import type { CraftedAffix, ItemBase } from './data';
import type { CurrencyId, CraftingActionId } from './types';
import {
  applyCraft, canAfford as walletCanAfford, defaultWallet, deriveLocks, zeroWallet,
} from './craftingKernel';
import type { CraftState } from './craftingKernel';

type Ledger = Omit<CraftState, 'affixes'>;

/** How long a craft button flashes after it fires (unchanged from the pre-kernel engine). */
const CRAFT_FLASH_MS = 400;

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

  const canAfford = useCallback(
    (action: { costs: Partial<Record<CurrencyId, number>> }): boolean => walletCanAfford(ledger.wallet, action.costs),
    [ledger.wallet],
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
    setTimeout(() => setCraftFlash(null), CRAFT_FLASH_MS);
  }, [craftedAffixes, ledger, selectedBase.rarity, setCraftedAffixes]);

  const resetWallet = useCallback(() => setLedger(freshLedger()), []);

  return {
    wallet: ledger.wallet, prefixLocked, suffixLocked, craftLog: ledger.log, showCraftPanel,
    craftFlash, totalSpent: ledger.totalSpent, craftCount: ledger.craftCount,
    setShowCraftPanel,
    canAfford, executeCraft, resetWallet,
  };
}
