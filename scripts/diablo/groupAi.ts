/* eslint-disable no-console -- CLI report; stdout is its interface. */
import {
  GROUP_AI_LEDGER,
  GROUP_AI_ROUTINE_IDS,
  auditGroupAiLedger,
  groupAiForRoutine,
} from '@/lib/catalog/reference/groupAiLedger';

const auditIssues = auditGroupAiLedger();

console.log(JSON.stringify({
  summary: {
    relationStates: GROUP_AI_LEDGER.relations.length,
    inheritanceRules: GROUP_AI_LEDGER.inheritance.length,
    events: GROUP_AI_LEDGER.events.length,
    routineUses: GROUP_AI_LEDGER.routines.length,
    attachedAiRoutines: GROUP_AI_ROUTINE_IDS.filter((routine) => groupAiForRoutine(routine) !== undefined).length,
    findings: GROUP_AI_LEDGER.findings.length,
    packConsequences: GROUP_AI_LEDGER.packConsequences.length,
    auditIssues: auditIssues.length,
  },
  auditIssues,
  ledger: GROUP_AI_LEDGER,
}, null, 2));
