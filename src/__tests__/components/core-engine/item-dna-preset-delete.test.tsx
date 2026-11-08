import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { EditorTab } from '@/components/modules/core-engine/sub_inventory/dna-genome/EditorTab';
import { createGenome } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';

/**
 * scan-sweep inventory-genome-economy: presets are sticky - itemGenomeStore.deleteGenome
 * returns early for isPreset, and LibraryTab hides Delete on presets. EditorTab showed
 * its Delete button on a preset whenever 2+ custom genomes existed, so the click was a
 * silent no-op.
 */

afterEach(cleanup);

function renderWith(isPreset: boolean) {
  const genome = { ...createGenome('Probe', ACCENT_VIOLET, {}), isPreset: isPreset || undefined };
  render(
    <EditorTab
      selected={genome}
      radarData={[]}
      genomeCount={3}
      updateGenome={() => {}}
      updateTrait={() => {}}
      deleteGenome={() => {}}
    />,
  );
}

describe('EditorTab delete on a preset', () => {
  it('offers no Delete for a preset the store will refuse to delete', () => {
    renderWith(true);
    expect(screen.queryByRole('button', { name: /delete genome/i })).toBeNull();
  });

  it('still offers Delete for a custom genome', () => {
    renderWith(false);
    expect(screen.queryByRole('button', { name: /delete genome/i })).not.toBeNull();
  });
});
