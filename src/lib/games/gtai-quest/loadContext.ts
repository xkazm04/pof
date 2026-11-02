import type { LineJudgeReport, QuestGuardContext, QuestPackage, QuestProposal } from '@/lib/games/gtai-quest/types';

/**
 * STUB (WP0) — WP1 implements. File-backed loaders (server/CLI only; guards stay pure).
 * `root` = repo root (default `process.cwd()`); reads `games/gtai/{balance/quest-economy.json, voices/*.md,
 * quests/<id>/quest.json}`. Folders starting with `_` under `quests/` are never ledger quests.
 */
export function loadLedger(root?: string): QuestPackage[] {
  void root;
  return [];
}

/** Context for assessing `selfId` (excluded from nothing here; uniqueness skips it by id). */
export function loadQuestContext(root?: string, judge: LineJudgeReport | null = null): QuestGuardContext {
  void root;
  return { economy: null, voiceBibles: new Set(), cast: new Set(), ledger: [], judge };
}

/** A council run's proposals: `<runDir>/proposals.<seat>.json` (each an array of 2). */
export function loadProposals(runDir: string): QuestProposal[] {
  void runDir;
  return [];
}
