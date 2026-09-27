/* eslint-disable no-console -- CLI table; stdout is the requested interface. */
import {
  aiPersonality,
  type EvaluatedValue,
} from '@/lib/catalog/reference/aiDecisionGraphs';
import { D1_AI_ROUTINES, type D1AiRoutineId } from '@/lib/catalog/reference/aiRoutines';

const probability = (value: EvaluatedValue): string => value.status === 'evaluated'
  ? `${(value.value * 100).toFixed(1)}%`
  : `unevaluated: ${value.expressions.join(' | ')}`;

const ticks = (value: EvaluatedValue): string => value.status === 'evaluated'
  ? value.value.toFixed(2)
  : `unevaluated: ${value.expressions.join(' | ')}`;

const rows = (Object.keys(D1_AI_ROUTINES) as D1AiRoutineId[]).flatMap((routine) =>
  [0, 1, 2, 3].map((intelligence) => {
    const profile = aiPersonality(routine, intelligence);
    return {
      routine,
      intelligence,
      aggression: probability(profile.aggression),
      approachAtRange: probability(profile.approachRate),
      patienceTicks: ticks(profile.patienceTicks),
    };
  }));

console.log(['routine', 'intelligence', 'aggression', 'approach@range', 'patience(ticks)'].join('\t'));
for (const row of rows) {
  console.log([row.routine, row.intelligence, row.aggression, row.approachAtRange, row.patienceTicks].join('\t'));
}
