import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { GlbPreviewPanel, GLB_PREVIEW_LABEL } from '@/components/layout-lab/steps/shared/GlbPreviewPanel';
import { LAB_THEMES } from '@/components/layout-lab/theme';

const t = LAB_THEMES[0];

describe('GlbPreviewPanel (extracted 3D preview block)', () => {
  afterEach(cleanup);

  it('renders the served .glb URL caption (viewer loads lazily under it)', () => {
    const url = '/api/visual-gen/asset/hero.glb';
    const { container } = render(<GlbPreviewPanel t={t} url={url} />);
    expect(container.textContent).toContain(url);
  });

  it('exposes a stable single-sourced panel label', () => {
    expect(GLB_PREVIEW_LABEL).toBe('3D preview (orbit / zoom)');
  });
});
