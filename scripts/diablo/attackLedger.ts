/* eslint-disable no-console -- CLI report; stdout/stderr are its interface. */
import { getDb } from '@/lib/db';
import {
  MONSTER_ATTACK_LEDGER_FINDINGS,
  attackLedgerFor,
} from '@/lib/catalog/reference/monsterAttackLedger';
import { getReferenceSource } from '@/lib/catalog/reference/sources';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const monsterId = process.argv[2];
if (!monsterId) {
  console.error('usage: npx tsx scripts/diablo/attackLedger.ts <monster id>');
  process.exit(2);
}

const source = getReferenceSource('diablo1');
const wrapper = listWrappers(getDb(), { sourceId: source.id, catalogId: 'bestiary' })
  .find((candidate) => candidate.entity.id === monsterId && candidate.file === 'monsters/monstdat.tsv');

if (!wrapper) {
  console.error(`monster ${monsterId} was not found in the Diablo I monstdat wrapper store`);
  process.exit(1);
}

const routine = wrapper.raw.ai ?? wrapper.entity.tags?.[0];
if (!routine) {
  console.error(`monster ${monsterId} has no AI routine`);
  process.exit(1);
}

console.log(JSON.stringify({
  ledger: attackLedgerFor(wrapper, routine),
  findings: MONSTER_ATTACK_LEDGER_FINDINGS,
}, null, 2));
