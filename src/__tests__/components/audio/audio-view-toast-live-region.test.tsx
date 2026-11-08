import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { AudioSceneDocument } from '@/types/audio-scene';

/** The review/fix toast must be announced to assistive tech (role status / alert). */

const deleteDoc = vi.fn<(id: number) => Promise<boolean>>();
let toast: { message: string; type: 'success' | 'error' } | null = null;

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
    rvToast: toast,
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

beforeEach(() => { toast = null; });
afterEach(cleanup);

describe('AudioView - review toast is a live region', () => {
  it('a success toast is a polite status', () => {
    toast = { message: 'Review complete', type: 'success' };
    render(<AudioView />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Review complete');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('an error toast is an alert', () => {
    toast = { message: 'Fix failed', type: 'error' };
    render(<AudioView />);
    expect(screen.getByRole('alert').textContent).toContain('Fix failed');
  });

  it('the Generate Audio System button is type=button with decorative icons', () => {
    render(<AudioView />);
    const btn = screen.getByRole('button', { name: /Generate Audio System/ });
    expect(btn.getAttribute('type')).toBe('button');
    expect(Array.from(btn.querySelectorAll('svg')).every((i) => i.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
});
