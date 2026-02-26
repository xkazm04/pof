import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import type { ProjectType } from '@/lib/prompt-context';

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
  projectType: ProjectType;
  // UE5 fields
  classes: ScannedClass[];
  plugins: ScannedPlugin[];
  buildDependencies: ScannedDependency[];
  sourceFileCount: number;
  // Web-app fields
  framework?: string;
  apiRoutes?: string[];
  databaseType?: string;
  // MCP fields
  hasMcp?: boolean;
  mcpServerNames?: string[];
  mcpInstructions?: string;
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

// ── Project type detection ──

interface DetectedProjectInfo {
  projectType: ProjectType;
  framework?: string;
  databaseType?: string;
}

const DB_DETECTORS: { pkg: string; label: string }[] = [
  { pkg: '@supabase/supabase-js', label: 'Supabase (PostgreSQL)' },
  { pkg: 'prisma', label: 'Prisma' },
  { pkg: '@prisma/client', label: 'Prisma' },
  { pkg: 'better-sqlite3', label: 'SQLite' },
  { pkg: 'pg', label: 'PostgreSQL' },
  { pkg: 'mysql2', label: 'MySQL' },
  { pkg: 'mongodb', label: 'MongoDB' },
  { pkg: 'mongoose', label: 'MongoDB' },
  { pkg: 'drizzle-orm', label: 'Drizzle ORM' },
  { pkg: 'typeorm', label: 'TypeORM' },
];

async function detectProjectType(projectPath: string): Promise<DetectedProjectInfo> {
  // Check for .uproject file (UE5)
  try {
    const entries = await fs.readdir(projectPath);
    if (entries.some((e) => e.endsWith('.uproject'))) {
      return { projectType: 'ue5' };
    }
  } catch { /* skip */ }

  // Check for package.json (web app)
  const pkgPath = path.join(projectPath, 'package.json');
  if (await fileExists(pkgPath)) {
    try {
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Detect framework
      let framework: string | undefined;
      if (allDeps['next']) {
        framework = `Next.js ${allDeps['next'].replace(/[\^~]/, '')}`;
      } else if (allDeps['nuxt']) {
        framework = 'Nuxt';
      } else if (allDeps['@angular/core']) {
        framework = 'Angular';
      } else if (allDeps['react']) {
        framework = 'React';
      } else if (allDeps['vue']) {
        framework = 'Vue';
      } else if (allDeps['express']) {
        framework = 'Express';
      }

      const projectType: ProjectType = allDeps['next'] ? 'nextjs' : 'generic';

      // Detect database
      let databaseType: string | undefined;
      for (const det of DB_DETECTORS) {
        if (allDeps[det.pkg]) {
          databaseType = det.label;
          break;
        }
      }

      return { projectType, framework, databaseType };
    } catch { /* skip */ }
  }

  return { projectType: 'generic' };
}

/**
 * Scan for API route directories in a Next.js project.
 * Checks src/app/api/, app/api/, and pages/api/ for route handler directories.
 */
async function scanApiRoutes(projectPath: string): Promise<string[]> {
  const candidates = [
    path.join(projectPath, 'src', 'app', 'api'),
    path.join(projectPath, 'app', 'api'),
  ];

  const routes: string[] = [];

  for (const apiDir of candidates) {
    if (!(await directoryExists(apiDir))) continue;

    try {
      const entries = await fs.readdir(apiDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        // Check if it has a route.ts/route.js handler
        const routeDir = path.join(apiDir, entry.name);
        const hasRoute = await hasRouteFile(routeDir);
        if (hasRoute) {
          routes.push(`/api/${entry.name}`);
        }
        // Also check one level deeper for nested routes
        try {
          const subEntries = await fs.readdir(routeDir, { withFileTypes: true });
          for (const sub of subEntries) {
            if (!sub.isDirectory()) continue;
            const subDir = path.join(routeDir, sub.name);
            if (await hasRouteFile(subDir)) {
              routes.push(`/api/${entry.name}/${sub.name}`);
            }
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    // Stop after first valid api directory found
    if (routes.length > 0) break;
  }

  // Also check pages/api/ (Pages Router)
  if (routes.length === 0) {
    const pagesApiDir = path.join(projectPath, 'pages', 'api');
    if (await directoryExists(pagesApiDir)) {
      try {
        const entries = await fs.readdir(pagesApiDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && /\.(ts|js|tsx|jsx)$/.test(entry.name)) {
            const name = entry.name.replace(/\.(ts|js|tsx|jsx)$/, '');
            if (name !== 'index') routes.push(`/api/${name}`);
          } else if (entry.isDirectory()) {
            routes.push(`/api/${entry.name}`);
          }
        }
      } catch { /* skip */ }
    }
  }

  return routes.sort();
}

async function hasRouteFile(dir: string): Promise<boolean> {
  for (const name of ['route.ts', 'route.js', 'route.tsx', 'route.jsx']) {
    if (await fileExists(path.join(dir, name))) return true;
  }
  return false;
}

// ── Main scan function (UE5) ──

async function scanUE5Project(projectPath: string, moduleName: string): Promise<ProjectScanResult> {
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
    projectType: 'ue5',
    classes: allClasses,
    plugins: mergedPlugins,
    buildDependencies: buildDeps,
    sourceFileCount,
    scanDurationMs: Date.now() - startTime,
  };
}

/** Scan a web-app project (Next.js, generic). */
/**
 * Detect MCP server configuration from .mcp.json in the project root.
 * Returns server names and instructions from the MCP server metadata.
 */
async function detectMcpConfig(projectPath: string): Promise<{
  hasMcp: boolean;
  mcpServerNames: string[];
  mcpInstructions: string;
}> {
  const mcpPath = path.join(projectPath, '.mcp.json');
  if (!(await fileExists(mcpPath))) {
    return { hasMcp: false, mcpServerNames: [], mcpInstructions: '' };
  }

  try {
    const content = await fs.readFile(mcpPath, 'utf-8');
    const config = JSON.parse(content);
    const servers = config.mcpServers ?? {};
    const serverNames = Object.keys(servers);

    if (serverNames.length === 0) {
      return { hasMcp: false, mcpServerNames: [], mcpInstructions: '' };
    }

    // Build MCP instruction text summarizing available tools
    const lines: string[] = [];
    lines.push('## MCP Tools Available');
    lines.push(`This project has ${serverNames.length} MCP server(s) configured: ${serverNames.join(', ')}.`);
    lines.push('Claude Code auto-discovers these tools from the project\'s .mcp.json configuration.');
    lines.push('Use these MCP tools for ALL data access — they provide typed read/write access to the project\'s database.');
    lines.push('');
    lines.push('Common tool patterns:');
    lines.push('- `list_*` — list all items of a type (characters, factions, scenes, etc.)');
    lines.push('- `get_*` — get detailed info about a specific item by ID');
    lines.push('- `create_*` / `update_*` — create or modify items');
    lines.push('- `generate_image_*` — generate images for visual content');

    return {
      hasMcp: true,
      mcpServerNames: serverNames,
      mcpInstructions: lines.join('\n'),
    };
  } catch {
    return { hasMcp: false, mcpServerNames: [], mcpInstructions: '' };
  }
}

async function scanWebAppProject(
  projectPath: string,
  info: DetectedProjectInfo,
): Promise<ProjectScanResult> {
  const startTime = Date.now();

  const [apiRoutes, mcpInfo] = await Promise.all([
    info.projectType === 'nextjs' ? scanApiRoutes(projectPath) : Promise.resolve([]),
    detectMcpConfig(projectPath),
  ]);

  return {
    scannedAt: new Date().toISOString(),
    projectType: info.projectType,
    classes: [],
    plugins: [],
    buildDependencies: [],
    sourceFileCount: 0,
    framework: info.framework,
    apiRoutes,
    databaseType: info.databaseType,
    hasMcp: mcpInfo.hasMcp,
    mcpServerNames: mcpInfo.mcpServerNames,
    mcpInstructions: mcpInfo.mcpInstructions,
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

    if (!(await directoryExists(projectPath))) {
      return apiError('Project path does not exist', 404);
    }

    // Detect project type first
    const info = await detectProjectType(projectPath);

    if (info.projectType === 'ue5') {
      // UE5 projects require moduleName
      if (!moduleName || typeof moduleName !== 'string') {
        return apiError('moduleName is required for UE5 projects', 400);
      }
      const result = await scanUE5Project(projectPath, moduleName);
      return apiSuccess(result);
    }

    // Web-app / generic project
    const result = await scanWebAppProject(projectPath, info);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Internal server error');
  }
}
