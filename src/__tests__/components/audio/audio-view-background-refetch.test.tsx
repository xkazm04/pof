import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { AudioSceneDocument } from '@/types/audio-scene';

/**
 * `useCRUD.refetch` raises `isLoading` on EVERY refetch, and every save triggers
 * one. AudioView used to return a full-screen spinner for any `isLoading`, so a
 * background refresh tore the whole subtree down — taking the scene painter's
 * zoom/pan/gesture state with it. The spinner is now first-load only.
 */

const state = {
  isLoading: true,
  docs: [] as AudioSceneDocument[],
};

function doc(): AudioSceneDocument {
  return {
    id: 1, name: 'Cavern Scene', description: '', zones: [], emitters: [],
    soundPoolSize: 32, maxConcurrentSounds: 16, globalReverbPreset: 'none',
    lastGeneratedAt: null, createdAt: '', updatedAt: '',
  } as unknown as AudioSceneDocument;
}

const noopCli = {
  isRunning: false, sendPrompt: vi.fn(), activeItemId: null, sessionId: 'x',
} as unknown as never;

vi.mock('@/components/modules/content/audio/AudioView/useAudioView', () => ({
  useAudioView: () => ({
    docs: state.docs,
    summary: { totalScenes: state.docs.length, totalZones: 0, totalEmitters: 0, zonesByReverb: {}, emittersByType: { ambient: 0, point: 0, loop: 0, oneshot: 0, music: 0 } },
    activeDoc: state.docs[0] ?? null,
    isLoading: state.isLoading,
    error: null,
    retry: vi.fn(),
    setActiveDocId: vi.fn(),
    deleteDoc: vi.fn(),
    refetch: vi.fn(),
    activeTab: 'painter',
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
    commitScene: vi.fn().mockResolvedValue(undefined),
    commitZones: vi.fn().mockResolvedValue(undefined),
    commitEmitters: vi.fn().mockResolvedValue(undefined),
    handleZoneUpdate: vi.fn(),
    handleEmitterUpdate: vi.fn(),
    handleGenerateAll: vi.fn(),
    handleGenerateZoneCode: vi.fn(),
    handleGenerateSoundscape: vi.fn(),
    commitDescription: vi.fn().mockResolvedValue(undefined),
    commitSetting: vi.fn().mockResolvedValue(undefined),
    selectedZone: null,
    selectedEmitter: null,
  }),
}));

// Imported after the mock: AudioView's module graph is heavy and must resolve the
// stubbed hook, not the real one.
import { AudioView } from '@/components/modules/content/audio/AudioView';

beforeEach(() => {
  state.isLoading = true;
  state.docs = [];
});
afterEach(cleanup);

describe('AudioView — background refetch does not unmount the painter', () => {
  it('still blanks to a spinner on the FIRST load', () => {
    render(<AudioView />);
    expect(screen.queryByRole('application')).toBeNull();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('keeps the painter — and its zoom state — mounted while a refetch runs', () => {
    state.isLoading = false;
    state.docs = [doc()];
    const { rerender } = render(<AudioView />);

    expect(screen.getByRole('application')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('120%')).toBeTruthy();

    // A save fires a refetch → isLoading flips true with the scene already loaded.
    state.isLoading = true;
    rerender(<AudioView />);

    expect(screen.getByRole('application')).toBeTruthy(); // ← used to unmount
    expect(screen.getByText('120%')).toBeTruthy();        // ← state survives
    expect(document.querySelector('.animate-spin')).toBeNull();

    state.isLoading = false;
    rerender(<AudioView />);
    expect(screen.getByText('120%')).toBeTruthy();
  });
});
