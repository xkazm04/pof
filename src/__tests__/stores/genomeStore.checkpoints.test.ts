import { describe, it, expect, beforeEach } from 'vitest';
import { useGenomeStore, createGenome } from '@/stores/genomeStore';
import { ACCENT_ORANGE } from '@/lib/chart-colors';
import type { CharacterGenome } from '@/types/character-genome';
import type { GenomeCheckpoint } from '@/types/genome-checkpoint';

const STORAGE_KEY = 'pof-genomes';

function rehydrate() {
  return useGenomeStore.persist.rehydrate();
}

function writePersisted(payload: unknown) {
  globalThis.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state: payload, version: 0 }),
  );
}

/** Ensure at least one genome exists in the store and return its id. */
async function seedActiveGenome(): Promise<string> {
  await rehydrate();
  return useGenomeStore.getState().genomes[0].id;
}

describe('useGenomeStore — checkpoints', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('captures a named checkpoint that snapshots the active genome', async () => {
    const genomeId = await seedActiveGenome();
    const cp = useGenomeStore.getState().createCheckpoint(genomeId, 'v1.0 pre-nerf');
    expect(cp).not.toBeNull();
    const checkpoints = useGenomeStore.getState().checkpoints;
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0].name).toBe('v1.0 pre-nerf');
    expect(checkpoints[0].genomeId).toBe(genomeId);
    expect(checkpoints[0].snapshot.id).toBe(genomeId);
  });

  it('refuses to create a checkpoint with a blank name or orphan genomeId', async () => {
    const genomeId = await seedActiveGenome();
    expect(useGenomeStore.getState().createCheckpoint(genomeId, '   ')).toBeNull();
    expect(useGenomeStore.getState().createCheckpoint('not-a-real-id', 'foo')).toBeNull();
    expect(useGenomeStore.getState().checkpoints).toHaveLength(0);
  });

  it('captures an immutable snapshot — edits after capture do not mutate the checkpoint', async () => {
    const genomeId = await seedActiveGenome();
    useGenomeStore.getState().createCheckpoint(genomeId, 'baseline');
    const snapshotBefore = useGenomeStore.getState().checkpoints[0].snapshot.combat.critChance;

    useGenomeStore.getState().updateGenome(genomeId, (g) => ({
      ...g,
      combat: { ...g.combat, critChance: g.combat.critChance + 0.5 },
    }));

    const snapshotAfter = useGenomeStore.getState().checkpoints[0].snapshot.combat.critChance;
    expect(snapshotAfter).toBe(snapshotBefore);
  });

  it('restoreCheckpoint rewrites the active genome to the snapshot, preserving id', async () => {
    const genomeId = await seedActiveGenome();
    const originalCrit = useGenomeStore.getState().genomes.find((g) => g.id === genomeId)!.combat.critChance;
    useGenomeStore.getState().createCheckpoint(genomeId, 'baseline');

    // Mutate then restore
    useGenomeStore.getState().updateGenome(genomeId, (g) => ({
      ...g,
      combat: { ...g.combat, critChance: 0.99 },
    }));
    expect(useGenomeStore.getState().genomes.find((g) => g.id === genomeId)!.combat.critChance).toBe(0.99);

    const cpId = useGenomeStore.getState().checkpoints[0].id;
    useGenomeStore.getState().restoreCheckpoint(cpId);

    const restored = useGenomeStore.getState().genomes.find((g) => g.id === genomeId)!;
    expect(restored.combat.critChance).toBe(originalCrit);
    // id is preserved — same genome identity, not a new entry
    expect(restored.id).toBe(genomeId);
    expect(useGenomeStore.getState().genomes.filter((g) => g.id === genomeId)).toHaveLength(1);
  });

  it('renameCheckpoint trims and ignores blank input', async () => {
    const genomeId = await seedActiveGenome();
    const cp = useGenomeStore.getState().createCheckpoint(genomeId, 'old name')!;
    useGenomeStore.getState().renameCheckpoint(cp.id, '   ');
    expect(useGenomeStore.getState().checkpoints[0].name).toBe('old name');
    useGenomeStore.getState().renameCheckpoint(cp.id, '  new name  ');
    expect(useGenomeStore.getState().checkpoints[0].name).toBe('new name');
  });

  it('deleteCheckpoint removes only the targeted entry', async () => {
    const genomeId = await seedActiveGenome();
    const a = useGenomeStore.getState().createCheckpoint(genomeId, 'a')!;
    useGenomeStore.getState().createCheckpoint(genomeId, 'b');
    expect(useGenomeStore.getState().checkpoints).toHaveLength(2);
    useGenomeStore.getState().deleteCheckpoint(a.id);
    const after = useGenomeStore.getState().checkpoints;
    expect(after).toHaveLength(1);
    expect(after[0].name).toBe('b');
  });

  it('deleting a genome cascades to its checkpoints but leaves siblings alone', async () => {
    await rehydrate();
    const genomeA = useGenomeStore.getState().genomes[0];
    // Add a second genome so deleteGenome is allowed.
    const fresh = createGenome('Sibling', ACCENT_ORANGE);
    useGenomeStore.getState().addGenome(fresh);

    useGenomeStore.getState().createCheckpoint(genomeA.id, 'keep-on-A');
    useGenomeStore.getState().createCheckpoint(fresh.id, 'drop-with-fresh');

    useGenomeStore.getState().deleteGenome(fresh.id);

    const checkpoints = useGenomeStore.getState().checkpoints;
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0].genomeId).toBe(genomeA.id);
    expect(checkpoints[0].name).toBe('keep-on-A');
  });

  it('round-trips checkpoints through persist + rehydrate', async () => {
    const genomeId = await seedActiveGenome();
    useGenomeStore.getState().createCheckpoint(genomeId, 'persisted-cp', 'a note');
    // Force another rehydrate; merge fn should re-import the checkpoint.
    await rehydrate();
    const after = useGenomeStore.getState().checkpoints;
    expect(after).toHaveLength(1);
    expect(after[0].name).toBe('persisted-cp');
    expect(after[0].note).toBe('a note');
    expect(after[0].snapshot.id).toBe(genomeId);
  });

  it('drops persisted checkpoints whose genomeId no longer exists', async () => {
    const genomeId = await seedActiveGenome();
    const validSnapshot: CharacterGenome = JSON.parse(
      JSON.stringify(useGenomeStore.getState().genomes.find((g) => g.id === genomeId)!),
    );

    const orphan: GenomeCheckpoint = {
      id: 'orphan-cp',
      genomeId: 'ghost-genome-id',
      name: 'orphan',
      createdAt: new Date().toISOString(),
      snapshot: { ...validSnapshot, id: 'ghost-genome-id' },
    };
    const valid: GenomeCheckpoint = {
      id: 'valid-cp',
      genomeId,
      name: 'valid',
      createdAt: new Date().toISOString(),
      snapshot: validSnapshot,
    };

    writePersisted({
      genomes: useGenomeStore.getState().genomes,
      activeId: genomeId,
      compareIds: [],
      checkpoints: [orphan, valid, { id: 'broken' /* missing fields */ }],
    });
    await rehydrate();
    const after = useGenomeStore.getState().checkpoints;
    expect(after.map((c) => c.id)).toEqual(['valid-cp']);
  });

  it('restoreCheckpoint is a no-op for an unknown id', async () => {
    const genomeId = await seedActiveGenome();
    const before = JSON.stringify(useGenomeStore.getState().genomes.find((g) => g.id === genomeId));
    useGenomeStore.getState().restoreCheckpoint('does-not-exist');
    const after = JSON.stringify(useGenomeStore.getState().genomes.find((g) => g.id === genomeId));
    expect(after).toBe(before);
  });
});
