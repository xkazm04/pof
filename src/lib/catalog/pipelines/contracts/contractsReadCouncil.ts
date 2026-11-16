/**
 * SERVER-ONLY (fs). The Council slice of a quest's snapshot: which council run produced it, which seats
 * ran, and the paths it offered. Never imported by the pipeline file (it would drag fs into the lab bundle).
 *
 * `gtai.quest/1` records the fused paths (`provenance.sources[].pathId`) but NOT the run id, and path ids
 * (`claude-A`) repeat across runs. So the run is `declared` when the package carries `provenance.runId`
 * (read leniently — see the WP2 report's counter-proposal), else `inferred` only when EXACTLY ONE run under
 * `games/gtai/quests/_council/` holds every source path. Two or more candidates is ambiguous and names no run.
 */
import fs from 'fs';
import path from 'path';
import { loadProposals } from '@/lib/games/gtai-quest/loadContext';
import { COUNCIL_REL, type CouncilFacts } from '@/lib/catalog/pipelines/contracts/contractsSnapshot';
import { parseSeats } from '@/lib/catalog/pipelines/contracts/contractsParse';
import { logger } from '@/lib/logger';

const seatOf = (pathId: string) => pathId.split('-')[0];

/** Absent and corrupt are different states: only a present file that fails to parse carries an `error`. */
function readSeatsFile(file: string): { value: unknown; error?: string } {
  if (!fs.existsSync(file)) return { value: null };
  try {
    return { value: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Proposals of a run, `[]` when unreadable (the loader is WP1's; a throw is logged, never fatal). */
function proposalsOf(runDir: string) {
  try {
    return loadProposals(runDir);
  } catch (e) {
    logger.warn(`contracts: loadProposals(${runDir}) threw — ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

/** Does this run hold every source path? A seat's proposals file must exist; parsed ids must include it. */
function holdsSources(runDir: string, sources: readonly string[]): boolean {
  if (!sources.length) return false;
  const ids = new Set(proposalsOf(runDir).map((p) => p.pathId));
  return sources.every((id) => fs.existsSync(path.join(runDir, `proposals.${seatOf(id)}.json`)) && (ids.size === 0 || ids.has(id)));
}

export function readCouncilFacts(root: string, sources: readonly string[], declared: string | null): CouncilFacts {
  const councilAbs = path.join(root, COUNCIL_REL);
  let runId: string | null = null;
  let runIdBasis: CouncilFacts['runIdBasis'] = 'none';
  let candidates: string[] = [];
  if (declared) {
    runId = declared;
    runIdBasis = 'declared';
    candidates = [declared];
  } else if (fs.existsSync(councilAbs)) {
    candidates = fs.readdirSync(councilAbs, { withFileTypes: true })
      .filter((d) => d.isDirectory() && holdsSources(path.join(councilAbs, d.name), sources))
      .map((d) => d.name)
      .sort();
    if (candidates.length === 1) {
      runId = candidates[0];
      runIdBasis = 'inferred';
    }
  }
  // A run id names ONE folder under _council/. A declared id is package data: `..`, `.` or a
  // separator would resolve outside it (or to _council itself), and the folder would "exist".
  const inCouncil = !!runId && runId !== '.' && runId !== '..' && !/[\\/]/.test(runId);
  const runAbs = runId && inCouncil ? path.join(councilAbs, runId) : null;
  const runDirExists = !!runAbs && fs.existsSync(runAbs) && fs.statSync(runAbs).isDirectory();
  const seatsRead = runDirExists ? readSeatsFile(path.join(runAbs!, 'seats.json')) : { value: null };
  return {
    runId,
    runIdBasis,
    candidates,
    runDir: runId ? `${COUNCIL_REL}/${runId}` : null,
    runDirExists,
    seats: parseSeats(seatsRead.value),
    ...(seatsRead.error ? { seatsError: seatsRead.error } : {}),
    paths: runDirExists ? proposalsOf(runAbs!).map((p) => ({ pathId: p.pathId, title: p.title })) : [],
    sources,
  };
}
