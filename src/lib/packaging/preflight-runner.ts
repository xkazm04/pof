// Server-only: the filesystem side of the "fast" pre-flight checks (config
// sanity + plugin WITH_EDITOR audit). Extracted from the preflight API route so
// the nightly-build runner can run the same gate unattended without an HTTP hop.
//
// The heavy build-verify (UBT spawn) deliberately stays in the route — a
// scheduled run is followed by a full cook that compiles anyway.

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  checkConfigSanity,
  auditWithEditor,
  withEditorCheckResult,
  overallStatus,
  type PreflightCheckResult,
  type PreflightStatus,
  type SourceFile,
  type CookMapCheck,
} from './preflight';

async function readIfExists(p: string): Promise<string | null> {
  try {
    return await readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

/** Module descriptor "Type" values that ship in a packaged build. */
const RUNTIME_MODULE_TYPES = new Set([
  'Runtime', 'RuntimeNoCommandlet', 'RuntimeAndProgram', 'CookedOnly', 'ServerOnly', 'ClientOnly',
]);

interface ModuleDescriptor { Name?: string; Type?: string }

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

async function gatherRuntimeSources(projectPath: string, projectName: string): Promise<SourceFile[]> {
  const files: SourceFile[] = [];

  const uprojectJson = await readIfExists(path.join(projectPath, `${projectName}.uproject`));
  if (uprojectJson) {
    for (const mod of runtimeModuleNames(uprojectJson)) {
      await collectSources(path.join(projectPath, 'Source', mod), files);
    }
  }

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

/** Does the `.umap` behind a `/Game/...` content path exist on disk? */
async function umapExists(projectPath: string, contentPath: string): Promise<boolean> {
  const rel = contentPath.trim().replace(/^\/Game\//, '').replace(/\..*$/, '');
  try {
    await stat(path.join(projectPath, 'Content', `${rel}.umap`));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the maps the cook will actually ship.
 *
 * `mapsToInclude` from the selected build profile is the authority — that is
 * the list UAT receives as `-map=A+B`. Only when the profile cooks "all maps"
 * (an empty list) is `GameDefaultMap` the concrete level worth checking, and
 * the result records which of the two it looked at.
 */
export async function resolveCookMaps(
  projectPath: string,
  defaultEngineIni: string | null,
  mapsToInclude: string[] | undefined,
): Promise<CookMapCheck> {
  const fromProfile = (mapsToInclude ?? []).map((m) => m.trim()).filter(Boolean);
  let source: CookMapCheck['source'] = 'profile';
  let candidates = fromProfile;

  if (candidates.length === 0) {
    source = 'game-default-map';
    const m = defaultEngineIni ? /GameDefaultMap=(.+)/.exec(defaultEngineIni) : null;
    const contentPath = m ? m[1].trim() : '';
    candidates = contentPath.startsWith('/Game/') ? [contentPath] : [];
  }
  if (candidates.length === 0) return { source: 'none', checked: [], missing: [] };

  const checked = candidates.filter((c) => c.startsWith('/Game/'));
  const missing: string[] = [];
  for (const c of checked) {
    if (!(await umapExists(projectPath, c))) missing.push(c);
  }
  return { source, checked, missing };
}

/**
 * Run the fast (no-spawn) pre-flight checks and return results + overall status.
 *
 * `mapsToInclude` is the selected profile's cook set; omitting it falls the map
 * check back to `GameDefaultMap` and the result says so.
 */
export async function runFastPreflight(
  projectPath: string,
  projectName: string,
  mapsToInclude?: string[],
): Promise<{ results: PreflightCheckResult[]; overall: PreflightStatus }> {
  const configDir = path.join(projectPath, 'Config');
  const [defaultGameIni, defaultEngineIni] = await Promise.all([
    readIfExists(path.join(configDir, 'DefaultGame.ini')),
    readIfExists(path.join(configDir, 'DefaultEngine.ini')),
  ]);
  const cookMaps = await resolveCookMaps(projectPath, defaultEngineIni, mapsToInclude);

  const config = checkConfigSanity({ defaultGameIni, defaultEngineIni, cookMaps });
  const sources = await gatherRuntimeSources(projectPath, projectName);
  const audit = withEditorCheckResult(auditWithEditor(sources));

  const results = [config, audit];
  return { results, overall: overallStatus(results) };
}
