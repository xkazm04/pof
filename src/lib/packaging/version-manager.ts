import { getSetting, setSetting } from '@/lib/db';

const VERSION_KEY = 'build_version';

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

export function parseVersion(str: string): SemanticVersion | null {
  const match = str.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function formatVersion(v: SemanticVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

export function getCurrentVersion(): SemanticVersion {
  const stored = getSetting(VERSION_KEY);
  if (stored) {
    const parsed = parseVersion(stored);
    if (parsed) return parsed;
  }
  // Default starting version
  return { major: 0, minor: 1, patch: 0 };
}

export function setCurrentVersion(v: SemanticVersion): void {
  setSetting(VERSION_KEY, formatVersion(v));
}

export function bumpVersion(type: 'major' | 'minor' | 'patch'): SemanticVersion {
  const current = getCurrentVersion();
  let next: SemanticVersion;

  switch (type) {
    case 'major':
      next = { major: current.major + 1, minor: 0, patch: 0 };
      break;
    case 'minor':
      next = { major: current.major, minor: current.minor + 1, patch: 0 };
      break;
    case 'patch':
      next = { major: current.major, minor: current.minor, patch: current.patch + 1 };
      break;
  }

  setCurrentVersion(next);
  return next;
}

/**
 * Auto-increment patch version on successful build.
 * Returns the new version string.
 */
export function autoIncrementOnSuccess(): string {
  const next = bumpVersion('patch');
  return formatVersion(next);
}
