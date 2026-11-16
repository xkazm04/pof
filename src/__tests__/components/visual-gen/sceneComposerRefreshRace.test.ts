/**
 * refreshScene is called from the mount effect, the Refresh button, after every object
 * operation and after a blockout. Replies were applied in arrival order, so a slow
 * earlier reply overwrote a newer scene and cleared the spinner of the one still running.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useSceneComposerStore } from '@/components/modules/visual-gen/scene-composer/useSceneComposerStore';

const store = () => useSceneComposerStore.getState();
const scene = (name: string) => ({ objects: [{ name, type: 'MESH', visible: true }] });

let replies: Array<(data: unknown) => void>;

beforeEach(() => {
  replies = [];
  useSceneComposerStore.setState({ sceneInfo: null, isRefreshing: false, lastError: null });
  vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
    replies.push((data) => resolve({ ok: true, status: 200, json: async () => ({ success: true, data }) }));
  })));
});

afterEach(() => vi.unstubAllGlobals());

describe('refreshScene ordering', () => {
  it('ignores a reply older than the latest request', async () => {
    const first = store().refreshScene();
    const second = store().refreshScene();
    replies[1](scene('New'));
    await second;
    replies[0](scene('Old'));
    await first;
    expect(store().sceneInfo?.objects[0].name).toBe('New');
  });

  it('keeps the spinner until the latest request answers', async () => {
    const first = store().refreshScene();
    const second = store().refreshScene();
    replies[0](scene('Old'));
    await first;
    expect(store().isRefreshing).toBe(true);
    replies[1](scene('New'));
    await second;
    expect(store().isRefreshing).toBe(false);
  });
});
