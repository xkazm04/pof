/* eslint-disable no-console -- CLI report; stdout is its interface. */
import {
  MISSILE_BEHAVIOUR_GRAPH_FINDINGS,
  MONSTER_MISSILE_BEHAVIOUR_GRAPH_FINDINGS,
  missileBehaviourGraphsForMonster,
  missileBehaviourGraphsForSpell,
} from '@/lib/catalog/reference/missileBehaviourGraphs';
import { castLedgerFor } from '@/lib/catalog/reference/spellCastLedger';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import { getDb } from '@/lib/db';

const entityId = process.argv[2];
if (!entityId) {
  console.error('usage: npx tsx scripts/diablo/missileGraphs.ts <spell or monster id>');
  process.exit(1);
}

const wrappers = listWrappers(getDb(), { sourceId: 'diablo1' });
const requested = wrappers.find((wrapper) => wrapper.entity.id === entityId
  && (wrapper.file === 'spells/spelldat.tsv'
    || wrapper.file === 'monsters/monstdat.tsv'
    || wrapper.file === 'monsters/unique_monstdat.tsv'));
if (!requested) {
  console.error(`${entityId} was not found as a Diablo I spell or monster wrapper`);
  process.exit(1);
}

if (requested.file === 'spells/spelldat.tsv') {
  const spell = requested.raw.id ?? requested.key;
  console.log(JSON.stringify({
    spellId: entityId,
    spell,
    graphs: missileBehaviourGraphsForSpell(spell),
    kinetics: castLedgerFor(requested, wrappers).missileChain.map((missile) => ({
      missile: missile.missile,
      parent: missile.parent,
      speedAndLifetimeByLevel: missile.kineticsByLevel,
    })),
    findings: MISSILE_BEHAVIOUR_GRAPH_FINDINGS,
  }, null, 2));
} else {
  console.log(JSON.stringify({
    monsterId: entityId,
    routine: requested.raw.ai ?? requested.entity.tags?.[0] ?? null,
    graphs: missileBehaviourGraphsForMonster(requested),
    findings: MONSTER_MISSILE_BEHAVIOUR_GRAPH_FINDINGS,
  }, null, 2));
}
