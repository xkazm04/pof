/**
 * Fixture quest folders for the `contracts` row tests (spark gta-quest-loop, WP2). Writes ONLY under the
 * temp root a test passes in — never the real `games/` folder.
 */
import fs from 'fs';
import path from 'path';
import type { GuardId, GuardVerdict, QuestPackage, QuestVerdict } from '@/lib/games/gtai-quest/types';

export const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

export function questPackage(id: string, over: Partial<QuestPackage> = {}): QuestPackage {
  return {
    schema: 'gtai.quest/1', id, status: 'building', act: 'act1', title: `Quest ${id}`,
    logline: 'Don Fax wants a fax machine jammed.', goal: 'Introduce Don Fax as a giver.',
    whyNotFiller: 'The laugh: Fax jams himself.',
    characters: [
      { id: 'don-fax', name: 'Don Fax', status: 'existing', role: 'giver' },
      { id: 'clerk-7', name: 'Clerk 7', status: 'new', role: 'target', designNote: 'a stapler on legs' },
    ],
    beats: [{ id: 'b1', title: 'Briefing', summary: 'Fax briefs Rivet.', objective: { verb: 'deliver' }, lineIds: ['l1'] }],
    lines: [{ id: 'l1', speaker: 'don-fax', purpose: ['funny'], text: 'Jam it.', audio: null }],
    mechanics: [],
    reward: { cash: 800, unlocks: [] },
    difficulty: { heatPeak: 1, enemyCount: 4, enemyWaves: 1, timeLimitS: null, failStates: ['clerk escapes'], minutes: 8 },
    story: { reads: [], writes: [{ var: 'q_fax_jam', value: true }] },
    fingerprint: { giver: 'don-fax', coreVerb: 'deliver', newMechanic: null, location: 'office', payoffKind: 'gag' },
    provenance: { sources: [{ pathId: 'claude-A', elements: ['spine'] }], ownerNotes: 'Keep the fax gag.', fusedAt: '2026-11-02' },
    overrides: [],
    ...over,
  };
}

export const write = (root: string, rel: string, body: string | Buffer | object) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
};

/** A complete quest folder: package, its council run, judge report, art and evidence (each switchable). */
export function writeQuest(root: string, id: string, opts: {
  pkg?: object; runId?: string | null; judge?: boolean; art?: boolean; selftest?: string | null; frame?: boolean;
} = {}) {
  const q = `games/gtai/quests/${id}`;
  write(root, `${q}/quest.json`, opts.pkg ?? questPackage(id));
  const runId = opts.runId === undefined ? `20261102-1500-${id}` : opts.runId;
  if (runId) {
    write(root, `games/gtai/quests/_council/${runId}/proposals.claude.json`, []);
    write(root, `games/gtai/quests/_council/${runId}/seats.json`, { claude: { status: 'live' }, grok: { status: 'skipped', reason: 'probe failed' } });
  }
  if (opts.judge !== false) {
    write(root, `${q}/verdicts/lines.judge.json`, {
      schema: 'gtai.lineJudge/1', judgeSeat: 'grok', authorSeat: 'claude', judgedAt: '2026-11-02',
      lines: [{ lineId: 'l1', earned: 4, voiceFit: 4, note: 'ok' }],
    });
  }
  if (opts.art !== false) write(root, `${q}/art/clerk-7-parts.png`, PNG);
  if (opts.selftest !== null && opts.selftest !== undefined) write(root, `${q}/evidence/selftest.json`, { state: opts.selftest });
  if (opts.frame) write(root, `${q}/evidence/frame-000.png`, PNG);
}

const green = (guard: GuardId): GuardVerdict => ({ guard, state: 'green', basis: 'fixture', findings: [] });

/** An injected verdict: every guard green unless overridden by `states`; `blockedBy` follows assessQuest's rule. */
export function verdict(subject: string, states: Partial<Record<GuardId, 'green' | 'red' | 'unmeasured'>> = {}, overridden: GuardId[] = []): QuestVerdict {
  const guards = (['story', 'economy', 'lines', 'uniqueness', 'vocabulary'] as GuardId[]).map((g) => {
    const st = states[g] ?? 'green';
    return st === 'red'
      ? { guard: g, state: st, basis: 'fixture', findings: [{ code: 'FIXTURE_RED', severity: 'error' as const, message: 'red' }] }
      : st === 'unmeasured' ? { guard: g, state: st, basis: 'no table', findings: [] } : green(g);
  });
  const blockedBy = guards.filter((g) => g.state === 'red' && !overridden.includes(g.guard)).map((g) => g.guard);
  return { subject, guards, blockedBy, blocked: blockedBy.length > 0 };
}
