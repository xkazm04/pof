import type {
  ItemMetadata, MetadataPhase, MetadataAction, SelectPhase, SelectAction, Priority,
} from './types';

export function getMetadataData(state: MetadataPhase): Record<string, ItemMetadata> {
  if ('data' in state) return state.data;
  return {};
}

export function metadataReducer(state: MetadataPhase, action: MetadataAction): MetadataPhase {
  switch (action.type) {
    case 'FETCH_START':
      return { phase: 'loading' };

    case 'FETCH_SUCCESS':
      return { phase: 'loaded', data: action.data };

    case 'FETCH_ERROR':
      return { phase: 'error', data: getMetadataData(state), error: action.error };

    case 'SAVE_START': {
      const data = getMetadataData(state);
      const current = data[action.itemId] ?? { priority: 'none' as Priority, notes: '', updatedAt: '' };
      const updated = { ...current, ...action.patch, updatedAt: new Date().toISOString() };
      return { phase: 'saving', data: { ...data, [action.itemId]: updated }, savingItemId: action.itemId };
    }

    case 'SAVE_DONE':
      return { phase: 'loaded', data: getMetadataData(state) };

    case 'SAVE_ERROR':
      return { phase: 'error', data: getMetadataData(state), error: action.error };

    default:
      return state;
  }
}

export function selectReducer(state: SelectPhase, action: SelectAction): SelectPhase {
  switch (action.type) {
    case 'ENTER':
      return { phase: 'active', selected: new Set() };

    case 'EXIT':
      return { phase: 'inactive' };

    case 'TOGGLE': {
      if (state.phase !== 'active') return state;
      const next = new Set(state.selected);
      if (next.has(action.itemId)) next.delete(action.itemId);
      else next.add(action.itemId);
      return { phase: 'active', selected: next };
    }

    case 'SELECT_ALL':
      return { phase: 'active', selected: new Set(action.itemIds) };

    case 'SELECT_NONE':
      return { phase: 'active', selected: new Set() };

    default:
      return state;
  }
}
