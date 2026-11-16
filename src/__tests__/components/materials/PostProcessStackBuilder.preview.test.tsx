import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

vi.mock('@/components/blender-mcp/BlenderConnectionBar', () => ({ BlenderConnectionBar: () => null }));

import { PostProcessStackBuilder } from '@/components/modules/content/materials/PostProcessStackBuilder';
import { usePostProcessStudioStore } from '@/stores/postProcessStudioStore';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

/**
 * The Blender preview result was a bare <div>: a failure ("Blender bridge
 * timed out") appeared visually but was never announced, while the sibling
 * generate error on the same panel is role="alert". The outcome of an async
 * action the user triggered must reach assistive tech — alert on failure,
 * status on success.
 */

const initialConnection = useBlenderMCPStore.getState().connection;

beforeEach(() => {
  usePostProcessStudioStore.getState().resetToDefaults();
  useBlenderMCPStore.setState({ connection: { ...initialConnection, connected: true } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useBlenderMCPStore.setState({ connection: initialConnection });
});

async function preview(reply: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => reply })));
  const utils = render(<PostProcessStackBuilder onGenerate={() => {}} isGenerating={false} />);
  const btn = Array.from(utils.container.querySelectorAll('button')).find((b) => b.textContent?.includes('PREVIEW IN BLENDER'))!;
  await act(async () => { fireEvent.click(btn); });
  return utils;
}

describe('PostProcessStackBuilder — Blender preview outcome is announced', () => {
  it('a failed preview is a role="alert"', async () => {
    const { getByTestId } = await preview({ success: false, error: 'Blender bridge timed out' });
    const box = getByTestId('pp-blender-result');
    expect(box.textContent).toContain('Blender bridge timed out');
    expect(box.getAttribute('role')).toBe('alert');
  });

  it('a successful preview is a role="status"', async () => {
    const { getByTestId } = await preview({ success: true, data: { output: 'applied 9 nodes' } });
    const box = getByTestId('pp-blender-result');
    expect(box.textContent).toContain('applied 9 nodes');
    expect(box.getAttribute('role')).toBe('status');
  });
});
