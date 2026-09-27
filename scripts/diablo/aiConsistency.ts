/* eslint-disable no-console -- CLI report; stdout is its interface. */
import { getDb } from '@/lib/db';
import {
  AI_CONSISTENCY_ROUTINES,
  aiConsistency,
  type AiConsistencyMetric,
  type AiConsistencyReport,
} from '@/lib/catalog/reference/aiConsistency';
import { isD1AiRoutineId, type D1AiRoutineId } from '@/lib/catalog/reference/aiRoutines';
import type { BehaviourInput } from '@/lib/catalog/reference/behaviourScale';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const BASE_FILE = 'monsters/monstdat.tsv';
const UNIQUE_FILE = 'monsters/unique_monstdat.tsv';

interface MonsterProfile {
  label: string;
  routine: string;
  intelligence: number;
  input?: Omit<BehaviourInput, 'ai' | 'intelligence'>;
  gap?: string;
}

const numbers = (value: unknown): number[] | undefined => {
  if (typeof value !== 'string') return undefined;
  const parsed = value.split(',').map((entry) => Number(entry.trim()));
  return parsed.every(Number.isFinite) ? parsed : undefined;
};

const animationInput = (data: Record<string, unknown>): MonsterProfile['input'] => {
  const frames = numbers(data.animFrames);
  const rates = numbers(data.animRates);
  const actionFrame = Number(data.attackActionFrame);
  if (!frames || frames.length < 3 || !rates || rates.length < 3 || !Number.isFinite(actionFrame)) return undefined;
  return {
    walkFrames: frames[1],
    walkRate: rates[1],
    attackFrames: frames[2],
    attackRate: rates[2],
    ...(frames.length > 5 ? { specialAttackFrames: frames[5] } : {}),
    ...(rates.length > 5 ? { specialAttackRate: rates[5] } : {}),
    actionFrame,
  };
};

const monsterProfiles = (wrappers: readonly ReferenceWrapper[]): MonsterProfile[] => {
  const bases = wrappers.filter((wrapper) => wrapper.file === BASE_FILE);
  const baseByType = new Map(bases.map((wrapper) => [wrapper.raw._monster_id, wrapper]));
  return wrappers.map((wrapper) => {
    const unique = wrapper.file === UNIQUE_FILE;
    const base = unique ? baseByType.get(wrapper.raw.type) : wrapper;
    const routine = unique ? wrapper.raw.ai : (wrapper.entity.tags?.[0] ?? wrapper.raw.ai);
    const intelligence = Number(unique ? wrapper.raw.intelligence : wrapper.entity.data.intelligence);
    return {
      label: wrapper.entity.name,
      routine,
      intelligence,
      ...(base ? { input: animationInput(base.entity.data) } : { gap: `no base animation wrapper for ${wrapper.raw.type}` }),
      ...(!Number.isInteger(intelligence) || intelligence < 0 || intelligence > 3 ? { gap: `invalid intelligence ${String(intelligence)}` } : {}),
    };
  });
};

const number = (value: number | null): string => value === null ? 'n/a' : value.toFixed(6);
const metric = (value: AiConsistencyMetric): string[] => [
  number(value.behaviourPerSecond),
  number(value.decisionGraphPerSecond),
  number(value.ratio),
  value.verdict,
  value.reason ?? '',
];

const printReport = (scope: string, sample: string, report: AiConsistencyReport): void => {
  console.log([
    scope,
    sample,
    report.routine,
    report.intelligence,
    ...metric(report.attack),
    ...metric(report.approach),
    report.verdict,
    report.findings.map((finding) => `${finding.incorrectSide}: ${finding.finding} Source: ${finding.sourceRefs.join(', ')} Fix: ${finding.requiredFix}`).join(' | '),
  ].join('\t'));
};

const printGap = (scope: string, sample: string, routine: string, intelligence: number, reason: string): void => {
  console.log([
    scope, sample, routine, intelligence,
    'n/a', 'n/a', 'n/a', 'not-comparable', reason,
    'n/a', 'n/a', 'n/a', 'not-comparable', reason,
    'not-comparable', '',
  ].join('\t'));
};

const wrappers = listWrappers(getDb(), { sourceId: 'diablo1', catalogId: 'bestiary' })
  .filter((wrapper) => wrapper.file === BASE_FILE || wrapper.file === UNIQUE_FILE);
const profiles = monsterProfiles(wrappers);

console.log([
  'scope', 'sample', 'routine', 'intelligence',
  'attack.w34/s', 'attack.w44/s', 'attack.ratio(w44/w34)', 'attack.verdict', 'attack.reason',
  'approach.w34/s', 'approach.w44/s', 'approach.ratio(w44/w34)', 'approach.verdict', 'approach.reason',
  'verdict', 'source finding / required fix',
].join('\t'));

for (const routine of AI_CONSISTENCY_ROUTINES) {
  const representative = profiles.find((profile) => profile.routine === routine && profile.input);
  for (const intelligence of [0, 1, 2, 3]) {
    if (!representative?.input) {
      printGap('routine-grid', representative?.label ?? '(no bestiary sample)', routine, intelligence, 'no bestiary animation data for this routine');
      continue;
    }
    printReport('routine-grid', representative.label, aiConsistency({ ...representative.input, ai: routine, intelligence }));
  }
}

for (const profile of profiles) {
  if (profile.gap || !profile.input || !isD1AiRoutineId(profile.routine)) {
    printGap('monster-real', profile.label, profile.routine, profile.intelligence, profile.gap ?? `unknown AI routine ${profile.routine}`);
    continue;
  }
  printReport('monster-real', profile.label, aiConsistency({
    ...profile.input,
    ai: profile.routine as D1AiRoutineId,
    intelligence: profile.intelligence,
  }));
}
