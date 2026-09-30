/**
 * Start Fresh plan — the pure preflight of a new UE project before the clicked
 * Create & Launch. It shares Build Health's target-name rule (BUILD_TARGET_NAME_RE)
 * plus UE's own project-name rules (leading letter, <= 20 chars) and refuses
 * Windows device names; it keeps the project a direct child of the resolved root;
 * it blocks a collision with anything already in that root (case-insensitive:
 * Windows); and it FAILS CLOSED when the root could not be listed — an unread
 * root is never "no collision". Engine availability is advisory only.
 *
 * Client-safe (no Node imports). Writes nothing: the project is scaffolded only
 * by the clicked Create Project CLI task.
 */
import { BUILD_TARGET_NAME_RE } from '@/lib/ue5-bridge/build-run';
import { toolRow, type DetectedEngine } from '@/lib/project-setup/toolchain';

/** UE's New Project dialog refuses longer project names. */
export const MAX_PROJECT_NAME_LENGTH = 20;

/** Where a fresh project goes, under the user's real home directory. */
export function projectsRootFrom(home: string): string {
  return `${home.replace(/[\\/]+$/, '')}\\Documents\\Unreal Projects`;
}

export interface RootEntry { name: string; path: string; hasUProject: boolean }

export type PlanIssueCode =
  | 'empty' | 'escapes-root' | 'not-an-identifier' | 'starts-with-digit' | 'too-long' | 'reserved-name'
  | 'project-exists' | 'folder-exists' | 'root-unreadable' | 'root-pending';

export interface PlanIssue { code: PlanIssueCode; message: string; openExisting?: { path: string; name: string } }

export type PlanAdvisoryCode = 'engine-not-installed' | 'no-engine' | 'engines-unknown';

export interface PlanAdvisory {
  code: PlanAdvisoryCode;
  message: string;
  suggestedVersion?: string;
  install?: { url: string; label: string };
}

export interface NewProjectPlanInput {
  name: string;
  /** The resolved projects root, or null while unresolved / unreadable. */
  root: string | null;
  /** The root's directory entries, or null when they were not read. Never defaulted to []. */
  entries: readonly RootEntry[] | null;
  /** Why the root could not be resolved or listed. */
  rootError?: string | null;
  ueVersion: string;
  /** Installed engines, or null when detection failed. */
  engines: readonly DetectedEngine[] | null;
}

export interface NewProjectPlan {
  canCreate: boolean;
  /** Set only when canCreate. */
  projectPath: string | null;
  identifier: string;
  issues: PlanIssue[];
  advisories: PlanAdvisory[];
  /** A buildable name close to the typed one, when the name itself is the blocker. */
  suggestion?: string;
}

const RESERVED_RE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
const NAME_CODES: ReadonlySet<PlanIssueCode> = new Set(['escapes-root', 'not-an-identifier', 'starts-with-digit', 'too-long', 'reserved-name']);

/** The name's own blockers (empty when the name is a buildable UE project name). */
export function nameIssues(id: string): PlanIssue[] {
  if (!id) return [{ code: 'empty', message: 'Enter a project name' }];
  const issues: PlanIssue[] = [];
  if (/[\\/:]/.test(id) || id === '.' || id === '..') {
    issues.push({ code: 'escapes-root', message: 'The name must be a single folder inside the projects root' });
  }
  if (!BUILD_TARGET_NAME_RE.test(id)) {
    issues.push({ code: 'not-an-identifier', message: 'UE project names are letters, digits and _ only (no spaces, dashes or dots)' });
  } else if (!/^[A-Za-z]/.test(id)) {
    issues.push(/^[0-9]/.test(id)
      ? { code: 'starts-with-digit', message: 'UE project names must start with a letter' }
      : { code: 'not-an-identifier', message: 'UE project names must start with a letter' });
  }
  if (id.length > MAX_PROJECT_NAME_LENGTH) {
    issues.push({ code: 'too-long', message: `UE project names are at most ${MAX_PROJECT_NAME_LENGTH} characters` });
  }
  if (RESERVED_RE.test(id)) issues.push({ code: 'reserved-name', message: `"${id}" is a reserved Windows device name` });
  return issues;
}

/** Nearest buildable name: ASCII-fold, PascalCase the words, lead with a letter, fit the length. */
export function suggestName(raw: string): string | undefined {
  const words = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9_]+/).filter(Boolean);
  let s = words.map((w) => w[0].toUpperCase() + w.slice(1)).join('').replace(/^_+/, '');
  if (!s) return undefined;
  if (/^[0-9]/.test(s)) s = `Project${s}`;
  s = s.slice(0, MAX_PROJECT_NAME_LENGTH);
  if (RESERVED_RE.test(s)) s = `${s}Game`;
  return nameIssues(s).length === 0 ? s : undefined;
}

const majorMinor = (v: string) => v.split('.').slice(0, 2).join('.');
const numeric = (v: string) => v.split('.').map((n) => Number(n) || 0);
function newest(engines: readonly DetectedEngine[]): DetectedEngine {
  return [...engines].sort((a, b) => {
    const [x, y] = [numeric(a.version), numeric(b.version)];
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0);
    return 0;
  })[0];
}

function engineAdvisories(ueVersion: string, engines: readonly DetectedEngine[] | null): PlanAdvisory[] {
  const row = toolRow('engine');
  if (engines === null) return [{ code: 'engines-unknown', message: 'Could not detect installed engines' }];
  if (engines.length === 0) {
    return [{ code: 'no-engine', message: `No ${row.name} is installed — the project cannot be built yet`,
      install: { url: row.installUrl, label: row.installLabel } }];
  }
  const mm = majorMinor(ueVersion);
  if (engines.some((e) => majorMinor(e.version) === mm)) return [];
  const best = newest(engines);
  return [{ code: 'engine-not-installed', suggestedVersion: best.version,
    message: `UE ${mm} is not installed here (installed: ${engines.map((e) => e.version).join(', ')})` }];
}

function rootIssues(id: string, input: NewProjectPlanInput): PlanIssue[] {
  if (input.rootError != null) {
    return [{ code: 'root-unreadable', message: `Cannot read the projects folder (${input.rootError}) — Create stays off until it can be checked for collisions` }];
  }
  if (input.root === null || input.entries === null) {
    return [{ code: 'root-pending', message: 'Checking the projects folder…' }];
  }
  const hit = id ? input.entries.find((e) => e.name.toLowerCase() === id.toLowerCase()) : undefined;
  if (!hit) return [];
  return hit.hasUProject
    ? [{ code: 'project-exists', message: `A UE project "${hit.name}" already exists here`, openExisting: { path: hit.path, name: hit.name } }]
    : [{ code: 'folder-exists', message: `A folder "${hit.name}" already exists here — the scaffold would write into it` }];
}

export function planNewProject(input: NewProjectPlanInput): NewProjectPlan {
  const identifier = input.name.trim();
  const own = nameIssues(identifier);
  const issues = [...own, ...rootIssues(identifier, input)];
  const suggestion = own.some((i) => NAME_CODES.has(i.code)) ? suggestName(identifier) : undefined;
  const canCreate = issues.length === 0;
  return {
    canCreate,
    projectPath: canCreate ? `${input.root!.replace(/[\\/]+$/, '')}\\${identifier}` : null,
    identifier,
    issues,
    advisories: engineAdvisories(input.ueVersion, input.engines),
    ...(suggestion ? { suggestion } : {}),
  };
}
