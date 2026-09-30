/* eslint-disable no-console -- CLI report; stdout is its interface. */
import {
  allQuestCausalityLedgers,
  D1_QUEST_CAUSALITY_DEPENDENCIES,
  D1_QUEST_CAUSALITY_SCOPE_FLAGS,
  D1_QUEST_SPEC_CAUSALITY_FINDINGS,
} from '@/lib/catalog/reference/questCausality';

console.log(JSON.stringify({
  scopeFlags: D1_QUEST_CAUSALITY_SCOPE_FLAGS,
  ledgers: allQuestCausalityLedgers(),
  crossQuestDependencies: D1_QUEST_CAUSALITY_DEPENDENCIES,
  questSpecsFindings: D1_QUEST_SPEC_CAUSALITY_FINDINGS,
}, null, 2));
