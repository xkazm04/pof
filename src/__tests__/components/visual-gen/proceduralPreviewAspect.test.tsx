/**
 * Dungeon and vegetation areas need not be square (sliders reach 128x32 and 200x50),
 * but both canvases forced `aspect-square`, stretching the layout under preview.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  DungeonPreview,
  VegetationPreview,
} from '@/components/modules/visual-gen/procedural-engine/ProceduralEngineView/Previews';

afterEach(cleanup);

describe('preview aspect', () => {
  it('does not force a non-square dungeon square', () => {
    const { container } = render(<DungeonPreview grid={[['floor', 'floor']]} width={2} height={1} />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.className).not.toContain('aspect-square');
    expect(canvas.className).toContain('h-auto');
  });

  it('does not force a non-square vegetation area square', () => {
    const { container } = render(<VegetationPreview points={[]} width={200} height={50} species={[]} />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.className).not.toContain('aspect-square');
    expect(canvas.className).toContain('h-auto');
  });
});
