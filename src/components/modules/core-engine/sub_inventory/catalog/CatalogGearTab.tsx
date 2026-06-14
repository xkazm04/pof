'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useViewportAtLeast } from '@/hooks/useViewportWidth';
import { motion, AnimatePresence } from 'framer-motion';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow } from '@/types/feature-matrix';
import { ItemComparisonPanel } from './ItemComparisonPanel';
import { ItemDetailDrawer } from './ItemDetailDrawer';
import { EquipmentLoadoutSection, SetBonusSection } from './GearSections';
import { AffixSlotPanels } from './AffixSlotPanels';
import { CatalogPagination } from './CatalogPagination';
import { ACCENT, DUMMY_ITEMS, RARITY_ORDER, type ItemData } from '../_shared/data';
import { useCatalogStore, useItemEntries } from '@/stores/catalogStore';
import { itemToEntry } from '@/lib/catalog/seed-items';
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

  // zen-perf R3: the catalog store is the SINGLE source of truth. It is seeded
  // 1:1 from DUMMY_ITEMS at first run (seedAllCatalogs → seedItemEntries) and the
  // persist `merge` re-seeds the `items` catalog if a persisted blob is missing it,
  // so every hand-authored item (plus any generated/added entries) lives here.
  // Each ItemEntry carries `data: ItemData` (the rich UI payload) + lifecycle/ueAssets;
  // filtering/sorting/paging operate directly on entries — no runtime id-join Map.
  const entries = useItemEntries();
  const addEntity = useCatalogStore((s) => s.addEntity);

  const availableSubtypes = useMemo(() => {
    const pool = categoryFilter !== 'all' ? entries.filter(e => e.data.type === categoryFilter) : entries;
    return [...new Set(pool.map(e => e.data.subtype))].sort();
  }, [entries, categoryFilter]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (categoryFilter !== 'all') result = result.filter(e => e.data.type === categoryFilter);
    if (rarityFilter !== 'all') result = result.filter(e => e.data.rarity === rarityFilter);
    if (subtypeFilter !== 'all') result = result.filter(e => e.data.subtype === subtypeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => e.data.name.toLowerCase().includes(q) || e.data.description.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      const ad = a.data, bd = b.data;
      if (sortBy === 'name') return ad.name.localeCompare(bd.name);
      if (sortBy === 'type') return ad.type.localeCompare(bd.type);
      if (sortBy === 'rarity') return (RARITY_ORDER[bd.rarity] ?? 0) - (RARITY_ORDER[ad.rarity] ?? 0);
      if (sortBy === 'power') {
        const pa = ad.stats.reduce((s, st) => s + (st.numericValue ?? 0), 0);
        const pb = bd.stats.reduce((s, st) => s + (st.numericValue ?? 0), 0);
        return pb - pa;
      }
      return 0;
    });
  }, [entries, categoryFilter, rarityFilter, subtypeFilter, searchQuery, sortBy]);

  const totalPages = Math.ceil(filteredEntries.length / ITEMS_PER_PAGE);
  const pageEntries = filteredEntries.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  // zen-perf R3: dispatch generation for the primary (selected or first visible) entry.
  // `entries` is legitimately empty before the catalog is seeded / after a store
  // reset, so `primaryEntry` must be nullable — never assert it non-null here.
  const primaryEntry: ItemEntry | undefined =
    (selectedItem && entries.find(e => e.data.id === selectedItem.id)) ?? pageEntries[0] ?? entries[0] ?? undefined;
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

  // zen-perf wave21: column count is derived from the grid's responsive Tailwind
  // breakpoints (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4`) rather than read via
  // `window.getComputedStyle(gridRef.current).gridTemplateColumns` inside the
  // keydown handler. That computed-style read forced a synchronous style/layout
  // flush on every ArrowUp/ArrowDown. `useViewportAtLeast` is a ResizeObserver-
  // backed boolean that only re-renders when its threshold flips, so `columnCount`
  // is updated once per breakpoint crossing and read O(1) (no DOM access / reflow)
  // in the handler. Tailwind v4 defaults apply (md=768px, xl=1280px; no custom
  // `--breakpoint-*`), so this maps 1:1 to the rendered columns at every width.
  const isXl = useViewportAtLeast(1280);
  const isMd = useViewportAtLeast(768);
  const columnCount = isXl ? 4 : isMd ? 2 : 1;

  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    const count = pageEntries.length;
    if (count === 0) return;
    let next = focusedIndex;
    const cols = columnCount;
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
  }, [focusedIndex, pageEntries.length, columnCount]);

  const handleCreateItem = useCallback(() => {
    if (!newItem.name.trim()) return;
    const slug = newItem.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // zen-perf R3: the new item enters the rendered grid immediately because the
    // store is now the single source of truth — build an ItemData, wrap it via the
    // same seed converter, and add it to the catalog store. The CLI image-gen below
    // then fills in its artwork at public/items/<slug>.webp.
    const newData: ItemData = {
      id: `user-${slug}-${Date.now().toString(36)}`,
      name: newItem.name.trim(),
      type: newItem.type,
      subtype: newItem.type,
      rarity: newItem.rarity,
      stats: [],
      description: newItem.description,
      imagePath: `/items/${slug}.webp`,
    };
    addEntity('items', itemToEntry(newData));
    // Surface the freshly-added item: clear filters/search and jump to the first page.
    setCategoryFilter('all');
    setRarityFilter('all');
    setSubtypeFilter('all');
    setSearchQuery('');
    setCurrentPage(0);

    const imagePrompt = `Game item icon, ${newItem.rarity} ${newItem.type}, ${newItem.name}, ${newItem.description}, dark fantasy ARPG style, centered on black background, high detail`.slice(0, 1500);
    const prompt = `Create a new item for the ARPG loot system:\nName: ${newItem.name}\nType: ${newItem.type}\nRarity: ${newItem.rarity}\nDescription: ${newItem.description}\n\nSteps:\n1. Call POST /api/leonardo with prompt: "${imagePrompt}"\n2. The API will return { imageUrl, generationId }\n3. Download the image from imageUrl and save to public/items/${slug}.webp\n4. Confirm the item was created with its image path\n\nItem slug: ${slug}`;
    executeCli({ type: 'checklist', moduleId, prompt, label: `Create item: ${newItem.name}` });
    setShowAddForm(false);
    setNewItem({ name: '', type: 'Weapon', rarity: 'Common', description: '' });
  }, [newItem, moduleId, executeCli, addEntity]);

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
          filteredCount={filteredEntries.length}
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
          pageEntries={pageEntries}
          filteredCount={filteredEntries.length}
          focusedIndex={focusedIndex}
          setFocusedIndex={setFocusedIndex}
          setSelectedItem={setSelectedItem}
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
