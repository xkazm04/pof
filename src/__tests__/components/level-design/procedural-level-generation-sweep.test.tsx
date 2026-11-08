/**
 * scan-sweep night 2026-11-08 — procedural-level-generation.
 *
 * Registry: game-production/procedural-level-planning (seed-determinism-contract:
 * "the same seed and the same parameter set produce the same plan").
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import { ProceduralLevelWizard } from '@/components/modules/content/level-design/ProceduralLevelWizard';

afterEach(cleanup);

const rangeValue = (root: HTMLElement, testId: string) =>
  Number((within(root).getByTestId(testId).querySelector('input[type=range]') as HTMLInputElement).value);

describe('a one-lever remedy is one undo step', () => {
  it('Undo after applying the room-band remedy restores the whole band, never half of it', () => {
    const view = render(<ProceduralLevelWizard onGenerate={vi.fn()} isGenerating={false} />);
    fireEvent.click(view.getByRole('radio', { name: /Wave Function Collapse/i }));
    fireEvent.click(view.getByRole('button', { name: /Find a fix/i }));
    fireEvent.click(within(view.getByTestId('layout-remedies')).getByRole('button', { name: /Room count band 8-15 →/ }));
    expect(rangeValue(view.container, 'size-roomCountMax')).toBeGreaterThan(15);

    fireEvent.click(view.getByTestId('procgen-undo'));

    expect(rangeValue(view.container, 'size-roomCountMin')).toBe(8);
    expect(rangeValue(view.container, 'size-roomCountMax')).toBe(15);
    expect(view.queryByTestId('size-room-band-error')).toBeNull();
    // ...and the step before the remedy is the algorithm change, one more Undo away.
    fireEvent.click(view.getByTestId('procgen-undo'));
    expect(view.getByRole('radio', { name: /BSP Tree/i }).getAttribute('aria-checked')).toBe('true');
  });
});
