/** The exporter's two fields had no accessible name beyond a placeholder. */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { SceneExporter } from '@/components/modules/visual-gen/scene-composer/SceneExporter';

afterEach(cleanup);

describe('SceneExporter field names', () => {
  it('names the path input and the format select', () => {
    render(<SceneExporter />);
    expect(screen.getByLabelText('Output file path').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Export format').tagName).toBe('SELECT');
  });
});
