import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import type { AudioSceneDocument } from '@/types/audio-scene';

/**
 * The header's trash icon deleted the open scene — its DB row AND its persisted
 * Event Catalog — on one click, with no confirmation, and a refused delete
 * (`deleteDoc` resolves false) said nothing at all. It now asks first, and a
 * refusal stays on screen with its reason.
 */

const deleteDoc = vi.fn<(id: number) => Promise<boolean>>();

const scene = {
  id: 7, name: 'Cavern Scene', description: '', zones: [], emitters: [],
  soundPoolSize: 32, maxConcurrentSounds: 16, globalReverbPreset: 'none',
  lastGeneratedAt: null, createdAt: '', updatedAt: '',
} as unknown as AudioSceneDocument;

const noopCli = { isRunning: false, sendPrompt: vi.fn(), activeItemId: null, sessionId: 'x' } as unknown as never;

vi.mock('@/components/modules/content/audio/AudioView/useAudioView', () => ({
  useAudioView: () => ({
    docs: [scene],
    summary: { totalScenes: 1, totalZones: 0, totalEmitters: 0, zonesByReverb: {}, emittersByType: { ambient: 0, point: 0, loop: 0, oneshot: 0, music: 0 } },
    activeDoc: scene,
    isLoading: false,
    error: null,
    retry: vi.fn(),
    deleteDoc,
    refetch: vi.fn(),
    // Roadmap renders nothing heavy and needs no fetch.
    activeTab: 'roadmap',
    setActiveTab: vi.fn(),
    selectedZoneId: null,
    setSelectedZoneId: vi.fn(),
    selectedEmitterId: null,
    setSelectedEmitterId: vi.fn(),
    isCreating: false,
    newDocName: '',
    setNewDocName: vi.fn(),
    pipelineCli: noopCli,
    audioCli: noopCli,
    eventCli: noopCli,
    handleGenerateEvents: vi.fn(),
    rvToast: null,
    rvRefetch: 0,
    rvLastCompletedId: null,
    rvChecklistCli: noopCli,
    isReviewing: false,
    isFixing: false,
    startRvReview: vi.fn(),
    handleRvFix: vi.fn(),
    handleRvSync: vi.fn(),
    rvChecklist: [],
    AUD_MODULE_ID: 'audio',
    handleCreateDoc: vi.fn(),
    sceneSession: {
      buffer: {
        scene: null, isDirty: false, isSaving: false, saveError: null,
        stage: vi.fn(), stageDebounced: vi.fn(), commit: vi.fn(), flush: vi.fn(),
        retry: vi.fn(), dismissError: vi.fn(), peek: () => null,
      },
      pendingSwitch: null,
      switchBlocked: false,
      requestSwitch: vi.fn(),
      retrySwitch: vi.fn(),
      discardAndSwitch: vi.fn(),
      settle: () => null,
    },
    handleGenerateAll: vi.fn(),
    handleGenerateZoneCode: vi.fn(),
    handleGenerateSoundscape: vi.fn(),
    commitDescription: vi.fn().mockResolvedValue(undefined),
    commitSetting: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { AudioView } from '@/components/modules/content/audio/AudioView';

const flush = async () => {
  await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
};

beforeEach(() => { deleteDoc.mockReset(); });
afterEach(cleanup);

describe('AudioView — deleting a scene asks first', () => {
  it('the trash icon opens a confirmation and deletes nothing yet', () => {
    deleteDoc.mockResolvedValue(true);
    render(<AudioView />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete scene' }));
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').textContent).toContain('Cavern Scene');
  });

  it('Cancel keeps the scene; Delete removes it', async () => {
    deleteDoc.mockResolvedValue(true);
    render(<AudioView />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete scene' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(deleteDoc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete scene' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await flush();
    expect(deleteDoc).toHaveBeenCalledWith(7);
    // The Modal fades out (AnimatePresence), so wait for the exit to finish.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a refused delete stays open with its reason', async () => {
    deleteDoc.mockResolvedValue(false);
    render(<AudioView />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete scene' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await flush();
    expect(screen.getByRole('alert').textContent).toMatch(/could not be deleted/i);
  });
});
