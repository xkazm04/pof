import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

type Pending = { resolve: (v: unknown) => void };
const pending: Pending[] = [];

vi.mock('@/lib/api-utils', () => ({
  tryApiFetch: vi.fn(() => new Promise((resolve) => { pending.push({ resolve }); })),
}));
vi.mock('@/components/blender-mcp/BlenderConnectionBar', () => ({ BlenderConnectionBar: () => null }));
vi.mock('@/stores/blenderMCPStore', () => ({
  useBlenderMCPStore: (sel: (s: { connection: { connected: boolean } }) => unknown) => sel({ connection: { connected: true } }),
}));

import { MaterialPatternCatalog } from '@/components/modules/content/materials/MaterialPatternCatalog';

afterEach(() => {
  cleanup();
  pending.length = 0;
});

/**
 * Two Blender previews in flight (start Water, collapse it, start Fire): Water's
 * completion cleared the single in-flight marker in its `finally`, so Fire's
 * button re-enabled while Fire was still running — a second click dispatched a
 * duplicate script to Blender.
 */

function header(container: HTMLElement, name: string): HTMLButtonElement {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]'))
    .find((b) => b.textContent?.includes(name))!;
}

function previewButton(container: HTMLElement): HTMLButtonElement {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    .find((b) => /Preview in Blender|Sending to Blender/.test(b.textContent ?? ''))!;
}

describe('MaterialPatternCatalog Blender preview', () => {
  it('keeps a later preview marked in flight when an earlier one finishes', async () => {
    const { container } = render(<MaterialPatternCatalog onGenerate={vi.fn()} isGenerating={false} />);

    fireEvent.click(header(container, 'Water Surface'));
    fireEvent.click(previewButton(container));
    fireEvent.click(header(container, 'Water Surface')); // collapse

    fireEvent.click(header(container, 'Fire / Embers'));
    fireEvent.click(previewButton(container));
    expect(pending).toHaveLength(2);
    expect(previewButton(container).disabled).toBe(true);

    await act(async () => { pending[0].resolve({ ok: true, data: { output: 'water done' } }); });

    const fire = previewButton(container);
    expect(fire.textContent).toMatch(/Sending to Blender/);
    expect(fire.disabled).toBe(true);
  });
});
