import type { ReactNode } from 'react';

/** A single selectable entity. */
export interface SelectorItem {
  id: string;
  [key: string]: unknown;
}

/** Grouped items for rendering collapsible sections. */
export interface SelectorGroup<T extends SelectorItem> {
  key: string;
  label: string;
  items: T[];
}

export type SelectionMode = 'single' | 'multi';

export interface ScalableSelectorProps<T extends SelectorItem> {
  /** Full list of selectable entities. */
  items: T[];
  /** Key path used for grouping items into collapsible sections. */
  groupBy?: keyof T;
  /** Render prop for custom item cards. Receives item + selected state. */
  renderItem: (item: T, selected: boolean) => ReactNode;
  /** Callback when selection changes. Single mode: single item. Multi mode: full array. */
  onSelect: (selected: T[]) => void;
  /** Currently selected item ids. */
  selected: string[];
  /** Key on T used for text search filtering. */
  searchKey: keyof T;
  /** Placeholder text for the search input. */
  placeholder?: string;
  /** Single-select or multi-select toggle. */
  mode?: SelectionMode;
  /** Whether the selector modal is open. */
  open: boolean;
  /** Close callback. */
  onClose: () => void;
  /** Optional title for the modal header. */
  title?: string;
  /** Accent color for selection highlights. */
  accent?: string;
}
