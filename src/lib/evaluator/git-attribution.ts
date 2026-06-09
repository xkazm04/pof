/**
 * Git attribution for regression findings — reuses the same `git log` parsing
 * approach as the codebase archeologist to answer "which commit(s) introduced
 * this NEW finding's file since the last scan?".
 *
 * The pure {@link parseAttributionLog} is unit-tested in isolation; the
 * git-spawning {@link attributeFilesSince} is server-only (uses child_process).
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CommitAttribution {
  /** Abbreviated commit hash (e.g. `abc1234`). */
  hash: string;
  /** Commit subject line. */
  subject: string;
  /** Author name. */
  author: string;
  /** Author date, ISO-8601. */
  date: string;
}

/** Map of file path → the commits that touched it in the window. */
export type AttributionMap = Record<string, CommitAttribution[]>;

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * `git log --pretty=format` string. Fields are separated by the ASCII unit
 * separator (`%x1f`) instead of a printable delimiter so commit subjects that
 * contain `|` or other punctuation never corrupt parsing.
 */
export const ATTRIBUTION_FORMAT = '%h%x1f%s%x1f%aN%x1f%aI';

const FIELD_SEP = '\x1f';

/** Parse the stdout of `git log --pretty=format:ATTRIBUTION_FORMAT` into commits. */
export function parseAttributionLog(stdout: string): CommitAttribution[] {
  const commits: CommitAttribution[] = [];
  for (const raw of stdout.split('\n')) {
    const lineStr = raw.trim();
    if (!lineStr) continue;
    const parts = lineStr.split(FIELD_SEP);
    if (parts.length < 4) continue;
    const [hash, subject, author, date] = parts;
    if (!hash) continue;
    commits.push({ hash, subject, author, date });
  }
  return commits;
}

// ─── Orchestration (server-only) ─────────────────────────────────────────────

/** Don't spawn an unbounded number of git processes for a huge scan. */
const MAX_FILES = 40;
const MAX_COMMITS_PER_FILE = 5;
const CONCURRENCY = 8;

/**
 * For each given file, return the commits that touched it since `since` (an
 * ISO-8601 timestamp, typically the previous scan's time). Files not tracked by
 * git, or a missing/failed git, yield no entry rather than throwing.
 */
export async function attributeFilesSince(
  projectPath: string,
  files: string[],
  since: string | null,
): Promise<AttributionMap> {
  const unique = Array.from(new Set(files.filter(Boolean))).slice(0, MAX_FILES);
  const result: AttributionMap = {};

  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (file) => {
        const args = ['log', '-n', String(MAX_COMMITS_PER_FILE), `--pretty=format:${ATTRIBUTION_FORMAT}`];
        if (since) args.push(`--since=${since}`);
        args.push('--', file);
        try {
          const { stdout } = await execFileAsync('git', args, {
            cwd: projectPath,
            maxBuffer: 1024 * 1024,
          });
          const commits = parseAttributionLog(stdout);
          if (commits.length) result[file] = commits;
        } catch {
          // Not a git repo / git unavailable / untracked file — skip silently.
        }
      }),
    );
  }

  return result;
}
