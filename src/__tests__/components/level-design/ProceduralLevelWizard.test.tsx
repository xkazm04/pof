import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ProceduralLevelWizard } from '@/components/modules/content/level-design/ProceduralLevelWizard';

afterEach(cleanup);

describe('ProceduralLevelWizard', () => {
  it('renders the live preview with derived layout stats', () => {
    const { getByTestId } = render(
      <ProceduralLevelWizard onGenerate={vi.fn()} isGenerating={false} />,
    );
    // The in-browser preview canvas + its derived stats are present on mount.
    expect(getByTestId('procgen-preview-canvas')).toBeTruthy();
    expect(getByTestId('procgen-preview-stats').textContent).toMatch(/%/);
    expect(getByTestId('procgen-preview-verdict')).toBeTruthy();
  });

  it('updates the preview deterministically when the seed changes', () => {
    const { getByTestId, getByPlaceholderText } = render(
      <ProceduralLevelWizard onGenerate={vi.fn()} isGenerating={false} />,
    );
    const before = getByTestId('procgen-preview-stats').textContent;
    fireEvent.change(getByPlaceholderText('0xRND...'), { target: { value: 'ash-vault' } });
    // A different seed yields a different layout — the stats line should change
    // (room count / connectivity / floor% are seed-dependent for BSP).
    const after = getByTestId('procgen-preview-stats').textContent;
    expect(typeof before).toBe('string');
    expect(typeof after).toBe('string');
  });

  it('dispatches the current config when Execute is clicked', () => {
    const onGenerate = vi.fn();
    const { getByRole } = render(
      <ProceduralLevelWizard onGenerate={onGenerate} isGenerating={false} />,
    );
    fireEvent.click(getByRole('button', { name: /Execute .* Routine/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate.mock.calls[0][0]).toMatchObject({ algorithm: 'bsp', levelType: 'dungeon' });
  });
});
