/* eslint-disable no-console -- a terminal CLI outside src/: stdout is its interface (repo law allows console here). */
/**
 * assess-cli.ts - PoF guards over a council run or a quest package (spark `gta-quest-loop`, WP3).
 *
 *   npx tsx games/gtai/quest/assess-cli.ts <runDir>             -> <runDir>/verdicts.json ({ [pathId]: QuestVerdict })
 *   npx tsx games/gtai/quest/assess-cli.ts --package <questDir> -> prints the package verdict; exit 1 when blocked
 *   (`--game-root <dir>`: the game repo whose project/data/tables/quest_rules.json
 *   is the vocabulary; default POF_GAME_ROOT_GTAI, else ../gtai. Exit 1 blocked, 3 vocabulary unmeasured
 *   unless `--allow-unmeasured`.)
 *   npx tsx games/gtai/quest/assess-cli.ts --story-vars         -> the campaign variable vocabulary as JSON (for the brief)
 *
 * Run from the repo root (the loaders default `root` to process.cwd()). Guards are whatever
 * `@/lib/games/gtai-quest` currently implements: an `unmeasured` guard is printed as unmeasured, never green.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  assessQuest,
  claimableBeats,
  PROTECTED_VARS,
  QUEST_VAR_PREFIX,
  type LineJudgeReport,
  type QuestPackage,
  type QuestVerdict,
} from '@/lib/games/gtai-quest';
import { BASELINE_VARIABLES, firstWriterAct } from '@/lib/games/gtai-quest/campaignBaseline';
// The barrel (index.ts, WP0) does not re-export the file loaders, so they come from their module.
import { loadProposals, loadQuestContext } from '@/lib/games/gtai-quest/loadContext';

const GLYPH: Record<string, string> = { green: '[ok]', red: '[RED]', unmeasured: '[--]' };

/** `--game-root <dir>` -> the game repo (absolute), or undefined to let the loader resolve it. */
function gameRootArg(args: string[]): string | undefined {
  const i = args.indexOf('--game-root');
  return i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : undefined;
}

/** Every unplayable verb, condition and tag, one per line, so a red vocabulary guard names its offenders. */
function printVocabulary(v: QuestVerdict): void {
  const g = v.guards.find((x) => x.guard === 'vocabulary');
  if (!g) return;
  if (g.state === 'unmeasured') {
    console.error(`vocabulary: UNMEASURED (${g.basis}); set POF_GAME_ROOT_GTAI or pass --game-root <game repo>. Unmeasured is not a pass.`);
    return;
  }
  for (const f of g.findings) console.error(`vocabulary ${f.severity === 'error' ? 'FAIL' : 'warn'} ${f.code}${f.ref ? ` @ ${f.ref}` : ''}: ${f.message}`);
}

function summary(v: QuestVerdict): string {
  const chips = v.guards.map((g) => `${g.guard} ${GLYPH[g.state] ?? g.state} (${g.findings.length})`).join('  ');
  return `${v.subject}: ${chips}${v.blocked ? `  BLOCKED by ${v.blockedBy.join(', ')}` : ''}`;
}

function readJudge(questDir: string): LineJudgeReport | null {
  const f = path.join(questDir, 'verdicts', 'lines.judge.json');
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8')) as LineJudgeReport;
}

function assessRun(runDir: string, gameRoot?: string): number {
  const root = process.cwd();
  const ctx = loadQuestContext(root, null, gameRoot);
  const proposals = loadProposals(runDir);
  const files = fs.readdirSync(runDir).filter((f) => /^proposals\.[a-z]+\.json$/.test(f));
  if (proposals.length === 0 && files.length > 0) {
    console.error(`assess: the loader returned 0 proposals but ${files.length} proposals file(s) exist (${files.join(', ')}); verdicts.json will be empty until loadProposals reads them`);
  }
  const verdicts: Record<string, QuestVerdict> = {};
  for (const p of proposals) {
    verdicts[p.pathId] = assessQuest(p.pathId, p, ctx);
    console.log(summary(verdicts[p.pathId]));
    printVocabulary(verdicts[p.pathId]);
  }
  fs.writeFileSync(path.join(runDir, 'verdicts.json'), `${JSON.stringify(verdicts, null, 2)}\n`);
  console.log(`verdicts: ${Object.keys(verdicts).length} path(s) -> ${path.join(runDir, 'verdicts.json')}`);
  return 0;
}

function checkPackage(questDir: string, args: string[]): number {
  const gameRoot = gameRootArg(args);
  const file = path.join(questDir, 'quest.json');
  if (!fs.existsSync(file)) {
    console.error(`check: ${file} does not exist`);
    return 2;
  }
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as QuestPackage;
  const ctx = loadQuestContext(process.cwd(), readJudge(questDir), gameRoot);
  const v = assessQuest(pkg.id, pkg, ctx, pkg.overrides ?? [], pkg.id);
  console.log(JSON.stringify(v, null, 2));
  console.log(summary(v));
  printVocabulary(v);
  if (!ctx.judge) console.log('note: no verdicts/lines.judge.json; run `council.mjs judge` before acceptance');
  if (v.blocked) return 1;
  // The check exists to prove the quest is playable; a vocabulary it could not read proves nothing.
  if (v.guards.find((x) => x.guard === 'vocabulary')?.state === 'unmeasured' && !args.includes('--allow-unmeasured')) return 3;
  return 0;
}

/** The story guard's vocabulary, from its own source, so the council brief never hand-copies it. */
function storyVars(): number {
  const variables = BASELINE_VARIABLES.map((v) => ({
    name: v.name,
    doc: v.doc,
    protected: PROTECTED_VARS.includes(v.name),
    writtenByArc: firstWriterAct(v.name),
  }));
  console.log(JSON.stringify({ questVarPrefix: QUEST_VAR_PREFIX, variables, claimableBeats: claimableBeats() }, null, 2));
  return 0;
}

function main(args: string[]): number {
  if (args.includes('--story-vars')) return storyVars();
  const i = args.indexOf('--package');
  if (i >= 0) {
    const dir = args[i + 1];
    if (!dir) {
      console.error('usage: assess-cli.ts --package <questDir>');
      return 2;
    }
    return checkPackage(path.resolve(dir), args);
  }
  const runDir = args.find((a, k) => !a.startsWith('--') && args[k - 1] !== '--game-root');
  if (!runDir || !fs.existsSync(runDir)) {
    console.error('usage: assess-cli.ts <runDir> | --package <questDir>');
    return 2;
  }
  return assessRun(path.resolve(runDir), gameRootArg(args));
}

process.exitCode = main(process.argv.slice(2));
