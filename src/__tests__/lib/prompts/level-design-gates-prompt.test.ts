/**
 * The narrative codegen prompt carries the machine-readable gates.
 *
 * A connection's `requires` and a room's `grants` are what the solvability
 * closure proves; the UE C++ run must receive them as data, not just the prose
 * condition. A document with no gates must produce the prompt it always did —
 * the guard below pins the ROOMS/CONNECTIONS block byte for byte (the
 * `builder-level-design` golden covers the ROOM prompt, not this one).
 */
import { describe, it, expect } from 'vitest';
import { buildNarrativeCodegenPrompt } from '@/lib/prompts/level-design';
import type { LevelDesignDocument, RoomNode } from '@/types/level-design';

const CTX = { projectName: 'Did', projectPath: 'C:/Projects/Did', ueVersion: '5.5' };

const room = (id: string, over: Partial<RoomNode> = {}): RoomNode => ({
  id, name: `Room ${id}`, type: 'combat', description: `The ${id} hall`, encounterDesign: 'Ambush',
  difficulty: 2, pacing: 'rising', x: 0, y: 0, linkedFiles: [], spawnEntries: [], tags: [], ...over,
});

function doc(): LevelDesignDocument {
  return {
    id: 3, name: 'Sunken Crypt', description: 'A flooded crypt', designNarrative: 'Descend.',
    rooms: [
      room('r1', { spawnEntries: [{ id: 's1', enemyClass: 'Skeleton', count: 3, spawnDelay: 0, wave: 1 }] }),
      room('r2'),
      room('r3', { type: 'boss', difficulty: 5, pacing: 'peak' }),
    ],
    connections: [
      { id: 'c1', fromId: 'r1', toId: 'r2', bidirectional: false, condition: 'needs the brass key' },
      { id: 'c2', fromId: 'r2', toId: 'r3', bidirectional: true, condition: '' },
    ],
    difficultyArc: ['r1', 'r2', 'r3'], pacingNotes: 'Rise to the boss.', syncStatus: 'synced',
    syncReport: [], lastGeneratedAt: null, lastCodeHash: null, createdAt: '', updatedAt: '',
  };
}

const block = (prompt: string) => prompt.slice(prompt.indexOf('ROOMS ('), prompt.indexOf('PACING NOTES:'));

describe('narrative codegen prompt — gates as data', () => {
  it('emits [requires: k] on the connection line and Grants: k in the granting room block', () => {
    const d = doc();
    d.connections[0] = { ...d.connections[0], requires: ['brass-key'] };
    d.rooms[0] = { ...d.rooms[0], grants: ['brass-key'] };
    const prompt = buildNarrativeCodegenPrompt(d, CTX);
    expect(prompt).toContain('  - Room r1 -> Room r2 [requires: brass-key] (needs the brass key)\n');
    expect(prompt).toContain('    Spawns: Skeletonx3 W1\n    Grants: brass-key\n');
    // Only the granting room carries a Grants line.
    expect(prompt.match(/Grants:/g)).toHaveLength(1);
  });

  it('[guard] a document with no requires/grants yields today\'s ROOMS/CONNECTIONS block byte for byte', () => {
    const expected = [
      'ROOMS (3):',
      '  - Room r1: combat, difficulty 2, pacing rising',
      '    Description: The r1 hall',
      '    Encounters: Ambush',
      '    Spawns: Skeletonx3 W1',
      '  - Room r2: combat, difficulty 2, pacing rising',
      '    Description: The r2 hall',
      '    Encounters: Ambush',
      '    Spawns: none',
      '  - Room r3: boss, difficulty 5, pacing peak',
      '    Description: The r3 hall',
      '    Encounters: Ambush',
      '    Spawns: none',
      '',
      'CONNECTIONS:',
      '  - Room r1 -> Room r2 (needs the brass key)',
      '  - Room r2 <-> Room r3',
      '',
      '',
    ].join('\n');
    expect(block(buildNarrativeCodegenPrompt(doc(), CTX))).toBe(expected);
    // Empty gate arrays are "no gate", not a new line shape.
    const empty = doc();
    empty.connections[1] = { ...empty.connections[1], requires: [] };
    empty.rooms[1] = { ...empty.rooms[1], grants: [] };
    expect(buildNarrativeCodegenPrompt(empty, CTX)).toBe(buildNarrativeCodegenPrompt(doc(), CTX));
  });
});
