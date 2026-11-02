import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@/lib/logger';
import { GTAI_CAST } from '@/lib/games/gtai-quest/campaignBaseline';
import { QUEST_ECONOMY_SCHEMA, QUEST_SCHEMA } from '@/lib/games/gtai-quest/types';
import type {
  CouncilSeat,
  LineJudgeReport,
  QuestEconomyTable,
  QuestGuardContext,
  QuestPackage,
  QuestProposal,
} from '@/lib/games/gtai-quest/types';

/**
 * File-backed loaders (server/CLI only; guards stay pure). Plain node fs, no `server-only`, so the
 * council and runtime scripts can import them under `npx tsx`.
 * `root` = repo root (default `process.cwd()`); reads `games/gtai/{balance/quest-economy.json, voices/*.md,
 * quests/<id>/quest.json}`. Folders starting with `_` under `quests/` are never ledger quests.
 * Nothing here throws on bad input: an unreadable file is logged and skipped, a missing one is absent.
 */

const gtai = (root: string, ...parts: string[]): string => path.join(root, 'games', 'gtai', ...parts);

function readJson(file: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function loadLedger(root: string = process.cwd()): QuestPackage[] {
  const dir = gtai(root, 'quests');
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: QuestPackage[] = [];
  for (const e of entries.filter((d) => d.isDirectory() && !d.name.startsWith('_')).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const file = path.join(dir, e.name, 'quest.json');
    if (!fs.existsSync(file)) continue;
    const r = readJson(file);
    if (!r.ok) { logger.warn(`[gtai-quest] skipping ${file}: ${r.error}`); continue; }
    if (!isObject(r.value) || r.value.schema !== QUEST_SCHEMA || typeof r.value.id !== 'string') {
      logger.warn(`[gtai-quest] skipping ${file}: not a ${QUEST_SCHEMA} package with an id`);
      continue;
    }
    out.push(r.value as unknown as QuestPackage);
  }
  return out;
}

function loadEconomy(root: string): QuestEconomyTable | null {
  const file = gtai(root, 'balance', 'quest-economy.json');
  if (!fs.existsSync(file)) return null;
  const r = readJson(file);
  if (!r.ok || !isObject(r.value) || r.value.schema !== QUEST_ECONOMY_SCHEMA) {
    logger.warn(`[gtai-quest] economy table unreadable (${file}); economy is unmeasured`);
    return null;
  }
  return r.value as unknown as QuestEconomyTable;
}

function loadVoiceBibles(root: string): Set<string> {
  try {
    return new Set(fs.readdirSync(gtai(root, 'voices')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)));
  } catch {
    return new Set();
  }
}

/** Context for assessing a quest (uniqueness skips the subject by id; nothing is excluded here). */
export function loadQuestContext(root: string = process.cwd(), judge: LineJudgeReport | null = null): QuestGuardContext {
  const ledger = loadLedger(root);
  const cast = new Set<string>(GTAI_CAST.map((c) => c.id));
  for (const p of ledger) for (const c of p.characters ?? []) cast.add(c.id);
  return { economy: loadEconomy(root), voiceBibles: loadVoiceBibles(root), cast, ledger, judge };
}

const SEATS: readonly CouncilSeat[] = ['claude', 'grok'];

/** A council run's proposals: `<runDir>/proposals.<seat>.json` (each an array of 2). A missing or
 *  unreadable file means that seat produced nothing. */
export function loadProposals(runDir: string): QuestProposal[] {
  const out: QuestProposal[] = [];
  for (const seat of SEATS) {
    const file = path.join(runDir, `proposals.${seat}.json`);
    if (!fs.existsSync(file)) continue;
    const r = readJson(file);
    if (!r.ok || !Array.isArray(r.value)) {
      logger.warn(`[gtai-quest] ${file}: ${r.ok ? 'not an array' : r.error}; seat ${seat} produced nothing`);
      continue;
    }
    for (const p of r.value) if (isObject(p)) out.push(p as unknown as QuestProposal);
  }
  return out;
}
