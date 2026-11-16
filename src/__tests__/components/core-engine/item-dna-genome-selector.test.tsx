import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PRESET_GENOMES } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';
import { GenomeSelector } from '@/components/modules/core-engine/sub_inventory/dna-genome/GenomeSelector';

/**
 * scan-sweep inventory-genome-economy: the genome selector marked the active genome
 * only with a tint, border and ring - nothing a screen reader exposes. The Monte
 * Carlo iteration chips already carry aria-pressed; this pins the same here.
 */

afterEach(cleanup);

describe('GenomeSelector selected state', () => {
  it('exposes the selected genome via aria-pressed', () => {
    const [a, b] = PRESET_GENOMES;
    render(<GenomeSelector genomes={PRESET_GENOMES} selectedId={b.id} onSelect={() => {}} />);
    const btn = (name: string) =>
      screen.getAllByRole('button').find((el) => el.textContent?.trim() === name)!;
    expect(btn(b.name).getAttribute('aria-pressed')).toBe('true');
    expect(btn(a.name).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('group', { name: /genome/i })).toBeTruthy();
  });
});
