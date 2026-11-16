import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StudioToolbar } from '@/components/studio-3d/StudioToolbar';

afterEach(cleanup);

describe('StudioToolbar semantics', () => {
  it('render mode is one selection (aria-current); grid/axes/rotate stay independent toggles (aria-pressed)', () => {
    render(
      <StudioToolbar
        renderMode="solid" showGrid showAxes={false} autoRotate={false} modelName={null}
        onFileLoad={vi.fn()} onRenderModeChange={vi.fn()} onToggleGrid={vi.fn()} onToggleAxes={vi.fn()}
        onToggleAutoRotate={vi.fn()} onScreenshot={vi.fn()}
      />,
    );
    const modes = ['Textured', 'Solid', 'Wireframe'].map((n) => screen.getByRole('button', { name: n }));
    expect(modes.map((b) => b.getAttribute('aria-current'))).toEqual([null, 'true', null]);
    expect(modes.map((b) => b.getAttribute('aria-pressed'))).toEqual([null, null, null]);
    expect(screen.getByRole('button', { name: /Grid/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Axes/ }).getAttribute('aria-pressed')).toBe('false');
  });
});
