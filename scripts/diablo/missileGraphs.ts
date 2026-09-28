/* eslint-disable no-console -- CLI report; stdout is its interface. */
import {
  MISSILE_BEHAVIOUR_GRAPH_FINDINGS,
  missileBehaviourGraphsForSpell,
} from '@/lib/catalog/reference/missileBehaviourGraphs';
import { castLedgerFor } from '@/lib/catalog/reference/spellCastLedger';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import { getDb } from '@/lib/db';

const spellId = process.argv[2];
if (!spellId) {
  console.error('usage: npx tsx scripts/diablo/missileGraphs.ts <spell id>');
  process.exit(1);
}

const wrappers = listWrappers(getDb(), { sourceId: 'diablo1' });
const requested = wrappers.find((wrapper) => wrapper.file === 'spells/spelldat.tsv'
  && wrapper.entity.id === spellId);
if (!requested) {
  console.error(`spell ${spellId} was not found in the Diablo I spelldat wrapper store`);
  process.exit(1);
}

const spell = requested.raw.id ?? requested.key;
console.log(JSON.stringify({
  spellId,
  spell,
  graphs: missileBehaviourGraphsForSpell(spell),
  kinetics: castLedgerFor(requested, wrappers).missileChain.map((missile) => ({
    missile: missile.missile,
    parent: missile.parent,
    speedAndLifetimeByLevel: missile.kineticsByLevel,
  })),
  findings: MISSILE_BEHAVIOUR_GRAPH_FINDINGS,
}, null, 2));
