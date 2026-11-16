import { describe, it, expect } from 'vitest';
import { DEBUG_COMMANDS } from '@/components/modules/core-engine/sub_debug/_shared/data';

/**
 * scan-sweep night 2026-11-08 (debug-performance, copy-auditor): the Debug tab's
 * copyable command list named godmode/give/setlevel/spawn/killall, none of which
 * the UE project registers. The fixture below is the Exec UFUNCTION list of
 * Source/PoF/Debug/ARPGCheatManager.h (the truth lives in the UE repo, so it is
 * pinned here); every listed command's head must be in it.
 */
const REGISTERED_EXEC = [
  'ARPGGod', 'ARPGSetLevel', 'ARPGGiveXP', 'ARPGHeal',
  'ARPGKillAll', 'ARPGSpawnEnemy', 'ARPGDamageTarget', 'ARPGShowStats',
];

describe('DEBUG_COMMANDS', () => {
  it('every listed command is a registered Exec command', () => {
    for (const c of DEBUG_COMMANDS) {
      expect(REGISTERED_EXEC, c.syntax).toContain(c.syntax.split(' ')[0]);
    }
  });

  it('lists each registered Exec command exactly once', () => {
    const heads = DEBUG_COMMANDS.map((c) => c.syntax.split(' ')[0]).sort();
    expect(heads).toEqual([...REGISTERED_EXEC].sort());
  });
});
