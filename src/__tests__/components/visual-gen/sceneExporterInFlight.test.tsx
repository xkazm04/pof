/**
 * Export had no in-flight guard: the button was disabled only on an empty path,
 * so a second click dispatched a second full export + read-back to Blender.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { SceneExporter } from '@/components/modules/visual-gen/scene-composer/SceneExporter';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SceneExporter in-flight guard', () => {
  it('dispatches one export for two clicks while the first is running', () => {
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    render(<SceneExporter />);
    fireEvent.change(screen.getByPlaceholderText('Output file path...'), { target: { value: 'C:/a.glb' } });
    const button = screen.getByRole('button', { name: /export/i }) as HTMLButtonElement;
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
  });
});
