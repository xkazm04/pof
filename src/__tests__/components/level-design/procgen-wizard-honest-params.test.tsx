/**
 * The wizard's sliders now tell the truth about themselves.
 *
 * "Min Rooms", "Max Rooms" and "Corridor Width" were live-looking controls that
 * three of the four algorithms discarded, and the preview promised "the same
 * seed UE targets" — which reads as guaranteed layout parity the freehand C++
 * path cannot deliver.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ProceduralLevelWizard } from '@/components/modules/content/level-design/ProceduralLevelWizard';
import { ALGO_PARAM_SUPPORT } from '@/lib/level-design/algo-params';

afterEach(cleanup);

function open() {
  return render(<ProceduralLevelWizard onGenerate={vi.fn()} isGenerating={false} />);
}

/** Click one algorithm radio by its visible label. */
function selectAlgorithm(getByRole: ReturnType<typeof open>['getByRole'], label: RegExp) {
  fireEvent.click(getByRole('radio', { name: label }));
}

describe('parameters that do nothing say so', () => {
  it('BSP (the default) leaves the room + corridor sliders live', () => {
    const { getByTestId, queryByTestId } = open();
    for (const key of ['roomCountMin', 'roomCountMax', 'corridorWidth']) {
      expect(getByTestId(`size-${key}`).getAttribute('data-disabled')).toBe('false');
      expect(queryByTestId(`size-${key}-reason`)).toBeNull();
    }
  });

  it('Cellular Automata disables them and renders the reason', () => {
    const { getByRole, getByTestId } = open();
    selectAlgorithm(getByRole, /Cellular Automata/i);

    for (const key of ['roomCountMin', 'roomCountMax', 'corridorWidth'] as const) {
      const slider = getByTestId(`size-${key}`);
      expect(slider.getAttribute('data-disabled')).toBe('true');
      expect((slider.querySelector('input[type=range]') as HTMLInputElement).disabled).toBe(true);
      // The reason on screen is the same string the generators are held to.
      expect(getByTestId(`size-${key}-reason`).textContent).toBe(ALGO_PARAM_SUPPORT.cellular[key]);
    }
    // Grid size feeds every algorithm and stays live.
    expect(getByTestId('size-gridWidth').getAttribute('data-disabled')).toBe('false');
  });

  it('Perlin Noise disables them with its own reason', () => {
    const { getByRole, getByTestId } = open();
    selectAlgorithm(getByRole, /Perlin Noise/i);
    expect(getByTestId('size-roomCountMax-reason').textContent).toBe(ALGO_PARAM_SUPPORT.perlin.roomCountMax);
    expect(getByTestId('size-roomCountMax-reason').textContent).toMatch(/Perlin/);
  });

  it('a disabled slider cannot be dragged into changing the config', () => {
    const { getByRole, getByTestId } = open();
    selectAlgorithm(getByRole, /Perlin Noise/i);
    const input = getByTestId('size-corridorWidth').querySelector('input[type=range]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});

describe('an inverted room band is flagged on screen', () => {
  it('shows an alert when Min Rooms is dragged above Max Rooms', () => {
    const { getByTestId, queryByTestId } = open();
    expect(queryByTestId('size-room-band-error')).toBeNull();

    const minInput = getByTestId('size-roomCountMin').querySelector('input[type=range]') as HTMLInputElement;
    fireEvent.change(minInput, { target: { value: '40' } });

    expect(getByTestId('size-room-band-error').textContent).toMatch(/Min Rooms \(40\).*Max Rooms \(15\)/);
  });
});

describe('the parity claim states what is true today', () => {
  it('does not promise the layout UE will bake', () => {
    const { getByTestId } = open();
    const copy = getByTestId('procgen-preview-parity').textContent ?? '';
    expect(copy).toMatch(/same algorithm family and seed/i);
    expect(copy).toMatch(/not guaranteed/i);
    // The old wording, which read as a parity promise, is gone.
    expect(copy).not.toMatch(/same seed UE targets/i);
  });
});
