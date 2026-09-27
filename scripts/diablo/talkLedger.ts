/* eslint-disable no-console -- CLI report; stdout is its interface. */
import {
  D1_TALKING_MONSTER_LEDGERS,
  DIALOG_TREE_TALK_LAYER_GAPS,
  TALK_LEDGER_FINDINGS,
  talkLedgerSummary,
} from '@/lib/catalog/reference/talkLedger';

console.log(JSON.stringify({
  towners: talkLedgerSummary(),
  talkingMonsters: D1_TALKING_MONSTER_LEDGERS.map((ledger) => ({
    monster: ledger.monster,
    quest: ledger.quest,
    initialSpeech: ledger.initialSpeech,
    speechSequence: ledger.speechSequence,
    questFlags: ledger.questFlags.map((flag) => flag.flag),
  })),
  findings: TALK_LEDGER_FINDINGS,
  dialogTreeFieldGaps: DIALOG_TREE_TALK_LAYER_GAPS,
}, null, 2));
