import type { AffixPoolEntry, CraftedAffix, ItemBase, Rarity, RarityArchetype, SynergyRule } from './data';
import type { SubModuleId } from '@/types/modules';

/* ── Crafting Currency ──────────────────────────────────────────────────── */

export type CurrencyId = 'chaos' | 'exalted' | 'annulment' | 'divine' | 'eternal' | 'forging';

export interface CurrencyDef {
  id: CurrencyId;
  name: string;
  icon: string;
  color: string;
  description: string;
  defaultBalance: number;
}

/* ── Crafting Actions ───────────────────────────────────────────────────── */

export type CraftingActionId = 'reforge' | 'augment' | 'remove_add' | 'divine_roll' | 'lock_prefix' | 'lock_suffix' | 'unlock';

export interface CraftingActionDef {
  id: CraftingActionId;
  name: string;
  description: string;
  costs: Partial<Record<CurrencyId, number>>;
  successChance: number;
  color: string;
  requiresAffixes: boolean;
  requiresSpace: boolean;
}

/* ── Craft Log ──────────────────────────────────────────────────────────── */

export interface CraftLogEntry {
  action: CraftingActionId;
  timestamp: number;
  spent: Partial<Record<CurrencyId, number>>;
  success: boolean;
  detail: string;
}

/* ── View Mode ──────────────────────────────────────────────────────────── */

export type ViewMode = 'workbench' | 'breakpoints';
export type PoolCategory = 'all' | 'offensive' | 'defensive' | 'utility';

/* ── Component Props ────────────────────────────────────────────────────── */

export interface AffixCraftingWorkbenchProps {
  moduleId: SubModuleId;
}

/* ── Workbench State ────────────────────────────────────────────────────── */

export interface WorkbenchState {
  selectedBase: ItemBase;
  craftedAffixes: CraftedAffix[];
  itemLevel: number;
  poolFilter: PoolCategory;
  poolSearch: string;
  showExport: boolean;
  copiedExport: boolean;
  dragOverItem: boolean;
  draggingAffixId: string | null;
  expandedSynergies: boolean;
  previewTag: string | null;
  injectStatus: 'idle' | 'sending' | 'success' | 'error';
  injectError: string | null;
  wallet: Record<CurrencyId, number>;
  prefixLocked: boolean;
  suffixLocked: boolean;
  craftLog: CraftLogEntry[];
  showCraftPanel: boolean;
  craftFlash: string | null;
  totalSpent: Record<CurrencyId, number>;
  craftCount: number;
  viewMode: ViewMode;
  bpCategoryFilter: PoolCategory;
  bpRarityFilter: Rarity | 'all';
  bpSearch: string;
}

/* ── Shared sub-component prop types ────────────────────────────────────── */

export interface HeaderProps {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  onRandomRoll: () => void;
  onClear: () => void;
  showExport: boolean;
  onToggleExport: () => void;
  onInjectToUE5: () => void;
  ue5Status: string;
  craftedAffixCount: number;
  injectStatus: 'idle' | 'sending' | 'success' | 'error';
}

export interface AffixPoolPanelProps {
  filteredPool: AffixPoolEntry[];
  poolFilter: PoolCategory;
  setPoolFilter: (f: PoolCategory) => void;
  poolSearch: string;
  setPoolSearch: (s: string) => void;
  maxAffixes: number;
  craftedAffixCount: number;
  rarityColor: string;
  rarity: Rarity;
  canAddMore: boolean;
  draggingAffixId: string | null;
  maxWeight: number;
  totalWeight: number;
  onAddAffix: (entry: AffixPoolEntry) => void;
  onDragStart: (e: React.DragEvent, entry: AffixPoolEntry) => void;
  onDragEnd: () => void;
  getCategoryColor: (cat: 'offensive' | 'defensive' | 'utility') => string;
}

export interface ItemBaseSelectorProps {
  selectedBase: ItemBase;
  itemLevel: number;
  onSelectBase: (base: ItemBase) => void;
  onSetItemLevel: (level: number) => void;
}

export interface ItemPreviewCardProps {
  selectedBase: ItemBase;
  craftedAffixes: CraftedAffix[];
  fullItemName: string;
  itemLevel: number;
  dragOverItem: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onRemoveAffix: (tag: string) => void;
  onUpdateMagnitude: (tag: string, mag: number) => void;
  onTogglePlacement: (tag: string) => void;
  onSetPreviewTag: (tag: string | null) => void;
  maxAffixes: number;
}

export interface CraftingStationProps {
  showCraftPanel: boolean;
  onToggleCraftPanel: () => void;
  prefixLocked: boolean;
  suffixLocked: boolean;
  craftCount: number;
  wallet: Record<CurrencyId, number>;
  craftedAffixes: CraftedAffix[];
  maxAffixes: number;
  craftFlash: string | null;
  craftLog: CraftLogEntry[];
  avgCraftCost: Partial<Record<CurrencyId, number>> | null;
  onExecuteCraft: (actionId: CraftingActionId) => void;
  onResetWallet: () => void;
  canAfford: (action: CraftingActionDef) => boolean;
}

export interface ItemStatsSummaryProps {
  craftedAffixes: CraftedAffix[];
  maxAffixes: number;
  itemLevel: number;
  activeSynergies: SynergyRule[];
  wallet: Record<CurrencyId, number>;
  prefixLocked: boolean;
  suffixLocked: boolean;
  totalSpent: Record<CurrencyId, number>;
}

export interface BreakpointTableProps {
  bpCategoryFilter: PoolCategory;
  setBpCategoryFilter: (f: PoolCategory) => void;
  bpRarityFilter: Rarity | 'all';
  setBpRarityFilter: (r: Rarity | 'all') => void;
  bpSearch: string;
  setBpSearch: (s: string) => void;
}
