/**
 * Progress holds only registry ids: the two writes refuse an item the registry does
 * not declare, and loadProgress prunes stale keys instead of carrying them forever.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api-utils', async (orig) => ({
  ...(await orig<typeof import('@/lib/api-utils')>()),
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/lib/api-utils';
import { useModuleStore } from '@/stores/moduleStore';
import { cancelAutoSave } from '@/services/ProjectModuleBridge';
import { getModuleChecklist } from '@/lib/module-registry';

const store = () => useModuleStore.getState();
const unknownKeys = () =>
  Object.entries(store().checklistProgress).flatMap(([m, items]) =>
    Object.keys(items).filter((id) => !getModuleChecklist(m as never).some((i) => i.id === id)),
  );

beforeEach(() => {
  cancelAutoSave();
  useModuleStore.setState({ checklistProgress: {}, checklistCompletedAt: {}, progressProjectPath: null });
});

describe('registry-only progress', () => {
  it('setChecklistItem refuses an unknown id and accepts a declared one', () => {
    store().setChecklistItem('arpg-combat', 'nope', true);
    expect(unknownKeys()).toHaveLength(0);
    const real = getModuleChecklist('arpg-combat')[0].id;
    store().setChecklistItem('arpg-combat', real, true);
    expect(store().checklistProgress['arpg-combat']?.[real]).toBe(true);
    cancelAutoSave();
  });

  it('still accepts a declared auxiliary surface key (animations setup guide)', () => {
    store().setChecklistItem('animations', 'step-mixamo-download', true);
    expect(store().checklistProgress.animations?.['step-mixamo-download']).toBe(true);
    cancelAutoSave();
  });

  it('toggleChecklistItem refuses an unknown id', () => {
    store().toggleChecklistItem('arpg-combat', 'nope');
    expect(unknownKeys()).toHaveLength(0);
  });

  it('loadProgress prunes stale keys from the loaded blob', async () => {
    const real = getModuleChecklist('arpg-combat')[0].id;
    vi.mocked(apiFetch).mockResolvedValueOnce({
      checklistProgress: { 'arpg-combat': { [real]: true, retired: true } },
      moduleHealth: {},
      checklistVerification: {},
      moduleHistory: {},
    });
    await store().loadProgress('C:/p');
    expect(unknownKeys()).toHaveLength(0);
    expect(store().checklistProgress['arpg-combat']?.[real]).toBe(true);
  });
});
