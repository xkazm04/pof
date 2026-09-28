import { getDb, getSetting, setSetting } from '@/lib/db';
import { normalizeProjectId } from '@/lib/project-id';
import { getVersionsInScope } from './build-history-store';

// ---------- Version authority ----------
//
// A release version is a PER-PROJECT projection of build_history, not one global counter.
// Every build_history read is project-scoped (own rows + the unattributed legacy rows), so
// the version is too: a project's CURRENT version is the highest semver over every
// versioned row in its scope, WHATEVER the row's status — a build condemned by a later
// smoke test keeps (burns) its number, and a burned number is never reissued.
//
// A bump is an INTENT for the next green cook (`build_version_next:<projectId>`), relative
// to the current version: minor after 0.1.2 means "the next green cook is 0.2.0", and
// pressing it twice still means 0.2.0. The intent is consumed by the build that takes it.
//
// The unscoped `''` caller keeps the legacy global counter (`build_version`) exactly as
// before. Every assignment also advances that key to max(stored, assigned), so reverting
// to the global counter resumes above every number already issued.

const VERSION_KEY = 'build_version';
const NEXT_KEY_PREFIX = 'build_version_next:';

export type BumpType = 'major' | 'minor' | 'patch';

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

const DEFAULT_VERSION: SemanticVersion = { major: 0, minor: 1, patch: 0 };

export function parseVersion(str: string): SemanticVersion | null {
  const match = str.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function formatVersion(v: SemanticVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

export function compareVersions(a: SemanticVersion, b: SemanticVersion): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/** Pure: the version `type` above `v`. */
export function applyBump(v: SemanticVersion, type: BumpType): SemanticVersion {
  switch (type) {
    case 'major': return { major: v.major + 1, minor: 0, patch: 0 };
    case 'minor': return { major: v.major, minor: v.minor + 1, patch: 0 };
    case 'patch': return { major: v.major, minor: v.minor, patch: v.patch + 1 };
  }
}

/** The legacy global counter — the unscoped (`''`) caller's current version. */
export function getCurrentVersion(): SemanticVersion {
  const stored = getSetting(VERSION_KEY);
  if (stored) {
    const parsed = parseVersion(stored);
    if (parsed) return parsed;
  }
  return DEFAULT_VERSION;
}

export function setCurrentVersion(v: SemanticVersion): void {
  setSetting(VERSION_KEY, formatVersion(v));
}

/** Current version of a project: the max semver over every versioned row in its scope. */
export function currentVersionFor(projectPath?: string | null): SemanticVersion {
  const pid = normalizeProjectId(projectPath);
  if (!pid) return getCurrentVersion();
  let max: SemanticVersion | null = null;
  for (const raw of getVersionsInScope(pid)) {
    const v = parseVersion(raw);
    if (v && (!max || compareVersions(v, max) > 0)) max = v;
  }
  return max ?? DEFAULT_VERSION;
}

const intentKey = (pid: string) => `${NEXT_KEY_PREFIX}${pid}`;

/** A pending bump intent, only while it is still ahead of the current version. */
function pendingIntent(pid: string, current: SemanticVersion): SemanticVersion | null {
  const raw = getSetting(intentKey(pid));
  const v = raw ? parseVersion(raw) : null;
  return v && compareVersions(v, current) > 0 ? v : null;
}

/** What the next green cook of this project will be recorded as. Read-only. */
export function nextVersionFor(projectPath?: string | null): SemanticVersion {
  const pid = normalizeProjectId(projectPath);
  const current = currentVersionFor(pid);
  return pendingIntent(pid, current) ?? applyBump(current, 'patch');
}

/** Set the next green cook of this project to `type` above its current version. */
export function bumpIntent(
  projectPath: string | null | undefined,
  type: BumpType,
): { current: SemanticVersion; next: SemanticVersion } {
  const pid = normalizeProjectId(projectPath);
  const current = currentVersionFor(pid);
  const next = applyBump(current, type);
  setSetting(intentKey(pid), formatVersion(next));
  return { current, next };
}

/**
 * Take the next version for a green build of this project: consumes a pending bump
 * intent and advances the legacy key to max(stored, assigned). Synchronous — the caller
 * inserts the row with no await in between, so assignment is atomic in-process.
 */
export function autoIncrementOnSuccess(projectPath?: string | null): string {
  const pid = normalizeProjectId(projectPath);
  const next = nextVersionFor(pid);
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(intentKey(pid));
  if (compareVersions(next, getCurrentVersion()) > 0) setCurrentVersion(next);
  return formatVersion(next);
}
