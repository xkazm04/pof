import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRailScope } from '@/components/ecw/cli/useRailScope';
import { useEcwStore } from '@/stores/ecwStore';

describe('useRailScope', () => {
  beforeEach(() => {
    useEcwStore.setState({ activeCatalogId: null, activeEntityId: null });
  });

  it('returns project scope when no entity selected', () => {
    const { result } = renderHook(() => useRailScope());
    expect(result.current.kind).toBe('project');
  });

  it('returns entity scope when both catalog + entity selected', () => {
    useEcwStore.setState({ activeCatalogId: 'spellbook', activeEntityId: 'ga-fireball' });
    const { result } = renderHook(() => useRailScope());
    expect(result.current).toEqual({ kind: 'entity', catalogId: 'spellbook', entityId: 'ga-fireball' });
  });

  it('returns project scope when only catalog selected (no entity)', () => {
    useEcwStore.setState({ activeCatalogId: 'spellbook', activeEntityId: null });
    const { result } = renderHook(() => useRailScope());
    expect(result.current.kind).toBe('project');
  });
});
