import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SceneSidebar } from '@/components/modules/content/audio/AudioView/SceneSidebar';
import { EmptyState } from '@/components/modules/content/audio/AudioView/EmptyState';

/**
 * Both "new audio scene" controls were a placeholder-only text field, and the
 * sidebar's create button was a bare Plus icon with no accessible name — a
 * screen reader announced "button" and nothing else.
 */

afterEach(cleanup);

const summary = {
  totalScenes: 0, totalZones: 0, totalEmitters: 0, zonesByReverb: {},
  emittersByType: { ambient: 0, point: 0, loop: 0, oneshot: 0, music: 0 },
} as never;

const noopCli = { isRunning: false, sendPrompt: vi.fn(), activeItemId: null, sessionId: 'x' } as unknown as never;

describe('new-scene controls have accessible names', () => {
  it('SceneSidebar: named field and named create button', () => {
    render(
      <SceneSidebar
        summary={summary} docs={[]} activeDoc={null} onSelectScene={vi.fn()}
        pendingSwitch={null} switchBlocked={false} saveError={null}
        onRetrySwitch={vi.fn()} onDiscardSwitch={vi.fn()}
        newDocName="" setNewDocName={vi.fn()} handleCreateDoc={vi.fn()} isCreating={false}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'New audio scene name' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create audio scene' })).toBeTruthy();
  });

  it('EmptyState: named field', () => {
    render(
      <EmptyState
        pipelineCli={noopCli} newDocName="" setNewDocName={vi.fn()}
        handleCreateDoc={vi.fn()} isCreating={false}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'New audio scene name' })).toBeTruthy();
  });
});
