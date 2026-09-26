/* eslint-disable no-console -- CLI stdout is the contract being preserved. */
import { submitStepArtifact } from '@/lib/catalog/headless';
import { seedCharacterCombatSteps } from '@/lib/catalog/reference/combatSeeds';
import { seedBestiarySteps, seedItemSteps, seedSpellSteps, type StepSeed } from '@/lib/catalog/reference/stepSeeds';
import type { ReferenceCaster } from '@/lib/catalog/reference/spellLaw';
import { seedCharacterVendorSteps } from '@/lib/catalog/reference/storeSpecs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { SeedContext } from './types';

export function emitSeeds(seeds: readonly StepSeed[]): void {
  for (const seed of seeds) {
    const result = submitStepArtifact(seed.catalogId, seed.entityId, seed.step, seed.data, []);
    const acceptance = result.acceptance;
    console.log(`${seed.entityId} · ${seed.step}: ${acceptance?.status ?? '?'}${acceptance?.reason ? ` — ${acceptance.reason.slice(0, 150)}` : ''}`);
    for (const gap of seed.gaps) console.log(`    gap: ${gap}`);
  }
}

export function seedGeneric(
  ctx: SeedContext,
  wrappers: readonly ReferenceWrapper[],
  caster?: ReferenceCaster,
): void {
  for (const wrapper of wrappers) {
    if (!ctx.promoted.has(wrapper.entity.id)) {
      ctx.print(`SKIP ${wrapper.entity.id}: not promoted (promote it first)`);
      continue;
    }
    ctx.emit([
      ...seedBestiarySteps(wrapper),
      ...seedItemSteps(wrapper),
      ...seedSpellSteps(wrapper, caster),
      ...seedCharacterCombatSteps(wrapper),
      ...seedCharacterVendorSteps(wrapper.entity),
    ]);
  }
}
