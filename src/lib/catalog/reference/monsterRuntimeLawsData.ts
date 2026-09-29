/** Engine-derived Diablo I monster runtime rules. No reference-table rows are copied here. */
import type { ProjectRule } from '@/lib/catalog/canon/types';

const MONSTER_SOURCE = 'https://github.com/diasurgical/devilutionX/blob/4138a82/Source/monster.cpp';

export const DIABLO1_MONSTER_RUNTIME_LAWS: readonly ProjectRule[] = [
  {
    id: 'd1-monster-targeting-law',
    profile: 'diablo1',
    category: 'game',
    scope: 'bestiary',
    title: 'Monster targeting refresh law (engine-derived)',
    body: "Monster targeting refresh, derived from the engine: each ProcessMonsters tick copies a targeted player's current future tile into enemyPosition even while the monster's tile is unseen; position.last is copied only while visible. Distance, line and SEARCH tests use enemyPosition, but most routines STEER toward position.last (GetDirection to position.last), so movement follows the last-seen tile while decisions use the live one.",
    refs: [`${MONSTER_SOURCE}#L1815-L1885`, `${MONSTER_SOURCE}#L4257-L4333`],
  },
  {
    id: 'd1-monster-animation-timing-law',
    profile: 'diablo1',
    category: 'game',
    scope: 'bestiary',
    title: 'Monster animation timing law (engine-derived)',
    body: "Monster animation timing, derived from the engine: action markers are one-based data checked as zero-based currentFrame == marker - 1. Normal and ranged starts flag same-tick processing; mode checks run before the end-of-tick advance and finish when the last frame is already active. Use the animation's ticks-per-frame and this ordering—frameCount/tickRate and actionFrame/tickRate are not valid timings.",
    refs: [`${MONSTER_SOURCE}#L653-L656`, `${MONSTER_SOURCE}#L823-L865`, `${MONSTER_SOURCE}#L1271-L1373`, `${MONSTER_SOURCE}#L4321-L4333`],
  },
  {
    id: 'd1-special-attack-floor-law',
    profile: 'diablo1',
    category: 'game',
    scope: 'bestiary',
    title: 'Zero-stat special attack floor law (engine-derived)',
    body: "Zero-stat special attacks, derived from the engine: a SpecialMeleeAttack resolves only if its special animation marker is positive (it checks currentFrame == marker - 1; with marker 0 no hit ever resolves). When it resolves, special to-hit 0 and damage 0-0 still pass the player to-hit floor of 15% (20/25/30% on levels 14/15/16) and the 1-HP damage floor; a Rhino-type collision resolves special damage 0-0 at to-hit 500.",
    refs: [`${MONSTER_SOURCE}#L1160-L1225`, `${MONSTER_SOURCE}#L1362-L1373`, `${MONSTER_SOURCE}#L4580-L4623`],
  },
];
