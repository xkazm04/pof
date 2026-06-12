import fs from 'fs/promises';
import path from 'path';
import { diffPrompts, type PromptDiff } from './text-diff';

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface WriteInput {
  projectPath: string;
  moduleName: string;
  className: string;
  header: string;
  source: string;
}

export interface FileWritePlan {
  path: string;
  relPath: string;
  exists: boolean;
  /** Existing on-disk content ('' if absent) — feeds a before/after diff view. */
  before: string;
  /** The content that would be written. */
  after: string;
  diff: PromptDiff;
}

export interface WritePlan {
  files: FileWritePlan[];
}

function assertIdent(name: string, label: string): void {
  if (!IDENT.test(name)) throw new Error(`Invalid ${label}: "${name}" (must be a C++ identifier)`);
}

export function resolveTargetPaths(input: WriteInput): {
  sourceDir: string; headerPath: string; sourcePath: string; relHeader: string; relSource: string;
} {
  assertIdent(input.moduleName, 'module name');
  assertIdent(input.className, 'class name');
  const root = path.resolve(input.projectPath, 'Source');
  const sourceDir = path.join(root, input.moduleName);
  const headerPath = path.join(sourceDir, `${input.className}.h`);
  const sourcePath = path.join(sourceDir, `${input.className}.cpp`);
  if (!headerPath.startsWith(root + path.sep) || !sourcePath.startsWith(root + path.sep)) {
    throw new Error('Resolved path escapes the project Source directory');
  }
  return {
    sourceDir,
    headerPath,
    sourcePath,
    relHeader: `Source/${input.moduleName}/${input.className}.h`,
    relSource: `Source/${input.moduleName}/${input.className}.cpp`,
  };
}

async function readIfExists(p: string): Promise<string | null> {
  try { return await fs.readFile(p, 'utf8'); } catch { return null; }
}

/** Dry-run: diff the generated content against whatever is on disk. No writes. */
export async function planWrite(input: WriteInput): Promise<WritePlan> {
  const { headerPath, sourcePath, relHeader, relSource } = resolveTargetPaths(input);
  const [hOld, cOld] = await Promise.all([readIfExists(headerPath), readIfExists(sourcePath)]);
  return {
    files: [
      { path: headerPath, relPath: relHeader, exists: hOld !== null, before: hOld ?? '', after: input.header, diff: diffPrompts(hOld ?? '', input.header) },
      { path: sourcePath, relPath: relSource, exists: cOld !== null, before: cOld ?? '', after: input.source, diff: diffPrompts(cOld ?? '', input.source) },
    ],
  };
}

/** A file the user approved in the dry-run: its path and the on-disk content
 *  the diff was computed against. */
export interface ApprovedFile {
  relPath: string;
  before: string;
}

/**
 * Write the header + source to disk (after the user confirms the dry-run).
 *
 * `approved` is the plan the user actually saw. The confirm request is built
 * from LIVE editor state — if the module name changed after the dry-run (the
 * input lives inside the modal), the resolved paths no longer match the
 * approved diff, and writing would overwrite files the user never reviewed.
 * Content is re-checked too, so a file modified since the dry-run also
 * invalidates the approval.
 */
export async function applyWrite(
  input: WriteInput,
  approved?: ApprovedFile[],
): Promise<{ written: string[] }> {
  const { sourceDir, headerPath, sourcePath, relHeader, relSource } = resolveTargetPaths(input);

  if (approved) {
    const targets: { rel: string; abs: string }[] = [
      { rel: relHeader, abs: headerPath },
      { rel: relSource, abs: sourcePath },
    ];
    for (const t of targets) {
      const plan = approved.find((a) => a.relPath === t.rel);
      if (!plan) {
        throw new Error(
          `The approved dry-run does not cover ${t.rel} (the module/class changed after the diff) — re-run the dry run.`,
        );
      }
      const current = (await readIfExists(t.abs)) ?? '';
      if (current !== plan.before) {
        throw new Error(
          `${t.rel} changed on disk since the dry-run — the approved diff is stale; re-run the dry run.`,
        );
      }
    }
  }

  await fs.mkdir(sourceDir, { recursive: true });
  await fs.writeFile(headerPath, input.header, 'utf8');
  await fs.writeFile(sourcePath, input.source, 'utf8');
  return { written: [headerPath, sourcePath] };
}
