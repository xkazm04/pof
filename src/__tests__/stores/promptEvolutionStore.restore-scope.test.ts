import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePromptEvolutionStore } from '@/stores/promptEvolutionStore';
import type { PromptVariant, VariantVersionHistory } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

/**
 * Checklist item ids are per-module. restoreVariant keyed the loaded variants by
 * (moduleId, checklistItemId) but the held version history by checklistItemId only, so
 * restoring (module B, item x) flipped the active flags of a history held for
 * (module A, item x).
 */

const A = 'arpg-combat' as SubModuleId;
const B = 'arpg-loot' as SubModuleId;

const variant = (id: string, moduleId: SubModuleId, active: boolean) =>
  ({ id, moduleId, checklistItemId: 'x', active }) as unknown as PromptVariant;

const heldHistory = (): VariantVersionHistory => ({
  moduleId: A,
  checklistItemId: 'x',
  versions: [{ variant: variant('a1', A, true), isActive: true }],
  roots: [],
  activeVariantId: 'a1',
} as unknown as VariantVersionHistory);

beforeEach(() => {
  usePromptEvolutionStore.setState({ variants: [], versionHistory: heldHistory(), isRestoring: false, error: null });
});
afterEach(() => vi.unstubAllGlobals());

describe('promptEvolutionStore.restoreVariant — one key rule for both local mirrors', () => {
  it('restoring (B, x) leaves a history held for (A, x) untouched', async () => {
    const restored = variant('b2', B, true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ success: true, data: restored }) }));
    await usePromptEvolutionStore.getState().restoreVariant('b2');
    const h = usePromptEvolutionStore.getState().versionHistory!;
    expect(h.activeVariantId).toBe('a1');
    expect(h.versions[0].isActive).toBe(true);
  });

  it('restoring within the held module still updates the history', async () => {
    const restored = variant('a2', A, true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ success: true, data: restored }) }));
    await usePromptEvolutionStore.getState().restoreVariant('a2');
    expect(usePromptEvolutionStore.getState().versionHistory!.activeVariantId).toBe('a2');
  });
});
