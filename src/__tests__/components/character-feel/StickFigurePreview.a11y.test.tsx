import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StickFigurePreview } from '@/components/modules/core-engine/sub_character/playground/StickFigurePreview';
import { decodeCurves, encodeCurves } from '@/lib/character/feel-curve-codec';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';

afterEach(() => cleanup());

/* The movement preview is a bare <canvas>: AT announced nothing, not even the
 * idle hint drawn into its pixels. It needs role=img and a name that carries
 * the tuning it animates. */
describe('StickFigurePreview accessible name', () => {
  it('exposes the canvas as an image whose name states the previewed tuning', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const values = decodeCurves(encodeCurves(FEEL_PRESETS[0].profile));
    const { container } = render(<StickFigurePreview values={values} isPlaying={false} />);
    const canvas = container.querySelector('canvas');
    expect(canvas?.getAttribute('role')).toBe('img');
    const name = canvas?.getAttribute('aria-label') ?? '';
    expect(name).toMatch(/movement preview/i);
    expect(name).toContain(String(Math.round(values['movement.maxWalkSpeed'])));
    expect(name).toMatch(/paused|press play/i);
  });
});
