'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  AFFIX_POOL, RARITIES, RARITY_AFFIX_COUNTS, RARITY_BUDGET_MAX,
  ITEM_BASES, detectArchetypes, getItemLevelScaling,
  buildAffixName, computePowerBudget,
  SYNERGY_RULES,
} from './data';
import type { CraftedAffix, ItemBase, AffixPoolEntry, RarityArchetype } from './data';
import type { CurrencyId, PoolCategory, ViewMode } from './types';
import { CURRENCIES } from './constants';
import { useCraftingEngine } from './useCraftingEngine';
import { useExportActions } from './useExportActions';

/* ── Main Hook ──────────────────────────────────────────────────────── */

export function useAffixWorkbench() {
  const [selectedBase, setSelectedBase] = useState<ItemBase>(ITEM_BASES[2]);
  const [craftedAffixes, setCraftedAffixes] = useState<CraftedAffix[]>([]);
  const [itemLevel, setItemLevel] = useState(25);

  // UI state
  const [poolFilter, setPoolFilter] = useState<PoolCategory>('all');
  const [poolSearch, setPoolSearch] = useState('');
  const [dragOverItem, setDragOverItem] = useState(false);
  const [draggingAffixId, setDraggingAffixId] = useState<string | null>(null);
  const [expandedSynergies, setExpandedSynergies] = useState(true);
  const [previewTag, setPreviewTag] = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('workbench');
  const [bpCategoryFilter, setBpCategoryFilter] = useState<PoolCategory>('all');
  const [bpRarityFilter, setBpRarityFilter] = useState<'all' | typeof RARITIES[number]>('all');
  const [bpSearch, setBpSearch] = useState('');

  // Sub-hooks
  const crafting = useCraftingEngine(selectedBase, craftedAffixes, setCraftedAffixes);
  const exporting = useExportActions(selectedBase, craftedAffixes, itemLevel);

  // Derived
  const maxAffixes = RARITY_AFFIX_COUNTS[selectedBase.rarity].max;
  const canAddMore = craftedAffixes.length < maxAffixes;
  const fullItemName = useMemo(() => buildAffixName(selectedBase.name, craftedAffixes), [selectedBase.name, craftedAffixes]);
  const powerBudget = useMemo(() => computePowerBudget(craftedAffixes, itemLevel), [craftedAffixes, itemLevel]);
  const budgetMax = RARITY_BUDGET_MAX[selectedBase.rarity] || 100;
  const budgetRatio = Math.min(powerBudget.total / budgetMax, 1.5);
  const isOverBudget = budgetRatio > 1.0;

  // Filtered pool
  const filteredPool = useMemo(() => {
    let pool = AFFIX_POOL;
    const rarityIdx = RARITIES.indexOf(selectedBase.rarity);
    pool = pool.filter((a) => RARITIES.indexOf(a.minRarity) <= rarityIdx);
    if (poolFilter !== 'all') pool = pool.filter((a) => a.category === poolFilter);
    if (poolSearch) {
      const lower = poolSearch.toLowerCase();
      pool = pool.filter((a) => a.displayName.toLowerCase().includes(lower) || a.stat.toLowerCase().includes(lower) || a.tag.toLowerCase().includes(lower));
    }
    const usedTags = new Set(craftedAffixes.map((a) => a.tag));
    return pool.filter((a) => !usedTags.has(a.tag));
  }, [selectedBase.rarity, poolFilter, poolSearch, craftedAffixes]);

  const { maxWeight, totalWeight } = useMemo(() => ({
    maxWeight: filteredPool.reduce((m, a) => Math.max(m, a.weight), 0),
    totalWeight: filteredPool.reduce((s, a) => s + a.weight, 0),
  }), [filteredPool]);

  // Synergies
  const activeSynergies = useMemo(() => {
    const tags = new Set(craftedAffixes.map((a) => a.tag));
    return SYNERGY_RULES.filter((r) => tags.has(r.affixTags[0]) && tags.has(r.affixTags[1]));
  }, [craftedAffixes]);

  const [synergyGlow, setSynergyGlow] = useState(false);
  const [newSynergyLabels, setNewSynergyLabels] = useState<Set<string>>(new Set());
  const prevSynergyCountRef = useRef(0);
  useEffect(() => {
    const prev = prevSynergyCountRef.current;
    const curr = activeSynergies.length;
    if (curr > prev && prev >= 0) {
      setNewSynergyLabels(new Set(activeSynergies.map((s) => s.label)));
      setSynergyGlow(true);
      const t = setTimeout(() => setSynergyGlow(false), 600);
      if (!expandedSynergies) setExpandedSynergies(true);
      return () => clearTimeout(t);
    }
    if (curr <= prev && newSynergyLabels.size > 0) setNewSynergyLabels(new Set());
    prevSynergyCountRef.current = curr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSynergies]);

  // Radar
  const radarAxes = ['Offense', 'Defense', 'Utility'];
  const radarValues = useMemo(() => [
    Math.min(powerBudget.offense / (budgetMax * 0.6), 1),
    Math.min(powerBudget.defense / (budgetMax * 0.6), 1),
    Math.min(powerBudget.utility / (budgetMax * 0.3), 1),
  ], [powerBudget, budgetMax]);

  const ghostRadarValues = useMemo(() => {
    if (!previewTag) return null;
    const affix = craftedAffixes.find((a) => a.tag === previewTag);
    if (!affix) return null;
    const poolEntry = AFFIX_POOL.find((a) => a.id === affix.poolEntryId);
    if (!poolEntry) return null;
    const maxed = craftedAffixes.map((a) => a.tag === previewTag ? { ...a, magnitude: poolEntry.maxValue } : a);
    const mb = computePowerBudget(maxed, itemLevel);
    return [Math.min(mb.offense / (budgetMax * 0.6), 1), Math.min(mb.defense / (budgetMax * 0.6), 1), Math.min(mb.utility / (budgetMax * 0.3), 1)];
  }, [previewTag, craftedAffixes, itemLevel, budgetMax]);

  const suggestedArchetypes = useMemo(() => detectArchetypes(AFFIX_POOL, selectedBase.rarity), [selectedBase.rarity]);

  const avgCraftCost = useMemo(() => {
    if (crafting.craftCount === 0) return null;
    const avg: Partial<Record<CurrencyId, number>> = {};
    for (const c of CURRENCIES) { const s = crafting.totalSpent[c.id]; if (s > 0) avg[c.id] = Math.round((s / crafting.craftCount) * 10) / 10; }
    return avg;
  }, [crafting.totalSpent, crafting.craftCount]);

  // Item actions
  const addAffix = useCallback((p: AffixPoolEntry) => {
    if (!canAddMore || craftedAffixes.some((a) => a.tag === p.tag)) return;
    setCraftedAffixes((prev) => [...prev, { poolEntryId: p.id, tag: p.tag, displayName: p.displayName, bIsPrefix: p.bIsPrefix, magnitude: (p.minValue + p.maxValue) / 2, stat: p.stat, category: p.category }]);
  }, [canAddMore, craftedAffixes]);

  const removeAffix = useCallback((tag: string) => setCraftedAffixes((prev) => prev.filter((a) => a.tag !== tag)), []);
  const updateAffixMagnitude = useCallback((tag: string, mag: number) => setCraftedAffixes((prev) => prev.map((a) => a.tag === tag ? { ...a, magnitude: mag } : a)), []);
  const toggleAffixPlacement = useCallback((tag: string) => setCraftedAffixes((prev) => prev.map((a) => a.tag === tag ? { ...a, bIsPrefix: !a.bIsPrefix } : a)), []);

  const randomRoll = useCallback(() => {
    const ri = RARITIES.indexOf(selectedBase.rarity);
    const eligible = AFFIX_POOL.filter((a) => RARITIES.indexOf(a.minRarity) <= ri);
    const { min, max } = RARITY_AFFIX_COUNTS[selectedBase.rarity];
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    const avail = [...eligible];
    const rolled: CraftedAffix[] = [];
    for (let i = 0; i < count && avail.length > 0; i++) {
      const tw = avail.reduce((s, a) => s + a.weight, 0);
      let roll = Math.random() * tw; let pick = avail[0];
      for (const a of avail) { roll -= a.weight; if (roll <= 0) { pick = a; break; } }
      rolled.push({ poolEntryId: pick.id, tag: pick.tag, displayName: pick.displayName, bIsPrefix: pick.bIsPrefix, magnitude: Math.round((pick.minValue + Math.random() * (pick.maxValue - pick.minValue)) * 10) / 10, stat: pick.stat, category: pick.category });
      const idx = avail.indexOf(pick); if (idx >= 0) avail.splice(idx, 1);
    }
    setCraftedAffixes(rolled);
  }, [selectedBase.rarity]);

  const clearAffixes = useCallback(() => setCraftedAffixes([]), []);

  const applyArchetype = useCallback((arch: RarityArchetype) => {
    setCraftedAffixes(arch.affixTags.map(tag => { const p = AFFIX_POOL.find(a => a.tag === tag); if (!p) return null; return { poolEntryId: p.id, tag: p.tag, displayName: p.displayName, bIsPrefix: p.bIsPrefix, magnitude: Math.round(((p.minValue + p.maxValue) / 2) * 10) / 10, stat: p.stat, category: p.category }; }).filter(Boolean) as CraftedAffix[]);
  }, []);

  const selectBase = useCallback((base: ItemBase) => {
    setSelectedBase(base); setItemLevel(base.itemLevel); setCraftedAffixes([]); crafting.resetLocks();
  }, [crafting]);

  return {
    selectedBase, craftedAffixes, itemLevel, poolFilter, poolSearch,
    dragOverItem, draggingAffixId, expandedSynergies, previewTag,
    viewMode, bpCategoryFilter, bpRarityFilter, bpSearch,
    // From crafting engine
    wallet: crafting.wallet, prefixLocked: crafting.prefixLocked,
    suffixLocked: crafting.suffixLocked, craftLog: crafting.craftLog,
    showCraftPanel: crafting.showCraftPanel, craftFlash: crafting.craftFlash,
    totalSpent: crafting.totalSpent, craftCount: crafting.craftCount,
    // From export actions
    showExport: exporting.showExport, copiedExport: exporting.copiedExport,
    injectStatus: exporting.injectStatus, injectError: exporting.injectError,
    ue5Status: exporting.ue5Status,
    // Derived
    maxAffixes, canAddMore, fullItemName, powerBudget, budgetMax,
    budgetRatio, isOverBudget, filteredPool, maxWeight, totalWeight,
    activeSynergies, synergyGlow, newSynergyLabels, radarAxes,
    radarValues, ghostRadarValues, suggestedArchetypes, avgCraftCost,
    // Setters
    setPoolFilter, setPoolSearch, setShowExport: exporting.setShowExport,
    setDragOverItem, setDraggingAffixId, setExpandedSynergies, setPreviewTag,
    setShowCraftPanel: crafting.setShowCraftPanel, setViewMode,
    setBpCategoryFilter, setBpRarityFilter, setBpSearch, setItemLevel,
    // Actions
    addAffix, removeAffix, updateAffixMagnitude, toggleAffixPlacement,
    randomRoll, clearAffixes, executeCraft: crafting.executeCraft,
    resetWallet: crafting.resetWallet, applyArchetype,
    handleCopy: exporting.handleCopy, handleExportFile: exporting.handleExportFile,
    handleInjectToUE5: exporting.handleInjectToUE5, selectBase,
    canAfford: crafting.canAfford,
  };
}
