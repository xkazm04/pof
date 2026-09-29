/**
 * One overseer-verified law (/diablo W75): which missile collisions carry whole-HP damage and which are already in 1/64 HP.
 * Three delegates misread MoveMissileAndCheckMissileCol's trailing booleans as isDamageShifted (W52, W62, W75); the law states
 * the verified call chain so producers and auditors stop re-deriving it. Type-only imports (profileImportCycle.test.ts).
 */
import type { ProjectRule } from '@/lib/catalog/canon/types';

const MISSILES = 'https://github.com/diasurgical/devilutionX/blob/4138a82/Source/missiles.cpp';

export const DIABLO1_DAMAGE_UNITS_LAWS: readonly ProjectRule[] = [{
  id: 'd1-missile-damage-units-law',
  profile: 'diablo1',
  category: 'game',
  scope: 'bestiary',
  title: 'Missile damage units law (engine-derived)',
  body: 'Missile damage units, derived from the engine: moving projectiles (Firebolt, MagmaBall, BloodStar, Arrow, the Acid impact) collide through MoveMissileAndCheckMissileCol with isDamageShifted false, so their roll is whole HP, scaled x64, and a standing shield can block it. Lightning, Flash, Inferno, Fire Wall, Lightning Wall and Acid Puddle segments pass isDamageShifted true: their value is already 1/64 HP and cannot be blocked.',
  refs: [`${MISSILES}#L643-L672`, `${MISSILES}#L1113-L1168`, `${MISSILES}#L3383`, `${MISSILES}#L3442`],
}];
