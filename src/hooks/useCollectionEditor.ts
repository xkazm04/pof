import { useCallback } from 'react';

/**
 * Generic hook for add/remove/update operations on a collection of items with `id` fields.
 * Eliminates repeated CRUD callback boilerplate across sub-editors.
 */
export function useCollectionEditor<T extends { id: string }>(
  items: T[],
  onChange: (items: T[]) => void,
  factory: () => T,
) {
  const add = useCallback(() => {
    const newItem = factory();
    onChange([...items, newItem]);
    return newItem;
  }, [items, onChange, factory]);

  const remove = useCallback((id: string) => {
    onChange(items.filter(item => item.id !== id));
  }, [items, onChange]);

  const update = useCallback((id: string, updates: Partial<T>) => {
    onChange(items.map(item => item.id === id ? { ...item, ...updates } : item));
  }, [items, onChange]);

  return { add, remove, update } as const;
}
