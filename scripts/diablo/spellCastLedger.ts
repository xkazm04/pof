/* eslint-disable no-console -- CLI report; stdout is its interface. */
import {
  SPELL_CAST_LEDGER_FINDINGS,
  allSpellCastLedgers,
  auditInstantiatedSpellCastLedger,
  castLedgerFor,
} from '@/lib/catalog/reference/spellCastLedger';
import { getDb } from '@/lib/db';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const spellId = process.argv[2];
if (spellId) {
  const wrappers = listWrappers(getDb(), { sourceId: 'diablo1' });
  const spellRows = wrappers.filter((wrapper) => wrapper.file === 'spells/spelldat.tsv');
  const requested = spellRows.find((wrapper) => wrapper.entity.id === spellId);
  if (!requested) {
    console.error(`spell ${spellId} was not found in the Diablo I spelldat wrapper store`);
    process.exit(1);
  }
  const crossCheckSpells = new Set(['Firebolt', 'Fireball', 'ChainLightning', 'FireWall', 'Healing']);
  const checked = spellRows
    .filter((wrapper) => crossCheckSpells.has(wrapper.raw.id ?? wrapper.key))
    .map((wrapper) => castLedgerFor(wrapper, wrappers));
  const findings = checked.flatMap(auditInstantiatedSpellCastLedger);
  console.log(JSON.stringify({
    ledger: castLedgerFor(requested, wrappers),
    crossCheck: { spells: checked.map((ledger) => ledger.spell), findings },
    genericFindings: SPELL_CAST_LEDGER_FINDINGS,
  }, null, 2));
  process.exit(0);
}

const ledgers = allSpellCastLedgers();
console.log(JSON.stringify({
  summary: {
    spells: ledgers.length,
    findings: SPELL_CAST_LEDGER_FINDINGS.length,
  },
  findings: SPELL_CAST_LEDGER_FINDINGS,
  ledgers,
}, null, 2));
