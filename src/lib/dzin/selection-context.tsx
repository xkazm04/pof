'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

/** The type of entity that can be selected across panels. */
export type EntityType = 'ability' | 'tag' | 'item' | 'enemy' | 'zone' | 'attribute';

export interface EntitySelection {
  type: EntityType;
  id: string;
}

interface DzinSelectionContextValue {
  selection: EntitySelection | null;
  setSelection: (sel: EntitySelection | null) => void;
}

const DzinSelectionContext = createContext<DzinSelectionContextValue>({
  selection: null,
  setSelection: () => {},
});

/**
 * Provider that manages cross-panel entity selection.
 * Clicking the same entity again clears the selection (toggle behavior).
 */
export function DzinSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelectionRaw] = useState<EntitySelection | null>(null);

  const setSelection = useCallback((sel: EntitySelection | null) => {
    setSelectionRaw((prev) => {
      // Toggle: clicking same entity clears selection
      if (prev && sel && prev.type === sel.type && prev.id === sel.id) {
        return null;
      }
      return sel;
    });
  }, []);

  return (
    <DzinSelectionContext.Provider value={{ selection, setSelection }}>
      {children}
    </DzinSelectionContext.Provider>
  );
}

/** Hook to access the cross-panel selection state. */
export function useDzinSelection() {
  return useContext(DzinSelectionContext);
}
