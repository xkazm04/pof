/**
 * GTAI quest-guard fixtures: one CLEAN act1 design (Don Fax gives, 8 lines, writes `q_fax_jam`),
 * one ledger quest it must not collide with, a clean guard context, and `mutate` for one-code mutations.
 */

import { GTAI_CAST } from '@/lib/games/gtai-quest/campaignBaseline';
import { parseQuestRules } from '@/lib/games/gtai-quest/questRules';
import type {
  LineJudgeReport,
  QuestDesign,
  QuestEconomyTable,
  QuestGuardContext,
  QuestLine,
  QuestPackage,
  QuestRules,
} from '@/lib/games/gtai-quest/types';

const line = (id: string, speaker: string, text: string, purpose: QuestLine['purpose'] = ['funny'], when?: string[]): QuestLine =>
  ({ id, speaker, purpose, text, audio: null, ...(when ? { when } : {}) });

export const CLEAN: QuestDesign = {
  act: 'act1',
  title: 'Per My Last Fax',
  logline: 'Don Fax sends Rivet to repossess a toner cartridge from a printer that owes him a ream.',
  goal: 'Introduce Don Fax as a friendly boss whose faxes go somewhere, and teach Gearbox backseat driving.',
  whyNotFiller: 'The paper-jam gag lands, and the fax tray we see being emptied pays off in act 3.',
  characters: [{ id: 'don-fax', name: 'Don Fax', status: 'existing', role: 'giver' }],
  beats: [
    { id: 'the-call', title: 'The call', summary: 'A payphone rings; Don Fax is on the line.', objective: { verb: 'meet', location: 'fax-office' }, lineIds: ['fax-intro-1', 'fax-intro-2'] },
    { id: 'the-run', title: 'The run', summary: 'Grab the cartridge and drive it back.', objective: { verb: 'deliver', target: 'toner cartridge', location: 'fax-office' }, lineIds: ['fax-brief-1', 'gearbox-1', 'rivet-drive-1', 'gearbox-2'] },
    { id: 'the-payoff', title: 'The payoff', summary: 'Don Fax pays, by fax.', objective: { verb: 'deliver', location: 'fax-office' }, lineIds: ['fax-pay-1'] },
  ],
  lines: [
    line('fax-intro-1', 'don-fax', 'PER MY LAST FAX: the toner baron owes me a ream. Collect it. Hold on. Paper jam. FUCK.', ['funny', 'progression']),
    line('fax-intro-2', 'rivet', 'I weld car doors. Welded. Past tense. Everyone I welded with lives in my head now.', ['character']),
    line('fax-brief-1', 'don-fax', 'Bring the cartridge back intact. Last guy brought it back intact-ish. He is a coaster now.', ['funny']),
    line('gearbox-1', 'gearbox', 'Mirrors! Check your mirrors! You have no mirrors, you have a visor and anxiety.', ['funny', 'character']),
    line('rivet-drive-1', 'rivet', 'We are driving. I am driving. One of us is driving.', ['character']),
    line('gearbox-2', 'gearbox', 'Left. Your other left. Do robots have a left? I had a left.', ['funny']),
    line('fax-pay-1', 'don-fax', 'Cartridge received. Payment faxed. Check your fax. You own no fax? Tragic. Faxing my condolences.', ['funny', 'progression']),
    line('fax-bark-1', 'don-fax', 'Cops at my office. Fax them a restraining order. Twice.', ['funny'], ['heat:>=2']),
  ],
  mechanics: [{ id: 'paper-jam-hazard', name: 'Paper jam', status: 'new', home: 'game', summary: 'Fax machines jam and spray toner as a blinding hazard.' }],
  reward: { cash: 1500, unlocks: ['upgrade:gearbox-residue'] },
  difficulty: { heatPeak: 2, enemyCount: 12, enemyWaves: 2, timeLimitS: 90, failStates: ['vehicle destroyed'], minutes: 10 },
  story: { reads: ['soul_gearbox_unlocked'], writes: [{ var: 'q_fax_jam', value: true }] },
  fingerprint: { giver: 'don-fax', coreVerb: 'deliver', newMechanic: 'paper-jam-hazard', location: 'fax-office', payoffKind: 'character-turn' },
};

export const LEDGER_QUEST: QuestPackage = {
  schema: 'gtai.quest/1',
  id: 'witnesses-are-crumbs',
  status: 'built',
  provenance: { sources: [{ pathId: 'claude-A', elements: ['spine'] }], ownerNotes: 'fixture', fusedAt: '2026-11-02' },
  overrides: [],
  act: 'act1',
  title: 'Witnesses Are Crumbs',
  logline: 'Sister Suction wants a crime scene vacuumed, witnesses included.',
  goal: 'Sister Suction gig.',
  whyNotFiller: 'The confession booth is a dust bag.',
  characters: [
    { id: 'sister-suction', name: 'Sister Suction', status: 'existing', role: 'giver' },
    { id: 'dust-bunny', name: 'Dust Bunny', status: 'new', role: 'target', designNote: 'a lint-ball informant on castors' },
  ],
  beats: [{ id: 'sweep', title: 'Sweep', summary: 'Clean the scene.', objective: { verb: 'clean' }, lineIds: ['s1', 's2', 's3', 's4', 's5', 's6'] }],
  lines: [
    line('s1', 'sister-suction', 'Witnesses are crumbs, child. Crumbs go in the bag.'),
    line('s2', 'rivet', 'I came for a job, not a sermon.'),
    line('s3', 'sister-suction', 'The bag is the sermon.'),
    line('s4', 'gearbox', 'Can we leave? The vacuum is looking at me.'),
    line('s5', 'dust-bunny', 'I saw nothing. I am mostly hair.'),
    line('s6', 'sister-suction', 'Bless this mess. Then remove it.'),
  ],
  mechanics: [{ id: 'vacuum-evidence', name: 'Vacuum evidence', status: 'new', home: 'game', summary: 'Suck up evidence.' }],
  reward: { cash: 900, unlocks: [] },
  difficulty: { heatPeak: 1, enemyCount: 6, enemyWaves: 1, timeLimitS: null, failStates: ['witness escapes'], minutes: 8 },
  story: { reads: [], writes: [{ var: 'q_crumbs_swept', value: true }] },
  fingerprint: { giver: 'sister-suction', coreVerb: 'clean', newMechanic: 'vacuum-evidence', location: 'chapel', payoffKind: 'gag' },
};

const row = (cash: [number, number], heat: number, enemies: number, waves: number, minutes: [number, number], timer: boolean) =>
  ({ cash: { min: cash[0], max: cash[1] }, heatCeiling: heat, enemyCount: { max: enemies }, enemyWaves: { max: waves }, minutes: { min: minutes[0], max: minutes[1] }, timerAllowed: timer });

/** Same numbers as `games/gtai/balance/quest-economy.json` r1, copied so tests never read the repo. */
export const ECONOMY: QuestEconomyTable = {
  schema: 'gtai.questEconomy/1',
  revision: 1,
  provisional: true,
  note: 'fixture copy of r1',
  acts: {
    prologue: row([0, 0], 1, 8, 1, [2, 5], false),
    'clock-out': row([0, 300], 2, 15, 3, [5, 15], false),
    act1: row([500, 2500], 3, 25, 3, [6, 14], true),
    act2: row([1500, 5000], 4, 35, 4, [7, 15], true),
    act3: row([3000, 9000], 5, 50, 5, [8, 16], true),
    act4: row([5000, 14000], 6, 65, 6, [8, 18], true),
    finale: row([0, 0], 6, 120, 8, [15, 35], false),
  },
  soulUpgradePrices: [2000, 5000, 10000, 20000],
};

/** A trimmed copy of the runtime's `quest_rules.json` (gtai.quest-rules/2), enough rows to mutate against. */
export const RULES_RAW = {
  schema: 'gtai.quest-rules/2',
  verbs: [
    { id: 'go_to', needs_location: true },
    { id: 'deliver', needs_location: true },
    { id: 'steal', needs_target: true, handler: 'enter_vehicle' },
    { id: 'kill', needs_target: true },
    { id: 'escort', needs_target: true, needs_location: true },
    { id: 'meet', needs_location: true },
    { id: 'sabotage', needs_location: true, needs_encounter: true },
  ],
  conditions: [
    { id: 'soul', values: ['rivet', 'hauler', 'gearbox', 'sentry', 'mop'] },
    { id: 'madness', values: ['lucid', 'crowded', 'choir', 'chorus'] },
    { id: 'weapon', values: ['gloria', 'assault-rifle', 'none'] },
    { id: 'heat', pattern: '^(>=|<=|>|<|==|=)?(\\d+)$' },
  ],
  event_tags: [{ id: 'kill' }, { id: 'wave-start' }, { id: 'boss-intro' }, { id: 'static-whisper-burst' }],
  fail_rules: [
    { id: 'rivet_wasted', groups: [['rivet', 'player'], ['dies', 'destroyed', 'wasted']] },
    { id: 'car_destroyed', groups: [['car', 'van', 'vehicle'], ['destroyed', 'wrecked']] },
    { id: 'target_escapes', groups: [['escape', 'escapes', 'gets away']] },
  ],
};
export const RULES: QuestRules = (() => {
  const r = parseQuestRules(RULES_RAW);
  if (!r.ok) throw new Error(r.error);
  return r.data;
})();

export function ctx(over: Partial<QuestGuardContext> = {}): QuestGuardContext {
  return {
    economy: ECONOMY,
    voiceBibles: new Set(['rivet', 'don-fax', 'gearbox', 'sister-suction', 'dust-bunny']),
    cast: new Set([...GTAI_CAST.map((c) => c.id), 'dust-bunny']),
    ledger: [LEDGER_QUEST],
    judge: null,
    rules: RULES,
    ...over,
  };
}

export const CLEAN_JUDGE: LineJudgeReport = {
  schema: 'gtai.lineJudge/1',
  judgeSeat: 'grok',
  authorSeat: 'claude',
  judgedAt: '2026-11-02',
  lines: CLEAN.lines.map((l) => ({ lineId: l.id, earned: 4, voiceFit: 4, note: 'lands' })),
};

/** A deep copy of CLEAN with `fn` applied (the copy is plain mutable JSON). */
export function mutate(fn: (d: Mutable<QuestDesign>) => void): QuestDesign {
  const d = structuredClone(CLEAN) as Mutable<QuestDesign>;
  fn(d);
  return d as QuestDesign;
}

export type Mutable<T> = T extends readonly (infer U)[] ? Mutable<U>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
