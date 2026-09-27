/** Pin-verified player-spell collision topology; imports stay type-only by canon-data policy. */
import type { PlayerSpellHitSource } from '@/lib/catalog/reference/playerSpellHits';

const missile = (lines: string): string => `.reference/devilutionX/Source/missiles.cpp:${lines}`;
const spell = (lines: string): string => `.reference/devilutionX/Source/spells.cpp:${lines}`;

export const PLAYER_SPELL_HIT_SOURCES_DATA = [
  {
    spell: 'Lightning', kind: 'lightning-segment', targetPaths: 'one',
    collisionChecks: 'floor(S/2)+6 per segment', damageRoll: 'once-per-segment',
    collisionDamage: 'already-shifted-fixed-point', hitResult: 'persists-and-rechecks',
    stationaryGeometry: 'Exactly one child segment occupies a stationary monster tile on the aimed path.',
    refs: [missile('808-850'), missile('1999-2025'), missile('3359-3391')],
  },
  {
    spell: 'ChainLightning', kind: 'lightning-segment', targetPaths: 'direct-plus-radius',
    collisionChecks: 'floor(S/2)+6 per segment; the selected target receives two segments within radius min(S+3,18)',
    damageRoll: 'once-per-segment', collisionDamage: 'already-shifted-fixed-point',
    hitResult: 'persists-and-rechecks',
    stationaryGeometry: 'The direct path always targets the selected monster; the radius fan-out adds a second path when it covers that tile.',
    refs: [missile('808-850'), missile('2236-2241'), missile('3359-3391'), missile('3585-3604')],
  },
  {
    spell: 'Flash', kind: 'adjacent-persistent', collisionChecks: '19 on one covered adjacent tile',
    damageRoll: 'once-per-child', collisionDamage: 'already-shifted-fixed-point',
    hitResult: 'persists-and-rechecks',
    stationaryGeometry: 'FlashBottom and FlashTop cover disjoint offsets, so one adjacent monster is checked by exactly one child.',
    refs: [missile('2125-2159'), missile('3425-3478')],
  },
  {
    spell: 'FireWall', kind: 'wall-segment', collisionChecks: '160*(S+1) on one ordinary segment',
    damageRoll: 'once-per-segment', collisionDamage: 'already-shifted-fixed-point',
    hitResult: 'persists-and-rechecks',
    stationaryGeometry: 'The targeted center or an ordinary wall segment covers the monster; gap-fill segments only check walking actors.',
    refs: [missile('742-786'), missile('1961-1975'), missile('3065-3097'), missile('3775-3840')],
  },
  {
    spell: 'Fireball', kind: 'impact-and-blast', collisionChecks: 'one flight check, then one blast check only after a successful direct impact',
    damageRoll: 'once-per-cast', collisionDamage: 'whole-hit-points',
    hitResult: 'flight-becomes-one-shot-blast',
    stationaryGeometry: 'The monster occupies the direct impact tile; a missed flight check does not terminate there and therefore does not blast that tile.',
    refs: [missile('1977-1997'), missile('3099-3166')],
  },
  {
    spell: 'Guardian', kind: 'guardian-volley', collisionChecks: 'ceil(max(30,16*min(S+floor(C/2),30))/16) one-check Firebolts',
    damageRoll: 'once-per-projectile', collisionDamage: 'whole-hit-points',
    hitResult: 'child-deleted-on-hit',
    stationaryGeometry: 'One line-clear monster within the radius-6 arc remains the sole target at every 16-tick firing opportunity.',
    refs: [missile('715-740'), missile('2188-2234'), missile('2976-3026'), missile('3514-3583')],
  },
  {
    spell: 'FlameWave', kind: 'moving-piercing-ray', collisionChecks: 'one per segment path crossing',
    damageRoll: 'once-per-segment', collisionDamage: 'whole-hit-points',
    hitResult: 'persists-without-rechecking-target',
    stationaryGeometry: 'One moving wave segment crosses the stationary monster once; restoring the duration lets it continue to later tiles.',
    refs: [missile('2177-2186'), missile('3480-3512'), missile('3878-3907')],
  },
  {
    spell: 'Nova', kind: 'nova-ray', collisionChecks: 'one ray check, or two on a duplicated cardinal ray',
    damageRoll: 'once-per-cast', collisionDamage: 'whole-hit-points',
    hitResult: 'persists-without-rechecking-target',
    stationaryGeometry: 'A monster stays on one unobstructed emitted ray; the four cardinal directions each have two coincident balls.',
    refs: [missile('1951-1959'), missile('2572-2586'), missile('3028-3046'), missile('3285-3317')],
  },
  {
    spell: 'Inferno', kind: 'targeted-segment', collisionChecks: 'target tiles 1/2/3 receive 20/25/30 checks respectively',
    damageRoll: 'once-per-segment', collisionDamage: 'already-shifted-fixed-point',
    hitResult: 'persists-and-rechecks',
    stationaryGeometry: 'Only the one child segment occupying the stationary monster tile checks it; the controller creates at most three tiles.',
    refs: [missile('2672-2700'), missile('3940-3990')],
  },
  {
    spell: 'Apocalypse', kind: 'until-first-hit', collisionChecks: 'ApocalypseBoom animation length, stopping after the first successful check',
    damageRoll: 'once-per-cast', collisionDamage: 'whole-hit-points',
    hitResult: 'stops-damaging-after-hit',
    stationaryGeometry: 'The scan creates one boom on the stationary monster tile; its sprite animation length supplies the maximum retry count.',
    refs: [missile('2455-2460'), missile('2657-2670'), missile('3726-3736'), missile('3853-3876'), spell('211-233')],
  },
] as const satisfies readonly PlayerSpellHitSource[];
