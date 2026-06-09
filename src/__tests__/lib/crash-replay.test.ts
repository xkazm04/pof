import { describe, it, expect } from 'vitest';
import { orderCallstackForReplay, findCulpritPos } from '@/lib/crash-analyzer/crash-replay';
import type { CallstackFrame } from '@/types/crash-analyzer';

function frame(index: number, fn: string, isGame: boolean, isCrash = false): CallstackFrame {
  return {
    index,
    address: `0x000000000000${index}`,
    moduleName: isGame ? 'UnrealEditor-MyGame' : 'UnrealEditor-Engine',
    functionName: fn,
    sourceFile: isGame ? 'Game.cpp' : null,
    lineNumber: isGame ? 100 + index : null,
    isGameCode: isGame,
    isCrashOrigin: isCrash,
  };
}

// index 0 = deepest crash point, index 3 = outermost entry. The culprit (top
// game-code frame) is index 1.
const STACK: CallstackFrame[] = [
  frame(0, 'Engine::AssertFailed', false),
  frame(1, 'Game::ActivateAbility', true, true),
  frame(2, 'Game::HandleInput', true),
  frame(3, 'Engine::ProcessInput', false),
];

describe('orderCallstackForReplay', () => {
  it('orders entry (highest index) → crash (index 0), left to right', () => {
    const ordered = orderCallstackForReplay(STACK);
    expect(ordered.map((f) => f.index)).toEqual([3, 2, 1, 0]);
    expect(ordered.map((f) => f.pos)).toEqual([0, 1, 2, 3]);
  });

  it('is robust to an unsorted input callstack', () => {
    const shuffled = [STACK[2], STACK[0], STACK[3], STACK[1]];
    const ordered = orderCallstackForReplay(shuffled);
    expect(ordered.map((f) => f.index)).toEqual([3, 2, 1, 0]);
  });

  it('does not mutate the input array', () => {
    const copy = [...STACK];
    orderCallstackForReplay(STACK);
    expect(STACK).toEqual(copy);
  });

  it('returns an empty array for an empty callstack', () => {
    expect(orderCallstackForReplay([])).toEqual([]);
  });
});

describe('findCulpritPos', () => {
  it('returns the position of the isCrashOrigin frame', () => {
    const ordered = orderCallstackForReplay(STACK);
    // index 1 lands at pos 2 in the entry→crash ordering.
    expect(findCulpritPos(ordered)).toBe(2);
    expect(ordered[2].isCrashOrigin).toBe(true);
  });

  it('falls back to the deepest game-code frame when no origin is flagged', () => {
    const noOrigin = STACK.map((f) => ({ ...f, isCrashOrigin: false }));
    const ordered = orderCallstackForReplay(noOrigin);
    // Deepest game frame is index 1 → pos 2 (closest to the crash point).
    expect(findCulpritPos(ordered)).toBe(2);
    expect(ordered[2].isGameCode).toBe(true);
  });

  it('falls back to the last frame when there is no game code at all', () => {
    const engineOnly = orderCallstackForReplay([
      frame(0, 'Engine::A', false),
      frame(1, 'Engine::B', false),
    ]);
    expect(findCulpritPos(engineOnly)).toBe(1);
  });

  it('returns 0 for an empty timeline', () => {
    expect(findCulpritPos([])).toBe(0);
  });
});
