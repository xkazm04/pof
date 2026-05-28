import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, within } from '@testing-library/react';
import { CheckpointTimeline } from '@/components/modules/core-engine/sub_character/genome/CheckpointTimeline';
import { useGenomeStore } from '@/stores/genomeStore';

afterEach(() => cleanup());

beforeEach(() => {
  globalThis.localStorage.clear();
  return useGenomeStore.persist.rehydrate();
});

function activeGenome() {
  const id = useGenomeStore.getState().genomes[0].id;
  return useGenomeStore.getState().genomes.find((g) => g.id === id)!;
}

describe('<CheckpointTimeline />', () => {
  it('shows the empty state when the genome has no checkpoints', () => {
    const { getByText } = render(<CheckpointTimeline activeGenome={activeGenome()} />);
    expect(getByText(/No checkpoints yet/i)).toBeTruthy();
  });

  it('captures a named checkpoint via the input + button', () => {
    const { getByPlaceholderText, getByRole, getByText } = render(
      <CheckpointTimeline activeGenome={activeGenome()} />,
    );
    const nameInput = getByPlaceholderText(/Checkpoint name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'v1.0 pre-nerf' } });
    fireEvent.click(getByRole('button', { name: /Capture/i }));

    expect(useGenomeStore.getState().checkpoints).toHaveLength(1);
    expect(getByText('v1.0 pre-nerf')).toBeTruthy();
    expect(getByText(/Initial checkpoint/i)).toBeTruthy();
  });

  it('auto-summarises the delta between two checkpoints', () => {
    const g = activeGenome();
    // First checkpoint = baseline.
    useGenomeStore.getState().createCheckpoint(g.id, 'baseline');
    // Bump crit chance by 0.07, then capture a second checkpoint.
    useGenomeStore.getState().updateGenome(g.id, (cur) => ({
      ...cur,
      combat: { ...cur.combat, critChance: cur.combat.critChance + 0.07 },
    }));
    useGenomeStore.getState().createCheckpoint(g.id, 'after-buff');

    const { getByText } = render(<CheckpointTimeline activeGenome={activeGenome()} />);
    // The second checkpoint's auto-summary should mention the Crit Chance delta.
    expect(getByText(/Crit Chance\s+\+7%/i)).toBeTruthy();
    // The baseline retains the "Initial checkpoint" marker.
    expect(getByText(/Initial checkpoint/i)).toBeTruthy();
  });

  it('Restore button rewrites the live genome back to the snapshot', () => {
    const g = activeGenome();
    const originalCrit = g.combat.critChance;
    useGenomeStore.getState().createCheckpoint(g.id, 'baseline');

    useGenomeStore.getState().updateGenome(g.id, (cur) => ({
      ...cur,
      combat: { ...cur.combat, critChance: 0.99 },
    }));
    expect(useGenomeStore.getState().genomes.find((x) => x.id === g.id)!.combat.critChance).toBe(0.99);

    const { getByRole } = render(<CheckpointTimeline activeGenome={activeGenome()} />);
    fireEvent.click(getByRole('button', { name: /Restore/i }));

    expect(useGenomeStore.getState().genomes.find((x) => x.id === g.id)!.combat.critChance).toBe(originalCrit);
  });

  it('Delete removes the checkpoint and leaves an empty timeline', () => {
    const g = activeGenome();
    useGenomeStore.getState().createCheckpoint(g.id, 'gone-soon');
    const { container, getByText } = render(<CheckpointTimeline activeGenome={activeGenome()} />);
    const deleteBtn = container.querySelector('button[aria-label="Delete checkpoint gone-soon"]') as HTMLButtonElement;
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn);
    expect(useGenomeStore.getState().checkpoints).toHaveLength(0);
    expect(getByText(/No checkpoints yet/i)).toBeTruthy();
  });

  it('orders timeline rows newest-first', () => {
    const g = activeGenome();
    const a = useGenomeStore.getState().createCheckpoint(g.id, 'alpha')!;
    // Force a different createdAt so the sort key is unambiguous.
    useGenomeStore.setState((s) => ({
      checkpoints: s.checkpoints.map((c) =>
        c.id === a.id ? { ...c, createdAt: '2024-01-01T00:00:00.000Z' } : c,
      ),
    }));
    useGenomeStore.getState().createCheckpoint(g.id, 'omega');
    useGenomeStore.setState((s) => ({
      checkpoints: s.checkpoints.map((c) =>
        c.name === 'omega' ? { ...c, createdAt: '2024-06-01T00:00:00.000Z' } : c,
      ),
    }));

    const { container } = render(<CheckpointTimeline activeGenome={activeGenome()} />);
    const items = within(container).getAllByRole('listitem');
    // Newest (omega) appears first in the DOM.
    expect(items[0].textContent).toContain('omega');
    expect(items[1].textContent).toContain('alpha');
  });
});
