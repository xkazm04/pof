import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@/lib/logger';
import { GTAI_CAST } from '@/lib/games/gtai-quest/campaignBaseline';
import { parseQuestRules } from '@/lib/games/gtai-quest/questRules';
import { gameRootFor } from '@/lib/games/gameRoot';
import { QUEST_ECONOMY_SCHEMA, QUEST_SCHEMA } from '@/lib/games/gtai-quest/types';
import type {
  CouncilSeat,
  LineJudgeReport,
  QuestEconomyTable,
  QuestGuardContext,
  QuestPackage,
  QuestProposal,
  QuestRules,
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

/** Where the runtime keeps its quest vocabulary, inside the game repo. */
export const QUEST_RULES_PATH = ['project', 'data', 'tables', 'quest_rules.json'] as const;

/**
 * The runtime's vocabulary from `<gameRoot>/project/data/tables/quest_rules.json`, or `null` (and a logged
 * reason) when the root is unresolved, the file is missing, or it is not `gtai.quest-rules/2`. Never throws:
 * `null` makes the vocabulary guard `unmeasured`, which the pipeline reads as "not yet", never as green.
 */
export function loadQuestRules(gameRoot: string | null): QuestRules | null {
  if (gameRoot === null) return null;
  const file = path.join(gameRoot, ...QUEST_RULES_PATH);
  if (!fs.existsSync(file)) { logger.warn(`[gtai-quest] no ${file}; the vocabulary guard is unmeasured`); return null; }
  const r = readJson(file);
  if (!r.ok) { logger.warn(`[gtai-quest] ${file} unreadable (${r.error}); the vocabulary guard is unmeasured`); return null; }
  const parsed = parseQuestRules(r.value);
  if (!parsed.ok) { logger.warn(`[gtai-quest] ${file}: ${parsed.error}; the vocabulary guard is unmeasured`); return null; }
  return parsed.data;
}

/**
 * Context for assessing a quest (uniqueness skips the subject by id; nothing is excluded here).
 * `gameRoot`: the game repo (`undefined` = resolve it via `gameRootFor('gtai')`: `POF_GAME_ROOT_GTAI`, else
 * `engine.root` against `root`; `null` = none). It only feeds the vocabulary guard.
 */
export function loadQuestContext(
  root: string = process.cwd(),
  judge: LineJudgeReport | null = null,
  gameRoot?: string | null,
): QuestGuardContext {
  const ledger = loadLedger(root);
  const cast = new Set<string>(GTAI_CAST.map((c) => c.id));
  for (const p of ledger) for (const c of p.characters ?? []) cast.add(c.id);
  const rules = loadQuestRules(gameRoot === undefined ? gameRootFor('gtai', { repoRoot: root }) : gameRoot);
  return { economy: loadEconomy(root), voiceBibles: loadVoiceBibles(root), cast, ledger, judge, rules };
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
