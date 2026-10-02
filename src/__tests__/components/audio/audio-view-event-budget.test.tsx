import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { AudioSceneDocument } from '@/types/audio-scene';
import { DEFAULT_EVENTS } from '@/components/modules/content/audio/AudioEventCatalog/constants';

/**
 * "Generate Audio Manager" used to build the event prompt from the catalog and
 * the project only — the open scene's sound pool and voice limit never reached
 * it, so the generated event code sized its pool from "a data asset" while the
 * scene said 16 voices. The hook now passes the scene as the user sees it.
 */

const scene: AudioSceneDocument = {
  id: 7, name: 'Crypt', description: '', zones: [], emitters: [],
  globalReverbPreset: 'none', soundPoolSize: 40, maxConcurrentSounds: 20,
  lastGeneratedAt: null, createdAt: '', updatedAt: '',
};

const clis = new Map<string, { sendPrompt: ReturnType<typeof vi.fn>; isRunning: boolean }>();

vi.mock('@/hooks/useAudioScene', () => ({
  useAudioScene: () => ({
    docs: [scene], summary: null, activeDoc: scene, isLoading: false, error: null,
    retry: vi.fn(), setActiveDocId: vi.fn(), createDoc: vi.fn(), updateDoc: vi.fn(),
    commitDoc: vi.fn().mockResolvedValue(undefined), deleteDoc: vi.fn(), refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { sessionKey: string }) => {
    if (!clis.has(opts.sessionKey)) clis.set(opts.sessionKey, { sendPrompt: vi.fn(), isRunning: false });
    return clis.get(opts.sessionKey);
  },
}));

vi.mock('@/hooks/useChecklistCLI', () => ({
  useChecklistCLI: () => ({ sendPrompt: vi.fn(), isRunning: false }),
}));

vi.mock('@/hooks/useModuleReviewCli', () => ({
  useModuleReviewCli: () => ({
    refetchKey: 0, lastCompletedId: null, checklistCli: {}, isReviewing: false, isFixing: false,
    startReview: vi.fn(), handleFix: vi.fn(), handleSync: vi.fn(),
  }),
}));

import { useAudioView } from '@/components/modules/content/audio/AudioView/useAudioView';

beforeEach(() => clis.clear());

describe('useAudioView — the event prompt carries the open scene budget', () => {
  it('sends one prompt stating the scene pool 40 and voice limit 20', () => {
    const { result } = renderHook(() => useAudioView());
    act(() => result.current.handleGenerateEvents({ events: DEFAULT_EVENTS }));

    const send = clis.get('audio-events')!.sendPrompt;
    expect(send).toHaveBeenCalledTimes(1);
    const prompt = send.mock.calls[0][0] as string;
    expect(prompt).toMatch(/pool of 40\b/);
    expect(prompt).toMatch(/voice limit of 20\b/);
  });
});
