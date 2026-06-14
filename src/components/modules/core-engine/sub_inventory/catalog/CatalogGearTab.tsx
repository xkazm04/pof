'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { motion, AnimatePresence } from 'framer-motion';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow } from '@/types/feature-matrix';
import { ItemComparisonPanel } from './ItemComparisonPanel';
import { ItemDetailDrawer } from './ItemDetailDrawer';
import { EquipmentLoadoutSection, SetBonusSection } from './GearSections';
import { AffixSlotPanels } from './AffixSlotPanels';
import { CatalogPagination } from './CatalogPagination';
import { ACCENT, DUMMY_ITEMS, RARITY_ORDER, type ItemData } from '../_shared/data';
import { useItemEntries } from '@/stores/catalogStore';
import { useGeneration } from '@/hooks/useGeneration';
import type { GenerationStep } from '@/lib/catalog/recipe';
import type { ItemEntry, StoredCatalogEntity } from '@/lib/catalog/types';
import { CatalogFiltersBar, type SortBy } from './CatalogFiltersBar';
import { AddItemForm, type NewItemState } from './AddItemForm';
import { CatalogItemGrid } from './CatalogItemGrid';

/* ── Main CatalogGearTab ───────────────────────────────────────────────── */

// Hook-stable placeholder fed to `useGeneration` when the catalog store is empty
// (no backing entry to generate). The (Re)generate affordance is gated on a real
// `primaryEntry`, so this entity is never actually dispatched.
const EMPTY_ITEM_ENTRY: StoredCatalogEntity = {
  id: '',
  catalogId: 'items',
  name: '',
  categoryPath: [],
  tags: [],
  lifecycle: 'planned',
};

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
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<NewItemState>({ name: '', type: 'Weapon' as ItemData['type'], rarity: 'Common', description: '' });
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);

  const { execute: executeCli, isRunning: isCliRunning } = useModuleCLI({ moduleId, sessionKey: 'item-gen', label: 'Item Generator', accentColor: ACCENT });

  // folder-09 R3: source lifecycle/ueAssets from the catalog store; the static
  // DUMMY_ITEMS array still drives the rich UI (the seed converter wraps it 1:1).
  const entries = useItemEntries();
  const entryByItemId = useMemo(
    () => new Map(entries.map((e) => [e.data.id, e])),
    [entries],
  );

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

  // folder-09 R3: dispatch generation for the primary (selected or first visible) item.
  // `entries` is legitimately empty before the catalog is seeded / after a store
  // reset, so `primaryEntry` must be nullable — never assert it non-null here.
  const primaryItem = selectedItem ?? pageItems[0];
  const primaryEntry: ItemEntry | undefined =
    (primaryItem && entryByItemId.get(primaryItem.id)) ?? entries[0] ?? undefined;
  // useGeneration is a hook and must be called unconditionally; when there is no
  // backing entry we hand it a placeholder and gate the actual (Re)generate
  // affordance below so nothing is ever dispatched for a non-existent entity.
  const gen = useGeneration(primaryEntry ?? EMPTY_ITEM_ENTRY);
  const nextStep: GenerationStep =
    primaryEntry?.lifecycle === 'generated' ? 'wire'
      : primaryEntry?.lifecycle === 'wired' ? 'verify'
        : 'author-python';

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
        <CatalogFiltersBar
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
          subtypeFilter={subtypeFilter} setSubtypeFilter={setSubtypeFilter}
          rarityFilter={rarityFilter} setRarityFilter={setRarityFilter}
          sortBy={sortBy} setSortBy={setSortBy}
          availableSubtypes={availableSubtypes}
          filteredCount={filteredItems.length}
          showAddForm={showAddForm} setShowAddForm={setShowAddForm}
          resetPage={() => setCurrentPage(0)}
        />

        {/* Add Item Form */}
        <AnimatePresence>
          {showAddForm && (
            <AddItemForm
              newItem={newItem}
              setNewItem={setNewItem}
              isCliRunning={isCliRunning}
              onCreate={handleCreateItem}
            />
          )}
        </AnimatePresence>

        {/* Item Grid */}
        <CatalogItemGrid
          gridRef={gridRef}
          cardRefs={cardRefs}
          pageItems={pageItems}
          filteredCount={filteredItems.length}
          focusedIndex={focusedIndex}
          setFocusedIndex={setFocusedIndex}
          setSelectedItem={setSelectedItem}
          entryByItemId={entryByItemId}
          primaryEntry={primaryEntry}
          isGenRunning={gen.isRunning}
          onRegenerate={primaryEntry ? () => gen.generate(nextStep) : undefined}
          onGridKeyDown={handleGridKeyDown}
        />

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
