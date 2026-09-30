/**
 * The fragmented-preview verdict offers verified, one-click fixes.
 *
 * Registry standard: `game-production/procedural-level-planning` — "a designer
 * changes one number, sees a directed change, and stops re-rolling".
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import { ProceduralLevelWizard } from '@/components/modules/content/level-design/ProceduralLevelWizard';
import { LivePreview } from '@/components/modules/content/level-design/ProceduralLevelWizard/LivePreview';
import { ALGORITHMS } from '@/components/modules/content/level-design/ProceduralLevelWizard/constants';
import { initialProcgenSpecState } from '@/components/modules/content/level-design/ProceduralLevelWizard/specState';
import { REMEDY_SLIDER_BOUNDS } from '@/lib/level-design/layout-remedies';
import { generatePreview } from '@/lib/level-design/procgen-preview';
import { buildProcgenSpec, previewConfigFromSpec } from '@/lib/level-design/procgen-spec';

afterEach(cleanup);

const open = () => render(<ProceduralLevelWizard onGenerate={vi.fn()} isGenerating={false} />);

/** First seed whose cellular preview at the dungeon default size is fragmented — measured. */
function fragmentedCellularSeed(): string {
  const base = initialProcgenSpecState().spec;
  for (let i = 0; i < 200; i++) {
    const s = buildProcgenSpec({ ...base, algorithm: 'cellular', seed: String(i) });
    if (generatePreview(previewConfigFromSpec(s)).stats.regions > 1) return String(i);
  }
  throw new Error('no fragmented cellular seed in 0..199');
}

function openFragmentedCellular() {
  const view = open();
  fireEvent.click(view.getByRole('radio', { name: /Cellular Automata/i }));
  const seedInput = view.getByPlaceholderText('0xRND...') as HTMLInputElement;
  fireEvent.change(seedInput, { target: { value: fragmentedCellularSeed() } });
  expect(view.getByTestId('procgen-preview-verdict').textContent).toMatch(/disconnected regions/);
  return { ...view, seedInput };
}

describe('Find a fix on a fragmented preview', () => {
  it('Use seed N sets the seed and the preview reads Fully connected', () => {
    const { getByRole, getByTestId, seedInput } = openFragmentedCellular();
    fireEvent.click(getByRole('button', { name: /Find a fix/i }));
    const panel = getByTestId('layout-remedies');
    const useSeed = within(panel).getAllByRole('button', { name: /^Use seed -?\d+/ })[0];
    const n = Number(/Use seed (-?\d+)/.exec(useSeed.textContent ?? '')![1]);

    fireEvent.click(useSeed);

    expect(seedInput.value).toBe(String(n));
    expect(getByTestId('procgen-preview-verdict').textContent).toMatch(/^Fully connected/);
  });

  it('a lever row applies its patch through the wizard and says what it changed', () => {
    const { getByRole, getByTestId } = openFragmentedCellular();
    fireEvent.click(getByRole('button', { name: /Find a fix/i }));
    const row = within(getByTestId('layout-remedies')).getByRole('button', { name: /Ensure connected off → on/ });
    fireEvent.click(row);
    expect(getByTestId('procgen-preview-verdict').textContent).toMatch(/^Fully connected/);
    expect(getByTestId('procgen-connect-pass').getAttribute('data-applied')).toBe('true');
  });

  it('WFC at the defaults is told reseeding fails and offered the room band', () => {
    const view = open();
    fireEvent.click(view.getByRole('radio', { name: /Wave Function Collapse/i }));
    fireEvent.click(view.getByRole('button', { name: /Find a fix/i }));
    const panel = view.getByTestId('layout-remedies');
    expect(within(panel).queryAllByRole('button', { name: /^Use seed/ })).toHaveLength(0);
    fireEvent.click(within(panel).getByRole('button', { name: /Room count band 8-15 →/ }));
    expect(view.getByTestId('procgen-preview-verdict').textContent).toMatch(/^Fully connected/);
    const max = view.getByTestId('size-roomCountMax').querySelector('input[type=range]') as HTMLInputElement;
    expect(Number(max.value)).toBeGreaterThan(15);
  });

  it('remedies stay inside the ranges the wizard sliders offer', () => {
    const { getByTestId } = open();
    const range = (id: string) => getByTestId(id).querySelector('input[type=range]') as HTMLInputElement;
    expect([range('size-gridWidth').min, range('size-gridWidth').max, range('size-gridWidth').step])
      .toEqual([String(REMEDY_SLIDER_BOUNDS.grid.min), String(REMEDY_SLIDER_BOUNDS.grid.max), String(REMEDY_SLIDER_BOUNDS.grid.step)]);
    for (const key of ['roomCountMin', 'roomCountMax', 'corridorWidth'] as const) {
      expect([range(`size-${key}`).min, range(`size-${key}`).max])
        .toEqual([String(REMEDY_SLIDER_BOUNDS[key].min), String(REMEDY_SLIDER_BOUNDS[key].max)]);
    }
  });
});

describe('[guard] a connected layout renders as it did', () => {
  it('no Find a fix control, and the preview markup is unchanged by the remedy props', () => {
    const { queryByRole, getByTestId } = open();
    expect(getByTestId('procgen-preview-verdict').textContent).toMatch(/^Fully connected/);
    expect(queryByRole('button', { name: /Find a fix/i })).toBeNull();

    const spec = initialProcgenSpecState().spec;
    const preview = generatePreview(previewConfigFromSpec(spec));
    const algDef = ALGORITHMS[0];
    const plain = render(<LivePreview preview={preview} seed="" algDef={algDef} />).container.innerHTML;
    cleanup();
    const withRemedies = render(
      <LivePreview preview={preview} seed="" algDef={algDef} spec={spec}
        setSeed={vi.fn()} updateSize={vi.fn()} toggleConstraint={vi.fn()} />,
    ).container.innerHTML;
    expect(withRemedies).toBe(plain);
  });
});
