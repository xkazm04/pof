import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { apiSuccess, apiError } from '@/lib/api-utils';

// ── Types ──

export interface ScannedClass {
  name: string;
  /** 'A' = Actor, 'U' = UObject, 'F' = struct/plain, 'E' = enum */
  prefix: 'A' | 'U' | 'F' | 'E' | '';
  headerPath: string;
}

export interface ScannedPlugin {
  name: string;
  enabled: boolean;
}

export interface ScannedDependency {
  module: string;
  type: 'public' | 'private';
}

export interface ProjectScanResult {
  scannedAt: string;
  classes: ScannedClass[];
  plugins: ScannedPlugin[];
  buildDependencies: ScannedDependency[];
  sourceFileCount: number;
  /** Milliseconds taken to perform the scan */
  scanDurationMs: number;
}

// ── Helpers ──

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Recursively collect all .h files under a directory.
 * Caps at 500 files to avoid scanning massive engine directories.
 */
async function collectHeaders(dir: string, maxFiles = 500): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string) {
    if (results.length >= maxFiles) return;
    try {
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxFiles) return;
        const full = path.join(current, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await walk(full);
        } else if (entry.isFile() && entry.name.endsWith('.h')) {
          results.push(full);
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  await walk(dir);
  return results;
}

/**
 * Recursively collect all .cpp and .h files (for count).
 */
async function countSourceFiles(dir: string): Promise<number> {
  let count = 0;

  async function walk(current: string) {
    try {
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await walk(full);
        } else if (entry.isFile() && (entry.name.endsWith('.h') || entry.name.endsWith('.cpp'))) {
          count++;
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  await walk(dir);
  return count;
}

/**
 * Extract UCLASS/USTRUCT/UENUM-decorated type names from a header file.
 * Matches patterns like:
 *   class MODULE_API AMyCharacter : public ACharacter
 *   struct MODULE_API FMyStruct
 *   enum class EMyEnum : uint8
 */
async function extractClassesFromHeader(headerPath: string, sourceRoot: string): Promise<ScannedClass[]> {
  try {
    const content = await fs.readFile(headerPath, 'utf-8');
    const classes: ScannedClass[] = [];
    const relativePath = path.relative(sourceRoot, headerPath).replace(/\\/g, '/');

    // Match UCLASS(), USTRUCT(), UENUM() decorated types
    // Pattern: UCLASS/USTRUCT/UENUM(...)  then class/struct/enum [class] NAME
    const decoratorRegex = /U(?:CLASS|STRUCT|ENUM)\s*\([^)]*\)\s*(?:class|struct|enum)\s+(?:class\s+)?(?:\w+_API\s+)?(\w+)/g;
    let match;
    while ((match = decoratorRegex.exec(content)) !== null) {
      const name = match[1];
      const prefix = (name[0] === 'A' || name[0] === 'U' || name[0] === 'F' || name[0] === 'E')
        ? name[0] as 'A' | 'U' | 'F' | 'E'
        : '' as const;
      classes.push({ name, prefix, headerPath: relativePath });
    }

    return classes;
  } catch {
    return [];
  }
}

/**
 * Parse a *.Build.cs file to extract module dependencies.
 * Matches: PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject" });
 *          PrivateDependencyModuleNames.AddRange(new string[] { "Slate" });
 */
async function parseBuildCs(buildCsPath: string): Promise<ScannedDependency[]> {
  try {
    const content = await fs.readFile(buildCsPath, 'utf-8');
    const deps: ScannedDependency[] = [];

    const patterns: { regex: RegExp; type: 'public' | 'private' }[] = [
      { regex: /PublicDependencyModuleNames\s*\.(?:AddRange|Add)\s*\(\s*(?:new\s+string\s*\[\s*\]\s*\{)?\s*([^})]+)/g, type: 'public' },
      { regex: /PrivateDependencyModuleNames\s*\.(?:AddRange|Add)\s*\(\s*(?:new\s+string\s*\[\s*\]\s*\{)?\s*([^})]+)/g, type: 'private' },
    ];

    for (const { regex, type } of patterns) {
      let match;
      while ((match = regex.exec(content)) !== null) {
        const raw = match[1];
        const modules = raw.match(/"([^"]+)"/g);
        if (modules) {
          for (const m of modules) {
            deps.push({ module: m.replace(/"/g, ''), type });
          }
        }
      }
    }

    return deps;
  } catch {
    return [];
  }
}

/**
 * Parse the .uproject file for enabled plugins.
 */
async function parsePlugins(projectPath: string, projectName: string): Promise<ScannedPlugin[]> {
  const uprojectPath = path.join(projectPath, `${projectName}.uproject`);
  try {
    const content = await fs.readFile(uprojectPath, 'utf-8');
    const json = JSON.parse(content);
    const plugins: ScannedPlugin[] = [];

    if (Array.isArray(json.Plugins)) {
      for (const p of json.Plugins) {
        if (typeof p.Name === 'string') {
          plugins.push({
            name: p.Name,
            enabled: p.Enabled !== false, // default true if not specified
          });
        }
      }
    }

    return plugins;
  } catch {
    return [];
  }
}

/**
 * Also scan the Plugins/ directory for local plugins.
 */
async function scanLocalPlugins(projectPath: string): Promise<ScannedPlugin[]> {
  const pluginsDir = path.join(projectPath, 'Plugins');
  if (!(await directoryExists(pluginsDir))) return [];

  const plugins: ScannedPlugin[] = [];
  try {
    const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pluginDir = path.join(pluginsDir, entry.name);
      // Check for .uplugin file
      try {
        const subEntries = await fs.readdir(pluginDir);
        const upluginFile = subEntries.find((f) => f.endsWith('.uplugin'));
        if (upluginFile) {
          plugins.push({ name: entry.name, enabled: true });
        }
      } catch {
        // Skip
      }
    }
  } catch {
    // Skip
  }

  return plugins;
}

// ── Main scan function ──

async function scanProject(projectPath: string, moduleName: string): Promise<ProjectScanResult> {
  const startTime = Date.now();

  const sourceRoot = path.join(projectPath, 'Source', moduleName);
  const sourceExists = await directoryExists(sourceRoot);

  // Parallel: scan classes, count files, parse Build.cs, parse plugins
  const [headers, sourceFileCount, buildDeps, uprojectPlugins, localPlugins] = await Promise.all([
    sourceExists ? collectHeaders(sourceRoot) : Promise.resolve([]),
    sourceExists ? countSourceFiles(sourceRoot) : Promise.resolve(0),
    (async () => {
      const buildCsPath = path.join(projectPath, 'Source', moduleName, `${moduleName}.Build.cs`);
      if (await fileExists(buildCsPath)) return parseBuildCs(buildCsPath);
      // Fallback: try to find any .Build.cs in Source/
      const sourceDir = path.join(projectPath, 'Source');
      if (!(await directoryExists(sourceDir))) return [];
      try {
        const entries = await fs.readdir(sourceDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            const candidate = path.join(sourceDir, e.name, `${e.name}.Build.cs`);
            if (await fileExists(candidate)) return parseBuildCs(candidate);
          }
        }
      } catch { /* skip */ }
      return [];
    })(),
    parsePlugins(projectPath, moduleName),
    scanLocalPlugins(projectPath),
  ]);

  // Extract classes from headers in parallel (batch of 20)
  const allClasses: ScannedClass[] = [];
  const batchSize = 20;
  for (let i = 0; i < headers.length; i += batchSize) {
    const batch = headers.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((h) => extractClassesFromHeader(h, path.join(projectPath, 'Source')))
    );
    for (const classes of results) {
      allClasses.push(...classes);
    }
  }

  // Merge plugins (uproject + local, deduplicate)
  const seenPlugins = new Set<string>();
  const mergedPlugins: ScannedPlugin[] = [];
  for (const p of [...uprojectPlugins, ...localPlugins]) {
    if (!seenPlugins.has(p.name)) {
      seenPlugins.add(p.name);
      mergedPlugins.push(p);
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    classes: allClasses,
    plugins: mergedPlugins,
    buildDependencies: buildDeps,
    sourceFileCount,
    scanDurationMs: Date.now() - startTime,
  };
}

// ── Route handler ──

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath, moduleName } = body;

    if (!projectPath || typeof projectPath !== 'string') {
      return apiError('projectPath is required', 400);
    }
    if (!moduleName || typeof moduleName !== 'string') {
      return apiError('moduleName is required', 400);
    }

    if (!(await directoryExists(projectPath))) {
      return apiError('Project path does not exist', 404);
    }

    const result = await scanProject(projectPath, moduleName);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Internal server error');
  }
}
