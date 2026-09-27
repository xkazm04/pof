/* eslint-disable no-console -- CLI report; stdout is its interface. */
import {
  SPELL_CAST_LEDGER_FINDINGS,
  allSpellCastLedgers,
} from '@/lib/catalog/reference/spellCastLedger';

const ledgers = allSpellCastLedgers();
console.log(JSON.stringify({
  summary: {
    spells: ledgers.length,
    findings: SPELL_CAST_LEDGER_FINDINGS.length,
  },
  findings: SPELL_CAST_LEDGER_FINDINGS,
  ledgers,
}, null, 2));
