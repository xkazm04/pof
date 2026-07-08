import type { ChecklistItem } from '@/types/modules';

export type Priority = 'none' | 'critical' | 'important' | 'nice-to-have';

export interface ItemMetadata {
  priority: Priority;
  notes: string;
  updatedAt: string;
}

export type LayoutMode = 'cards' | 'compact';

// ── Metadata state machine ──────────────────────────────────────────────────

export type MetadataPhase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'loaded'; data: Record<string, ItemMetadata> }
  | { phase: 'saving'; data: Record<string, ItemMetadata>; savingItemId: string }
  | { phase: 'error'; data: Record<string, ItemMetadata>; error: string };

export type MetadataAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; data: Record<string, ItemMetadata> }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'SAVE_START'; itemId: string; patch: Partial<ItemMetadata> }
  | { type: 'SAVE_DONE' }
  | { type: 'SAVE_ERROR'; error: string };

// ── Select mode state machine ───────────────────────────────────────────────

export type SelectPhase =
  | { phase: 'inactive' }
  | { phase: 'active'; selected: Set<string> };

export type SelectAction =
  | { type: 'ENTER' }
  | { type: 'EXIT' }
  | { type: 'TOGGLE'; itemId: string }
  | { type: 'SELECT_ALL'; itemIds: string[] }
  | { type: 'SELECT_NONE' };

export interface RoadmapChecklistProps {
  items: ChecklistItem[];
  subModuleId: string;
  onRunPrompt: (itemId: string, prompt: string) => void;
  accentColor: string;
  isRunning: boolean;
  activeItemId?: string | null;
  lastCompletedItemId?: string | null;
  onBatchRun?: (itemIds: string[]) => void;
  batchQueue?: string[];
}
