/**
 * SERVER-ONLY (fs). Reads one quest package folder into a `ContractSnapshot` — the derivation every
 * `contracts` step grades. Nothing here grades; it measures what is on disk and runs the wire contract's
 * `assessQuest` over `loadQuestContext()` (WP1). `root` is the repo root (`resolveGamesRoot()`; tests
 * point `POF_GAMES_ROOT` at a temp dir).
 *
 * Layout read (all under `games/gtai/quests/<id>/`): `quest.json`, `verdicts/lines.judge.json`,
 * `art/<characterId>*` (a file, or a non-empty folder), `evidence/selftest.json` + `evidence/*.png`.
 */
import fs from 'fs';
import path from 'path';
import { assessQuest } from '@/lib/games/gtai-quest/assess';
import { loadQuestContext } from '@/lib/games/gtai-quest/loadContext';
import type { LineJudgeReport, QuestPackage } from '@/lib/games/gtai-quest/types';
import { declaredRunId, parseLineJudge, parseQuestPackage, parseSelftest } from '@/lib/catalog/pipelines/contracts/contractsParse';
import { readCouncilFacts } from '@/lib/catalog/pipelines/contracts/contractsReadCouncil';
import {
  CONTRACT_SNAPSHOT_SCHEMA, QUESTS_REL, questDirRel,
  type ContractSnapshot, type GuardsFacts, type InGameFacts, type JudgeFacts, type PackageFacts, type PlanFacts,
} from '@/lib/catalog/pipelines/contracts/contractsSnapshot';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const str = (v: unknown) => (typeof v === 'string' ? v : '');

function readJsonFile(file: string): { present: boolean; value: unknown; error?: string } {
  if (!fs.existsSync(file)) return { present: false, value: null };
  try {
    return { present: true, value: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) {
    return { present: true, value: null, error: `unreadable JSON: ${errText(e)}` };
  }
}

/** Every quest folder id: directories under `games/gtai/quests/` not starting with `_` or `.`. Sorted. */
export function listQuestIds(root: string): string[] {
  const dir = path.join(root, QUESTS_REL);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();
}

function planFacts(raw: unknown, parsed: QuestPackage | null, error?: string): PlanFacts {
  const r = (raw ?? {}) as Record<string, unknown>;
  const prov = (r.provenance ?? {}) as Record<string, unknown>;
  const list = <T>(v: unknown, f: (x: Record<string, unknown>) => T): T[] =>
    Array.isArray(v) ? v.filter((x) => x && typeof x === 'object').map((x) => f(x as Record<string, unknown>)) : [];
  return {
    parsed: !!parsed,
    ...(error ? { error } : {}),
    title: str(r.title), act: str(r.act), status: str(r.status),
    logline: str(r.logline), goal: str(r.goal), whyNotFiller: str(r.whyNotFiller), ownerNotes: str(prov.ownerNotes),
    beats: list(r.beats, (b) => ({ id: str(b.id), title: str(b.title), summary: str(b.summary) })),
    autosavePoints: list(r.autosavePoints, (a) => ({ id: str(a.id), beat: str(a.beat), at: str(a.at), why: str(a.why) })),
    characters: list(r.characters, (c) => ({ id: str(c.id), name: str(c.name), status: str(c.status), role: str(c.role) })),
  };
}

function judgeFacts(root: string, questId: string): { facts: JudgeFacts; report: LineJudgeReport | null } {
  const rel = `${questDirRel(questId)}/verdicts/lines.judge.json`;
  const read = readJsonFile(path.join(root, rel));
  if (!read.present) return { facts: { present: false, path: rel }, report: null };
  if (read.error) return { facts: { present: true, path: rel, error: read.error }, report: null };
  const parsed = parseLineJudge(read.value);
  if (!parsed.ok) return { facts: { present: true, path: rel, error: parsed.error }, report: null };
  const j = parsed.data;
  return {
    facts: { present: true, path: rel, judgeSeat: j.judgeSeat, authorSeat: j.authorSeat, judgedLines: j.lines.length, judgedAt: j.judgedAt },
    report: j,
  };
}

function guardsFacts(root: string, pkg: QuestPackage | null, judge: { facts: JudgeFacts; report: LineJudgeReport | null }): GuardsFacts {
  if (!pkg) return { verdict: null, overrides: [], judge: judge.facts };
  try {
    const verdict = assessQuest(pkg.id, pkg, loadQuestContext(root, judge.report), pkg.overrides, pkg.id, pkg.provenance.fusedAt);
    return { verdict, overrides: pkg.overrides, judge: judge.facts };
  } catch (e) {
    return { verdict: null, overrides: pkg.overrides, judge: judge.facts, error: `assessQuest threw: ${errText(e)}` };
  }
}

/** `<questDir>/art/` entries for one character: `<id>` exactly or `<id>` + `.`/`-`/`_`; a folder counts when non-empty. */
function artFor(root: string, questId: string, characterId: string): string[] {
  const rel = `${questDirRel(questId)}/art`;
  const dir = path.join(root, rel);
  if (!characterId || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.name === characterId || (d.name.startsWith(characterId) && '.-_'.includes(d.name[characterId.length])))
    .filter((d) => d.isFile() || (d.isDirectory() && fs.readdirSync(path.join(dir, d.name)).length > 0))
    .map((d) => `${rel}/${d.name}`)
    .sort();
}

function packageFacts(root: string, pkg: QuestPackage | null): PackageFacts {
  if (!pkg) return { parsed: false, newCharacters: [], lines: { total: 0, reserved: 0, recorded: 0, unreserved: [] } };
  const lines = pkg.lines as unknown as readonly (Record<string, unknown> & { id: string })[];
  const reserved = lines.filter((l) => 'audio' in l && (l.audio === null || typeof l.audio === 'object'));
  return {
    parsed: true,
    newCharacters: pkg.characters.filter((c) => c.status === 'new').map((c) => ({ id: c.id, name: c.name, art: artFor(root, pkg.id, c.id) })),
    lines: {
      total: lines.length,
      reserved: reserved.length,
      recorded: reserved.filter((l) => l.audio !== null).length,
      unreserved: lines.filter((l) => !reserved.includes(l)).map((l) => l.id),
    },
  };
}

function inGameFacts(root: string, questId: string): InGameFacts {
  const evRel = `${questDirRel(questId)}/evidence`;
  const evAbs = path.join(root, evRel);
  const selftestRel = `${evRel}/selftest.json`;
  const read = readJsonFile(path.join(root, selftestRel));
  const parsed = read.present && !read.error ? parseSelftest(read.value) : null;
  const frames = fs.existsSync(evAbs)
    ? fs.readdirSync(evAbs).filter((n) => n.toLowerCase().endsWith('.png')).filter((n) => {
      const fd = fs.openSync(path.join(evAbs, n), 'r');
      try {
        const head = Buffer.alloc(8);
        return fs.readSync(fd, head, 0, 8, 0) === 8 && head.equals(PNG_SIGNATURE);
      } finally {
        fs.closeSync(fd);
      }
    }).sort().map((n) => `${evRel}/${n}`)
    : [];
  const error = read.error ?? (parsed && !parsed.ok ? parsed.error : undefined);
  return {
    engine: 'godot',
    selftest: {
      present: read.present,
      path: selftestRel,
      state: parsed?.ok ? parsed.data.state : null,
      ...(parsed?.ok && parsed.data.frame ? { frame: `${evRel}/${parsed.data.frame}` } : {}),
      ...(error ? { error } : {}),
    },
    frames,
  };
}

/** Measure one quest folder. Never throws for a malformed package: the parse error is part of the snapshot. */
export function readQuestSnapshot(root: string, questId: string, now: Date = new Date()): ContractSnapshot {
  const questDir = questDirRel(questId);
  const read = readJsonFile(path.join(root, questDir, 'quest.json'));
  const parsed = !read.present
    ? { ok: false as const, error: `${questDir}/quest.json is missing` }
    : read.error ? { ok: false as const, error: `quest.json: ${read.error}` } : parseQuestPackage(read.value, questId);
  const pkg = parsed.ok ? parsed.data : null;
  const rawSources = (read.value as { provenance?: { sources?: unknown } } | null)?.provenance?.sources;
  const sources = Array.isArray(rawSources)
    ? rawSources.map((s) => str((s as { pathId?: unknown } | null)?.pathId)).filter(Boolean)
    : [];
  const judge = judgeFacts(root, questId);
  return {
    schema: CONTRACT_SNAPSHOT_SCHEMA,
    source: 'quest-folder',
    questId,
    questDir,
    derivedAt: now.toISOString(),
    council: readCouncilFacts(root, sources, declaredRunId(read.value)),
    plan: planFacts(read.value, pkg, parsed.ok ? undefined : parsed.error),
    guards: guardsFacts(root, pkg, judge),
    package: packageFacts(root, pkg),
    inGame: inGameFacts(root, questId),
  };
}
