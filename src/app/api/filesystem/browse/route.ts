import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { apiSuccess, apiError } from '@/lib/api-utils';

interface ListResponse {
  path: string;
  parent: string | null;
  directories: { name: string; path: string; hasUProject: boolean }[];
  uprojectFiles: string[];
  isUEProject: boolean;
}

interface DetectedProject {
  name: string;
  path: string;
  uprojectFile: string;
  engineVersion: string | null;
  validated: boolean;
}

interface DetectProjectsResponse {
  projects: DetectedProject[];
}

interface DetectedEngine {
  version: string;
  path: string;
}

interface DetectEnginesResponse {
  engines: DetectedEngine[];
}

interface DetectedTool {
  id: string;
  name: string;
  ok: boolean;
  detail: string;
  path?: string;
}

interface DetectToolingResponse {
  tools: DetectedTool[];
}

interface ValidatePathResponse {
  exists: boolean;
  path: string;
}

interface DrivesResponse {
  drives: { letter: string; path: string }[];
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function findUProjectFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.uproject'))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

async function readEngineVersion(uprojectPath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(uprojectPath, 'utf-8');
    const json = JSON.parse(content);
    return json.EngineAssociation ?? null;
  } catch {
    return null;
  }
}

async function validateUEProject(dirPath: string): Promise<boolean> {
  try {
    const configDir = path.join(dirPath, 'Config', 'DefaultEngine.ini');
    await fs.access(configDir);
    return true;
  } catch {
    return false;
  }
}

async function getProjectsFromLauncher(): Promise<string[]> {
  // Epic Games Launcher stores installed apps in LauncherInstalled.dat
  // Format: { "InstallationList": [{ "InstallLocation": "...", "AppName": "...", ... }] }
  const launcherPaths = [
    path.join('C:', 'ProgramData', 'Epic', 'UnrealEngineLauncher', 'LauncherInstalled.dat'),
  ];

  // Also check for recently opened projects in GameUserSettings.ini
  const homeDir = os.homedir();
  const settingsPaths = [
    path.join(homeDir, 'AppData', 'Local', 'EpicGamesLauncher', 'Saved', 'Config', 'Windows', 'GameUserSettings.ini'),
  ];

  const projectPaths: string[] = [];

  // Parse LauncherInstalled.dat
  for (const datPath of launcherPaths) {
    try {
      const content = await fs.readFile(datPath, 'utf-8');
      const data = JSON.parse(content);
      const installations = data.InstallationList ?? [];
      for (const entry of installations) {
        const loc = entry.InstallLocation;
        if (typeof loc === 'string' && (await directoryExists(loc))) {
          const ufiles = await findUProjectFiles(loc);
          if (ufiles.length > 0) {
            projectPaths.push(loc);
          }
        }
      }
    } catch {
      // File doesn't exist or isn't parseable — skip
    }
  }

  // Parse GameUserSettings.ini for recent projects
  for (const iniPath of settingsPaths) {
    try {
      const content = await fs.readFile(iniPath, 'utf-8');
      // Look for lines like: CreatedProjects=...path... or RecentlyOpenedProjects=...path...
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/(?:CreatedProjects|RecentlyOpenedProjects|LastOpenedProjects)=(.+)/i);
        if (match) {
          const rawPath = match[1].trim();
          // Could be a .uproject file path or a directory
          const dirOfProject = rawPath.endsWith('.uproject') ? path.dirname(rawPath) : rawPath;
          if (await directoryExists(dirOfProject)) {
            projectPaths.push(dirOfProject);
          }
        }
      }
    } catch {
      // File doesn't exist — skip
    }
  }

  return projectPaths;
}

async function listSubdirectories(
  dirPath: string
): Promise<{ name: string; path: string; hasUProject: boolean }[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));

    const results = await Promise.all(
      dirs.map(async (d) => {
        const fullPath = path.join(dirPath, d.name);
        const uprojectFiles = await findUProjectFiles(fullPath);
        return {
          name: d.name,
          path: fullPath,
          hasUProject: uprojectFiles.length > 0,
        };
      })
    );

    return results.sort((a, b) => {
      if (a.hasUProject !== b.hasUProject) return a.hasUProject ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

async function getWindowsDrives(): Promise<{ letter: string; path: string }[]> {
  if (process.platform !== 'win32') {
    return [{ letter: '/', path: '/' }];
  }

  const drives: { letter: string; path: string }[] = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  await Promise.all(
    letters.split('').map(async (letter) => {
      const drivePath = `${letter}:\\`;
      if (await directoryExists(drivePath)) {
        drives.push({ letter, path: drivePath });
      }
    })
  );

  return drives.sort((a, b) => a.letter.localeCompare(b.letter));
}

async function addProjectIfNew(
  dirPath: string,
  uprojectFile: string,
  seen: Set<string>,
  projects: DetectedProject[]
): Promise<void> {
  const normalizedPath = path.normalize(dirPath);
  if (seen.has(normalizedPath)) return;
  seen.add(normalizedPath);

  const uprojectFullPath = path.join(dirPath, uprojectFile);
  const [engineVersion, validated] = await Promise.all([
    readEngineVersion(uprojectFullPath),
    validateUEProject(dirPath),
  ]);

  projects.push({
    name: uprojectFile.replace('.uproject', ''),
    path: dirPath,
    uprojectFile,
    engineVersion,
    validated,
  });
}

async function scanForEngines(): Promise<DetectedEngine[]> {
  const engines: DetectedEngine[] = [];
  const epicGamesDir = path.join('C:', 'Program Files', 'Epic Games');

  try {
    const entries = await fs.readdir(epicGamesDir, { withFileTypes: true });
    const ueDirs = entries.filter((e) => e.isDirectory() && e.name.startsWith('UE_'));

    await Promise.all(
      ueDirs.map(async (dir) => {
        const enginePath = path.join(epicGamesDir, dir.name);
        const buildVersionPath = path.join(enginePath, 'Engine', 'Build', 'Build.version');
        try {
          const content = await fs.readFile(buildVersionPath, 'utf-8');
          const json = JSON.parse(content);
          const major = json.MajorVersion ?? 0;
          const minor = json.MinorVersion ?? 0;
          const patch = json.PatchVersion ?? 0;
          engines.push({
            version: `${major}.${minor}.${patch}`,
            path: enginePath,
          });
        } catch {
          // Could not read Build.version — use folder name as fallback
          const versionMatch = dir.name.match(/UE_([\d.]+)/);
          if (versionMatch) {
            engines.push({
              version: versionMatch[1],
              path: enginePath,
            });
          }
        }
      })
    );
  } catch {
    // Epic Games directory doesn't exist — no engines found
  }

  return engines.sort((a, b) => b.version.localeCompare(a.version));
}

async function scanForTooling(): Promise<DetectedTool[]> {
  const tools: DetectedTool[] = [];

  // 1. Visual Studio — scan all version folders (years like "2022" and internal versions like "18")
  let vsFound = false;
  let vsDetail = 'Not found';
  let vsPath = '';
  const vsRoot = path.join('C:', 'Program Files', 'Microsoft Visual Studio');
  const vsEditions = ['Community', 'Professional', 'Enterprise'];
  // Map known internal version numbers to marketing names
  const vsVersionNames: Record<string, string> = { '18': '2025', '17': '2022', '16': '2019', '15': '2017' };
  try {
    const vsEntries = await fs.readdir(vsRoot, { withFileTypes: true });
    const vsFolders = vsEntries.filter((e) => e.isDirectory()).map((e) => e.name).sort().reverse();
    for (const folder of vsFolders) {
      for (const edition of vsEditions) {
        const p = path.join(vsRoot, folder, edition);
        if (await directoryExists(p)) {
          vsFound = true;
          const displayName = vsVersionNames[folder] ?? folder;
          vsDetail = `VS ${displayName} ${edition}`;
          vsPath = p;
          break;
        }
      }
      if (vsFound) break;
    }
  } catch {
    // VS root directory doesn't exist
  }
  tools.push({ id: 'vs', name: 'Visual Studio', ok: vsFound, detail: vsDetail, path: vsPath || undefined });

  // 2. C++ Build Tools (MSVC) — needed for UE C++ compilation
  let msvcFound = false;
  let msvcDetail = 'Install "Desktop development with C++" workload in VS';
  if (vsPath) {
    const msvcDir = path.join(vsPath, 'VC', 'Tools', 'MSVC');
    if (await directoryExists(msvcDir)) {
      try {
        const entries = await fs.readdir(msvcDir, { withFileTypes: true });
        const versions = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
        if (versions.length > 0) {
          msvcFound = true;
          msvcDetail = `MSVC ${versions[versions.length - 1]}`;
        }
      } catch {
        // Non-critical
      }
    }
  }
  tools.push({ id: 'msvc', name: 'C++ Build Tools', ok: msvcFound, detail: msvcDetail });

  // 3. Windows SDK
  let wsdkFound = false;
  let wsdkDetail = 'Install via VS Installer';
  const wsdkPath = path.join('C:', 'Program Files (x86)', 'Windows Kits', '10', 'Include');
  if (await directoryExists(wsdkPath)) {
    try {
      const entries = await fs.readdir(wsdkPath, { withFileTypes: true });
      const versions = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
      if (versions.length > 0) {
        wsdkFound = true;
        wsdkDetail = `SDK ${versions[versions.length - 1]}`;
      }
    } catch {
      // Non-critical
    }
  }
  tools.push({ id: 'wsdk', name: 'Windows SDK', ok: wsdkFound, detail: wsdkDetail });

  // 4. .NET 8.0 Runtime — UE 5.x UnrealBuildTool targets .NET 8.0 specifically
  //    (.NET 10 or 6 do NOT satisfy this — .NET has no backward runtime compat)
  //    On ARM64 Windows, x64 runtimes live under dotnet\x64\ — check both paths
  let dotnetFound = false;
  let dotnetDetail = 'Install .NET 8.0 Runtime';
  const runtimeSearchPaths = [
    path.join('C:', 'Program Files', 'dotnet', 'shared', 'Microsoft.NETCore.App'),
    path.join('C:', 'Program Files', 'dotnet', 'x64', 'shared', 'Microsoft.NETCore.App'),
  ];
  for (const runtimePath of runtimeSearchPaths) {
    if (dotnetFound) break;
    if (await directoryExists(runtimePath)) {
      try {
        const entries = await fs.readdir(runtimePath, { withFileTypes: true });
        const v8Dirs = entries.filter((e) => e.isDirectory() && e.name.startsWith('8.')).map((e) => e.name).sort();
        if (v8Dirs.length > 0) {
          dotnetFound = true;
          const arch = runtimePath.includes('x64') ? ' (x64)' : '';
          dotnetDetail = `.NET 8.0 Runtime ${v8Dirs[v8Dirs.length - 1]}${arch}`;
        }
      } catch {
        // Non-critical
      }
    }
  }
  tools.push({ id: 'dotnet', name: '.NET 8.0', ok: dotnetFound, detail: dotnetDetail });

  return tools;
}

async function scanForProjects(): Promise<DetectedProject[]> {
  const homeDir = os.homedir();
  const projects: DetectedProject[] = [];
  const seen = new Set<string>();

  // 1. Check Epic Games Launcher data first (most reliable)
  const launcherPaths = await getProjectsFromLauncher();
  for (const projPath of launcherPaths) {
    const ufiles = await findUProjectFiles(projPath);
    for (const uf of ufiles) {
      await addProjectIfNew(projPath, uf, seen, projects);
    }
  }

  // 2. Scan common project directories
  const candidateDirs = [
    path.join(homeDir, 'Documents', 'Unreal Projects'),
    path.join(homeDir, 'UE5Projects'),
    path.join(homeDir, 'UnrealProjects'),
    path.join(homeDir, 'Documents', 'UE5Projects'),
    path.join(homeDir, 'Documents', 'UnrealProjects'),
  ];

  // On Windows, also scan drive roots one level deep and UE engine install dirs
  if (process.platform === 'win32') {
    const drives = await getWindowsDrives();
    for (const drive of drives) {
      candidateDirs.push(drive.path);
    }

    // UE engine install dirs sometimes contain sample projects
    const engines = await scanForEngines();
    for (const engine of engines) {
      candidateDirs.push(engine.path);
    }
  }

  for (const dir of candidateDirs) {
    if (!(await directoryExists(dir))) continue;

    // Check if this dir itself is a UE project
    const rootUprojects = await findUProjectFiles(dir);
    for (const uf of rootUprojects) {
      await addProjectIfNew(dir, uf, seen, projects);
    }

    // Scan one level of subdirectories
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const subdirs = entries.filter(
        (e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('$')
      );

      await Promise.all(
        subdirs.map(async (subdir) => {
          const subdirPath = path.join(dir, subdir.name);
          const uprojectFiles = await findUProjectFiles(subdirPath);
          for (const uf of uprojectFiles) {
            await addProjectIfNew(subdirPath, uf, seen, projects);
          }
        })
      );
    } catch {
      // Skip dirs we can't read
    }
  }

  // Sort: validated projects first, then by name
  return projects.sort((a, b) => {
    if (a.validated !== b.validated) return a.validated ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function resolvePath(input: string): string {
  if (input === '~' || input.startsWith('~/') || input.startsWith('~\\')) {
    return path.join(os.homedir(), input.slice(1));
  }
  return input;
}

async function handleList(requestedPath: string) {
  const normalized = path.normalize(resolvePath(requestedPath));

  if (!(await directoryExists(normalized))) {
    return apiSuccess({
      path: normalized,
      parent: path.dirname(normalized),
      directories: [] as { name: string; path: string; hasUProject: boolean }[],
      uprojectFiles: [] as string[],
      isUEProject: false,
    });
  }

  const [directories, uprojectFiles] = await Promise.all([
    listSubdirectories(normalized),
    findUProjectFiles(normalized),
  ]);

  const parent = path.dirname(normalized);

  return apiSuccess({
    path: normalized,
    parent: parent !== normalized ? parent : null,
    directories,
    uprojectFiles,
    isUEProject: uprojectFiles.length > 0,
  });
}

// ── Bootstrap command generation ──

interface BootstrapResult {
  missingTools: string[];
  commands: string[];
  prompt: string;
  allInstalled: boolean;
}

function generateBootstrapCommands(tools: DetectedTool[], engines: DetectedEngine[]): BootstrapResult {
  const missing: string[] = [];
  const commands: string[] = [];

  const vs = tools.find((t) => t.id === 'vs');
  const msvc = tools.find((t) => t.id === 'msvc');
  const wsdk = tools.find((t) => t.id === 'wsdk');
  const dotnet = tools.find((t) => t.id === 'dotnet');

  // VS + MSVC + Windows SDK are bundled via VS workload install
  if (!vs?.ok || !msvc?.ok || !wsdk?.ok) {
    if (!vs?.ok) {
      missing.push('Visual Studio 2022');
      commands.push(
        'winget install Microsoft.VisualStudio.2022.Community --silent --override "--add Microsoft.VisualStudio.Workload.NativeDesktopDevelopment --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --includeRecommended"'
      );
    } else if (!msvc?.ok || !wsdk?.ok) {
      // VS is installed but missing workloads — modify existing installation
      const addParts: string[] = [];
      if (!msvc?.ok) {
        missing.push('C++ Build Tools (MSVC)');
        addParts.push('--add Microsoft.VisualStudio.Workload.NativeDesktopDevelopment');
        addParts.push('--add Microsoft.VisualStudio.Component.VC.Tools.x86.x64');
      }
      if (!wsdk?.ok) {
        missing.push('Windows SDK');
        addParts.push('--add Microsoft.VisualStudio.Component.Windows11SDK.22621');
      }
      commands.push(
        `"C:\\Program Files\\Microsoft Visual Studio\\Installer\\vs_installer.exe" modify --installPath "${vs.path}" ${addParts.join(' ')} --quiet`
      );
    }
  }

  if (!dotnet?.ok) {
    missing.push('.NET 8.0 Runtime');
    commands.push('winget install Microsoft.DotNet.Runtime.8 --silent');
  }

  if (engines.length === 0) {
    missing.push('Unreal Engine');
    // Can't install UE via winget — direct to Epic Games Launcher
    commands.push('winget install EpicGames.EpicGamesLauncher --silent');
  }

  const allInstalled = missing.length === 0;

  // Build CLI prompt
  let prompt = '';
  if (!allInstalled) {
    const commandBlock = commands.map((cmd, i) => `${i + 1}. \`${cmd}\``).join('\n');
    prompt = `Install the following missing developer tools for UE5 C++ development on this Windows machine.

MISSING TOOLS: ${missing.join(', ')}

Run these commands in sequence (each requires admin privileges — use PowerShell with elevation if needed):

${commandBlock}

INSTRUCTIONS:
- Run each command one at a time and wait for it to complete before running the next.
- If winget is not available, download and install from the direct URLs instead:
  - Visual Studio 2022 Community: https://visualstudio.microsoft.com/downloads/
  - .NET 8.0 Runtime: https://dotnet.microsoft.com/en-us/download/dotnet/8.0
  - Epic Games Launcher: https://www.unrealengine.com/download
- After all installs complete, report which tools were successfully installed.
- Do NOT use TodoWrite.`;
  }

  return { missingTools: missing, commands, prompt, allInstalled };
}

// ── Environment manifest ──

interface EnvironmentManifest {
  version: 1;
  platform: string;
  generatedAt: string;
  tools: {
    id: string;
    name: string;
    installed: boolean;
    detail: string;
    installCommand?: string;
  }[];
  engines: {
    version: string;
    path: string;
  }[];
}

function buildEnvironmentManifest(tools: DetectedTool[], engines: DetectedEngine[]): EnvironmentManifest {
  const installCommands: Record<string, string> = {
    vs: 'winget install Microsoft.VisualStudio.2022.Community --silent --override "--add Microsoft.VisualStudio.Workload.NativeDesktopDevelopment --includeRecommended"',
    msvc: '(included with VS Desktop Development workload)',
    wsdk: '(included with VS Desktop Development workload)',
    dotnet: 'winget install Microsoft.DotNet.Runtime.8 --silent',
  };

  return {
    version: 1,
    platform: process.platform,
    generatedAt: new Date().toISOString(),
    tools: tools.map((t) => ({
      id: t.id,
      name: t.name,
      installed: t.ok,
      detail: t.detail,
      installCommand: installCommands[t.id],
    })),
    engines: engines.map((e) => ({
      version: e.version,
      path: e.path,
    })),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, path: requestedPath } = body;

    switch (action) {
      case 'list': {
        if (!requestedPath) {
          return apiError('path is required for list action', 400);
        }
        return handleList(requestedPath);
      }

      case 'detect-projects': {
        const projects = await scanForProjects();
        return apiSuccess({ projects } satisfies DetectProjectsResponse);
      }

      case 'detect-engines': {
        const engines = await scanForEngines();
        return apiSuccess({ engines } satisfies DetectEnginesResponse);
      }

      case 'detect-tooling': {
        const tools = await scanForTooling();
        return apiSuccess({ tools } satisfies DetectToolingResponse);
      }

      case 'validate-path': {
        if (!requestedPath) {
          return apiError('path is required for validate-path action', 400);
        }
        const normalized = path.normalize(resolvePath(requestedPath));
        const exists = await directoryExists(normalized);
        return apiSuccess({ exists, path: normalized } satisfies ValidatePathResponse);
      }

      case 'drives': {
        const drives = await getWindowsDrives();
        return apiSuccess({ drives } satisfies DrivesResponse);
      }

      case 'generate-bootstrap': {
        const tools = await scanForTooling();
        const engines = await scanForEngines();
        const bootstrap = generateBootstrapCommands(tools, engines);
        return apiSuccess(bootstrap);
      }

      case 'export-manifest': {
        const manifestTools = await scanForTooling();
        const manifestEngines = await scanForEngines();
        const manifest = buildEnvironmentManifest(manifestTools, manifestEngines);
        return apiSuccess({ manifest });
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Internal server error');
  }
}
