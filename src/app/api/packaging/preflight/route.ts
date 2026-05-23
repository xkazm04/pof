import { spawn } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getEnginePath } from '@/lib/prompt-context';
import {
  checkConfigSanity,
  auditWithEditor,
  withEditorCheckResult,
  parseUbtResult,
  buildVerifyCheckResult,
  overallStatus,
  type PreflightCheckResult,
  type SourceFile,
} from '@/lib/packaging/preflight';

type CheckKind = 'fast' | 'build-verify-editor' | 'build-verify-shipping';

interface PreflightRequest {
  projectPath: string;
  projectName: string;
  ueVersion: string;
  /** Optional level the operator selected to cook (e.g. `/Game/Maps/VerticalSlice`). */
  mapName?: string;
  check?: CheckKind;
}

function isPreflightRequest(v: unknown): v is PreflightRequest {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.projectPath === 'string'
    && typeof o.projectName === 'string'
    && typeof o.ueVersion === 'string';
}

async function readIfExists(p: string): Promise<string | null> {
  try {
    return await readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

/** Module descriptor "Type" values that ship in a packaged build (cannot use editor-only APIs unguarded). */
const RUNTIME_MODULE_TYPES = new Set([
  'Runtime',
  'RuntimeNoCommandlet',
  'RuntimeAndProgram',
  'CookedOnly',
  'ServerOnly',
  'ClientOnly',
]);

interface ModuleDescriptor { Name?: string; Type?: string }

/** Parse a `.uproject`/`.uplugin` JSON and return the names of its runtime (shipping) modules. */
function runtimeModuleNames(descriptorJson: string): string[] {
  try {
    const parsed = JSON.parse(descriptorJson) as { Modules?: ModuleDescriptor[] };
    const mods = Array.isArray(parsed.Modules) ? parsed.Modules : [];
    return mods
      .filter((m) => m.Name && (!m.Type || RUNTIME_MODULE_TYPES.has(m.Type)))
      .map((m) => m.Name as string);
  } catch {
    return [];
  }
}

const SKIP_DIRS = new Set(['Intermediate', 'Binaries', 'Saved', 'ThirdParty', 'DerivedDataCache', '.git']);
const MAX_AUDIT_FILES = 400;

/** Recursively collect `.h`/`.cpp` files under a module source dir. */
async function collectSources(dir: string, out: SourceFile[]): Promise<void> {
  if (out.length >= MAX_AUDIT_FILES) return;
  let entries: import('node:fs').Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= MAX_AUDIT_FILES) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await collectSources(full, out);
    } else if (/\.(h|hpp|cpp|inl)$/i.test(entry.name)) {
      const content = await readIfExists(full);
      if (content !== null) out.push({ path: full, content });
    }
  }
}

/** Discover runtime-module source files across the project and its plugins. */
async function gatherRuntimeSources(projectPath: string, projectName: string): Promise<SourceFile[]> {
  const files: SourceFile[] = [];

  // Project-level modules from <ProjectName>.uproject
  const uprojectJson = await readIfExists(path.join(projectPath, `${projectName}.uproject`));
  if (uprojectJson) {
    for (const mod of runtimeModuleNames(uprojectJson)) {
      await collectSources(path.join(projectPath, 'Source', mod), files);
    }
  }

  // Plugin modules from each Plugins/<X>/<X>.uplugin
  const pluginsRoot = path.join(projectPath, 'Plugins');
  let pluginDirs: import('node:fs').Dirent[] = [];
  try {
    pluginDirs = await readdir(pluginsRoot, { withFileTypes: true });
  } catch {
    pluginDirs = [];
  }
  for (const p of pluginDirs) {
    if (!p.isDirectory()) continue;
    const pluginDir = path.join(pluginsRoot, p.name);
    let upluginPath: string | null = null;
    try {
      const inner = await readdir(pluginDir);
      const found = inner.find((f) => f.toLowerCase().endsWith('.uplugin'));
      if (found) upluginPath = path.join(pluginDir, found);
    } catch { /* skip */ }
    if (!upluginPath) continue;
    const upluginJson = await readIfExists(upluginPath);
    if (!upluginJson) continue;
    for (const mod of runtimeModuleNames(upluginJson)) {
      await collectSources(path.join(pluginDir, 'Source', mod), files);
    }
  }

  return files;
}

/** Does a `GameDefaultMap` content path resolve to a `.umap` on disk? */
async function resolveMapExists(projectPath: string, defaultEngineIni: string | null): Promise<boolean | null> {
  if (!defaultEngineIni) return null;
  const m = /GameDefaultMap=(.+)/.exec(defaultEngineIni);
  if (!m) return null;
  const contentPath = m[1].trim();
  if (!contentPath || !contentPath.startsWith('/Game/')) return null;
  // /Game/Maps/VerticalSlice -> <projectPath>/Content/Maps/VerticalSlice.umap
  const rel = contentPath.replace(/^\/Game\//, '').replace(/\..*$/, '');
  const umap = path.join(projectPath, 'Content', `${rel}.umap`);
  try {
    await stat(umap);
    return true;
  } catch {
    return false;
  }
}

async function runFastChecks(req: PreflightRequest): Promise<PreflightCheckResult[]> {
  const configDir = path.join(req.projectPath, 'Config');
  const [defaultGameIni, defaultEngineIni] = await Promise.all([
    readIfExists(path.join(configDir, 'DefaultGame.ini')),
    readIfExists(path.join(configDir, 'DefaultEngine.ini')),
  ]);
  const defaultMapExists = await resolveMapExists(req.projectPath, defaultEngineIni);

  const config = checkConfigSanity({ defaultGameIni, defaultEngineIni, defaultMapExists });

  const sources = await gatherRuntimeSources(req.projectPath, req.projectName);
  const audit = withEditorCheckResult(auditWithEditor(sources));

  return [config, audit];
}

const UBT_TIMEOUT_MS = 10 * 60 * 1000;

function runBuildVerify(
  req: PreflightRequest,
  target: string,
  config: 'Development' | 'Shipping',
  signal: AbortSignal,
): Promise<{ output: string; spawnError: string | null }> {
  const enginePath = getEnginePath(req.ueVersion);
  const ubt = path.join(enginePath, 'Engine', 'Binaries', 'DotNET', 'UnrealBuildTool', 'UnrealBuildTool.exe');
  const uproject = path.join(req.projectPath, `${req.projectName}.uproject`);

  return new Promise((resolve) => {
    let output = '';
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(
        ubt,
        [target, 'Win64', config, `-Project=${uproject}`, '-WaitMutex', '-NoHotReload', '-NoXGE'],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch (err) {
      resolve({ output: '', spawnError: err instanceof Error ? err.message : String(err) });
      return;
    }

    const timer = setTimeout(() => {
      try { child.kill('SIGTERM'); } catch { /* noop */ }
    }, UBT_TIMEOUT_MS);

    const onAbort = () => { try { child.kill('SIGTERM'); } catch { /* noop */ } };
    signal.addEventListener('abort', onAbort);

    child.stdout?.setEncoding('utf-8');
    child.stdout?.on('data', (d: string) => { output += d; });
    child.stderr?.setEncoding('utf-8');
    child.stderr?.on('data', (d: string) => { output += d; });

    child.once('error', (err) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve({ output, spawnError: err instanceof Error ? err.message : String(err) });
    });
    child.once('exit', () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve({ output, spawnError: null });
    });
  });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try { body = await req.json(); } catch {
    return apiError('invalid JSON body', 400);
  }
  if (!isPreflightRequest(body)) {
    return apiError('missing required fields: projectPath, projectName, ueVersion', 400);
  }
  const request = body as PreflightRequest;
  const check: CheckKind = request.check ?? 'fast';

  try {
    let results: PreflightCheckResult[];

    if (check === 'fast') {
      results = await runFastChecks(request);
    } else {
      const isShipping = check === 'build-verify-shipping';
      const target = isShipping ? request.projectName : `${request.projectName}Editor`;
      const ubtConfig = isShipping ? 'Shipping' : 'Development';
      const label = isShipping ? 'Build verify (Shipping)' : 'Build verify (Editor)';
      const { output, spawnError } = await runBuildVerify(request, target, ubtConfig, req.signal);
      if (spawnError) {
        results = [{
          id: isShipping ? 'build-verify-shipping' : 'build-verify-editor',
          label,
          status: 'fail',
          detail: `Could not run UnrealBuildTool: ${spawnError}`,
          issues: [spawnError],
        }];
      } else {
        results = [buildVerifyCheckResult(
          isShipping ? 'build-verify-shipping' : 'build-verify-editor',
          label,
          parseUbtResult(output),
        )];
      }
    }

    return apiSuccess({ results, overall: overallStatus(results) });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'pre-flight failed');
  }
}
