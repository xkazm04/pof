import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { RollerTab } from '@/components/modules/core-engine/sub_inventory/dna-genome/RollerTab';
import { createGenome } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';

/**
 * scan-sweep inventory-genome-economy: the Affix Roller's Item Level is 1..100 (the
 * input's own min/max). It was parsed as `parseInt(v) || 1`, so a typed -5 or 5000
 * reached the roll engine and the "Scale by Level" pipeline step unclamped.
 */

afterEach(cleanup);

function renderRoller() {
  const setRollLevel = vi.fn();
  render(
    <RollerTab
      selected={createGenome('Probe', ACCENT_VIOLET, {})}
      rollRarity="Rare"
      setRollRarity={() => {}}
      rollLevel={10}
      setRollLevel={setRollLevel}
      rollResult={null}
      doRoll={() => {}}
    />,
  );
  return { input: screen.getByLabelText('Item Level'), setRollLevel };
}

describe('RollerTab item level input', () => {
  it('clamps a typed level into 1..100', () => {
    const { input, setRollLevel } = renderRoller();
    fireEvent.change(input, { target: { value: '5000' } });
    expect(setRollLevel).toHaveBeenLastCalledWith(100);
    fireEvent.change(input, { target: { value: '-5' } });
    expect(setRollLevel).toHaveBeenLastCalledWith(1);
  });

  it('falls back to 1 for a cleared field', () => {
    const { input, setRollLevel } = renderRoller();
    fireEvent.change(input, { target: { value: '' } });
    expect(setRollLevel).toHaveBeenLastCalledWith(1);
  });
});
