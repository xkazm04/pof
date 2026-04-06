'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { Search, Plus, Sparkles, X } from 'lucide-react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { motion, AnimatePresence } from 'framer-motion';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow } from '@/types/feature-matrix';
import { BlueprintPanel } from '../../_design';
import { TradingCard } from './TradingCard';
import { ItemComparisonPanel } from './ItemComparisonPanel';
import { ItemDetailDrawer } from './ItemDetailDrawer';
import { EquipmentLoadoutSection, SetBonusSection } from './GearSections';
import { AffixSlotPanels } from './AffixSlotPanels';
import { CatalogPagination } from './CatalogPagination';
import { ACCENT, RARITY_COLORS, DUMMY_ITEMS, ALL_ITEM_TYPES, RARITY_ORDER, type ItemData } from '../data';

import { withOpacity, OPACITY_12, OPACITY_30, OPACITY_25 } from '@/lib/chart-colors';
/* ── Main CatalogGearTab ───────────────────────────────────────────────── */

interface CatalogGearTabProps {
  moduleId: SubModuleId;
  featureMap: Map<string, FeatureRow>;
}

export function CatalogGearTab({ moduleId, featureMap }: CatalogGearTabProps) {
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');
  const [rarityFilter, setRarityFilter] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [subtypeFilter, setSubtypeFilter] = useState<string | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'rarity' | 'type' | 'power'>('name');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', type: 'Weapon' as ItemData['type'], rarity: 'Common', description: '' });
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);

  const { execute: executeCli, isRunning: isCliRunning } = useModuleCLI({ moduleId, sessionKey: 'item-gen', label: 'Item Generator', accentColor: ACCENT });

  const items = DUMMY_ITEMS;
  const availableSubtypes = useMemo(() => {
    const pool = categoryFilter !== 'all' ? items.filter(i => i.type === categoryFilter) : items;
    return [...new Set(pool.map(i => i.subtype))].sort();
  }, [items, categoryFilter]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (categoryFilter !== 'all') result = result.filter(i => i.type === categoryFilter);
    if (rarityFilter !== 'all') result = result.filter(i => i.rarity === rarityFilter);
    if (subtypeFilter !== 'all') result = result.filter(i => i.subtype === subtypeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'type') return a.type.localeCompare(b.type);
      if (sortBy === 'rarity') return (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0);
      if (sortBy === 'power') {
        const pa = a.stats.reduce((s, st) => s + (st.numericValue ?? 0), 0);
        const pb = b.stats.reduce((s, st) => s + (st.numericValue ?? 0), 0);
        return pb - pa;
      }
      return 0;
    });
  }, [items, categoryFilter, rarityFilter, subtypeFilter, searchQuery, sortBy]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const pageItems = filteredItems.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const [prevFilterKey, setPrevFilterKey] = useState(() => [currentPage, categoryFilter, rarityFilter, subtypeFilter, searchQuery, sortBy].join('|'));
  const filterKey = [currentPage, categoryFilter, rarityFilter, subtypeFilter, searchQuery, sortBy].join('|');
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setFocusedIndex(0);
  }

  const getColumnCount = useCallback(() => {
    if (!gridRef.current) return 1;
    return window.getComputedStyle(gridRef.current).gridTemplateColumns.split(' ').filter(Boolean).length;
  }, []);

  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    const count = pageItems.length;
    if (count === 0) return;
    let next = focusedIndex;
    const cols = getColumnCount();
    switch (e.key) {
      case 'ArrowRight': next = Math.min(count - 1, focusedIndex + 1); break;
      case 'ArrowLeft': next = Math.max(0, focusedIndex - 1); break;
      case 'ArrowDown': next = Math.min(count - 1, focusedIndex + cols); break;
      case 'ArrowUp': next = Math.max(0, focusedIndex - cols); break;
      case 'Home': next = 0; break;
      case 'End': next = count - 1; break;
      default: return;
    }
    e.preventDefault();
    if (next !== focusedIndex) { setFocusedIndex(next); cardRefs.current[next]?.focus(); }
  }, [focusedIndex, pageItems.length, getColumnCount]);

  const handleCreateItem = useCallback(() => {
    if (!newItem.name.trim()) return;
    const slug = newItem.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const imagePrompt = `Game item icon, ${newItem.rarity} ${newItem.type}, ${newItem.name}, ${newItem.description}, dark fantasy ARPG style, centered on black background, high detail`.slice(0, 1500);
    const prompt = `Create a new item for the ARPG loot system:\nName: ${newItem.name}\nType: ${newItem.type}\nRarity: ${newItem.rarity}\nDescription: ${newItem.description}\n\nSteps:\n1. Call POST /api/leonardo with prompt: "${imagePrompt}"\n2. The API will return { imageUrl, generationId }\n3. Download the image from imageUrl and save to public/items/${slug}.webp\n4. Confirm the item was created with its image path\n\nItem slug: ${slug}`;
    executeCli({ type: 'checklist', moduleId, prompt, label: `Create item: ${newItem.name}` });
    setShowAddForm(false);
    setNewItem({ name: '', type: 'Weapon', rarity: 'Common', description: '' });
  }, [newItem, moduleId, executeCli]);

  return (
    <motion.div key="catalog-gear" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      <div className="flex flex-col gap-4">
        {/* Filters bar */}
        <BlueprintPanel color={ACCENT} className="p-3 sticky top-4 z-20 shadow-md space-y-3">
          <div className="flex flex-wrap items-center gap-3" role="toolbar" aria-label="Item filters">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="text" placeholder="Search items..." value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(0); }}
                className="w-full text-sm font-mono pl-9 pr-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-blue-500/50" />
            </div>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setSubtypeFilter('all'); setCurrentPage(0); }}
              className="text-sm font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text cursor-pointer">
              <option value="all">All Types</option>
              {ALL_ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={subtypeFilter} onChange={e => { setSubtypeFilter(e.target.value); setCurrentPage(0); }}
              className="text-sm font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text cursor-pointer">
              <option value="all">All Slots</option>
              {availableSubtypes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={rarityFilter} onChange={e => { setRarityFilter(e.target.value); setCurrentPage(0); }}
              className="text-sm font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text cursor-pointer">
              <option value="all">All Rarities</option>
              {['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="text-sm font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text cursor-pointer">
              <option value="name">Sort: Name</option>
              <option value="power">Sort: Power</option>
              <option value="rarity">Sort: Tier</option>
              <option value="type">Sort: Type</option>
            </select>
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{filteredItems.length} items</span>
            <button onClick={() => setShowAddForm(v => !v)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ backgroundColor: showAddForm ? `${withOpacity(ACCENT, OPACITY_12)}` : 'var(--surface)', color: showAddForm ? ACCENT : 'var(--text-muted)', border: `1px solid ${showAddForm ? withOpacity(ACCENT, OPACITY_30) : 'var(--border)'}` }}>
              {showAddForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {showAddForm ? 'Cancel' : 'Add Item'}
            </button>
          </div>
        </BlueprintPanel>

        {/* Add Item Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <BlueprintPanel color={ACCENT} className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <input type="text" placeholder="Item Name" value={newItem.name}
                    onChange={e => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                    className="col-span-1 text-sm px-3 py-2 rounded-lg bg-surface-deep border border-border/50 text-text placeholder:text-text-muted focus:outline-none focus:border-text-muted/50" />
                  <select value={newItem.type} onChange={e => setNewItem(prev => ({ ...prev, type: e.target.value as ItemData['type'] }))}
                    className="text-sm px-3 py-2 rounded-lg bg-surface-deep border border-border/50 text-text focus:outline-none">
                    {ALL_ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={newItem.rarity} onChange={e => setNewItem(prev => ({ ...prev, rarity: e.target.value }))}
                    className="text-sm px-3 py-2 rounded-lg bg-surface-deep border border-border/50 text-text focus:outline-none">
                    {Object.keys(RARITY_COLORS).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <textarea placeholder="Brief description..." value={newItem.description}
                  onChange={e => setNewItem(prev => ({ ...prev, description: e.target.value }))} rows={2}
                  className="w-full text-sm px-3 py-2 rounded-lg bg-surface-deep border border-border/50 text-text placeholder:text-text-muted focus:outline-none resize-none" />
                <button onClick={handleCreateItem} disabled={!newItem.name.trim() || isCliRunning}
                  className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_12)}`, color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_25)}` }}>
                  <Sparkles className="w-3.5 h-3.5" />{isCliRunning ? 'Creating...' : 'Create with AI Image'}
                </button>
              </BlueprintPanel>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Item Grid */}
        <div className="relative min-h-[300px]">
          <motion.div ref={gridRef} layout role="grid" aria-label="Item catalog" onKeyDown={handleGridKeyDown}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {pageItems.map((item, index) => (
                <div key={item.id} onClick={() => setSelectedItem(prev => prev?.id === item.id ? null : item)} className="cursor-pointer">
                  <TradingCard ref={(el: HTMLDivElement | null) => { cardRefs.current[index] = el; }}
                    item={item} tabIndex={index === focusedIndex ? 0 : -1} onFocus={() => setFocusedIndex(index)} />
                </div>
              ))}
            </AnimatePresence>
          </motion.div>
          {filteredItems.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted opacity-50">
              <Search className="w-12 h-12 mb-2.5" /><p className="text-sm">No items found matching the current filters.</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <CatalogPagination currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} />

        {/* Item Detail Drawer */}
        <ItemDetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AffixSlotPanels featureMap={featureMap} />
        <EquipmentLoadoutSection />
      </div>

      <SetBonusSection />
      <ItemComparisonPanel items={DUMMY_ITEMS} />
    </motion.div>
  );
}
