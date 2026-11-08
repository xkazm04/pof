/**
 * Stored spawn rows are valid: count and wave are positive whole numbers.
 *
 * The bound is applied when the field is left (blur), never per keystroke, so
 * typing "12" is not altered mid-entry.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SpawnEntriesPanel } from '@/components/modules/content/level-design/RoomDetailPanel/SpawnEntriesPanel';
import type { SpawnEntry } from '@/types/level-design';

afterEach(cleanup);

const entry = (over: Partial<SpawnEntry> = {}): SpawnEntry =>
  ({ id: 's1', enemyClass: 'BP_Enemy', count: 3, spawnDelay: 0, wave: 1, ...over });

function setup(entries: SpawnEntry[]) {
  const updateSpawn = vi.fn();
  const onFlush = vi.fn();
  const view = render(
    <SpawnEntriesPanel
      spawnEntries={entries} showSpawns setShowSpawns={() => {}} addSpawnEntry={() => {}}
      updateSpawn={updateSpawn} removeSpawn={() => {}} onFlush={onFlush}
    />,
  );
  return { view, updateSpawn, onFlush };
}

describe('spawn count and wave bounds', () => {
  it('a cleared count (0) is committed as 1 on blur', () => {
    const { view, updateSpawn } = setup([entry({ count: 0 })]);
    fireEvent.blur(view.getByLabelText('Spawn 1 count'));
    expect(updateSpawn).toHaveBeenCalledWith('s1', { count: 1 }, 'commit');
  });

  it('a negative wave is committed as 1 on blur', () => {
    const { view, updateSpawn } = setup([entry({ wave: -4 })]);
    fireEvent.blur(view.getByLabelText('Spawn 1 wave'));
    expect(updateSpawn).toHaveBeenCalledWith('s1', { wave: 1 }, 'commit');
  });

  it('typing is not altered mid-entry, and a valid value just flushes', () => {
    const { view, updateSpawn, onFlush } = setup([entry({ count: 12 })]);
    const input = view.getByLabelText('Spawn 1 count');
    fireEvent.change(input, { target: { value: '0' } });
    expect(updateSpawn).toHaveBeenLastCalledWith('s1', { count: 0 }, 'debounce');
    updateSpawn.mockClear();
    fireEvent.blur(input);
    expect(updateSpawn).not.toHaveBeenCalled();
    expect(onFlush).toHaveBeenCalledTimes(1);
  });
});
