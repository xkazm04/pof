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

/**
 * What the target directory actually IS, established before anything is
 * written. `fs.mkdir(..., { recursive: true })` will happily manufacture
 * `Source/<Module>/` inside a directory that is not a UE project at all, and a
 * module with no `<Module>.Build.cs` is not part of the build — the compiler
 * will never see the files. Both are reported so the receipt can never read as
 * a green "wrote 2 files".
 */
export interface ProjectReality {
  /** True when a `*.uproject` sits at the root of `projectPath`. */
  isUeProject: boolean;
  /** The `.uproject` file name, or null when there is none. */
  uprojectFile: string | null;
  /** True when `Source/<Module>/<Module>.Build.cs` exists. */
  moduleInBuild: boolean;
  /** Where that Build.cs was looked for (project-relative, forward slashes). */
  buildCsRelPath: string;
}

export interface WritePlan {
  files: FileWritePlan[];
  project: ProjectReality;
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

async function fileExists(p: string): Promise<boolean> {
  try { await fs.stat(p); return true; } catch { return false; }
}

/**
 * Inspect the target before touching it: is there a `*.uproject` at the root,
 * and does the module have the `<Module>.Build.cs` that puts it in the build?
 * Mirrors the locator `/api/filesystem/scan-project` already uses.
 */
export async function inspectProject(input: WriteInput): Promise<ProjectReality> {
  assertIdent(input.moduleName, 'module name');
  const buildCsRelPath = `Source/${input.moduleName}/${input.moduleName}.Build.cs`;
  let uprojectFile: string | null = null;
  try {
    const entries = await fs.readdir(input.projectPath, { withFileTypes: true });
    uprojectFile = entries.find((e) => e.isFile() && e.name.endsWith('.uproject'))?.name ?? null;
  } catch { /* unreadable directory — not a UE project as far as we can tell */ }
  const moduleInBuild = await fileExists(path.join(input.projectPath, ...buildCsRelPath.split('/')));
  return { isUeProject: uprojectFile !== null, uprojectFile, moduleInBuild, buildCsRelPath };
}

/** Dry-run: diff the generated content against whatever is on disk. No writes. */
export async function planWrite(input: WriteInput): Promise<WritePlan> {
  const { headerPath, sourcePath, relHeader, relSource } = resolveTargetPaths(input);
  const [hOld, cOld, project] = await Promise.all([
    readIfExists(headerPath), readIfExists(sourcePath), inspectProject(input),
  ]);
  return {
    project,
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
): Promise<{ written: string[]; moduleInBuild: boolean; uprojectFile: string }> {
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

  // Reality check BEFORE the recursive mkdir: without a `.uproject` this is not
  // a UE project and `Source/<Module>/` would be conjured out of nothing.
  const project = await inspectProject(input);
  if (!project.isUeProject) {
    throw new Error(
      `"${input.projectPath}" contains no .uproject file, so it is not a UE project — refusing to create Source/${input.moduleName}/ inside it.`,
    );
  }

  await fs.mkdir(sourceDir, { recursive: true });
  await fs.writeFile(headerPath, input.header, 'utf8');
  await fs.writeFile(sourcePath, input.source, 'utf8');
  // The receipt carries the rung it was earned at: the files are WRITTEN. Only
  // a compile can raise that, and `moduleInBuild === false` means no compiler
  // will ever look at them.
  return {
    written: [headerPath, sourcePath],
    moduleInBuild: project.moduleInBuild,
    uprojectFile: project.uprojectFile as string,
  };
}
