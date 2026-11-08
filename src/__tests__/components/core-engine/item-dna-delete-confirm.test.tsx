import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { EditorTab } from '@/components/modules/core-engine/sub_inventory/dna-genome/EditorTab';
import { LibraryTab } from '@/components/modules/core-engine/sub_inventory/dna-genome/LibraryTab';
import { createGenome } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';

/**
 * scan-sweep inventory-genome-economy: genome delete hits a persisted store with no
 * undo, so every delete site (EditorTab, LibraryTab grid card, LibraryTab lineage row)
 * opens a ConfirmDialog first; cancelling keeps the genome.
 */

afterEach(cleanup);

const custom = createGenome('Custom One', ACCENT_VIOLET, {});
const bred = { ...createGenome('Bred One', ACCENT_VIOLET, {}), parents: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] } as typeof custom;

function renderLibrary(onDelete: (id: string) => void) {
  render(
    <LibraryTab
      genomes={[custom, bred]}
      selectedId={custom.id}
      onSelect={() => {}}
      onDuplicate={() => {}}
      onDelete={onDelete}
      onResetPresets={() => {}}
    />,
  );
}

describe('genome delete confirmation', () => {
  it('EditorTab: click opens a dialog, cancel keeps, confirm deletes', () => {
    const onDelete = vi.fn();
    render(
      <EditorTab selected={custom} radarData={[]} genomeCount={3}
        updateGenome={() => {}} updateTrait={() => {}} deleteGenome={onDelete} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delete genome custom one/i }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /delete genome custom one/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onDelete).toHaveBeenCalledWith(custom.id);
  });

  it('LibraryTab: grid card and lineage row both confirm before deleting', () => {
    const onDelete = vi.fn();
    renderLibrary(onDelete);
    const triggers = screen.getAllByRole('button', { name: /^delete$/i });
    expect(triggers).toHaveLength(2);
    for (const t of triggers) {
      fireEvent.click(t);
      expect(onDelete).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      expect(onDelete).not.toHaveBeenCalled();
    }
    fireEvent.click(triggers[1]);
    const confirm = screen.getAllByRole('button', { name: /^delete$/i }).find((b) => b.closest('[role="dialog"]'))!;
    fireEvent.click(confirm);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
