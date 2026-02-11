import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

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

async function handleList(requestedPath: string): Promise<NextResponse<ListResponse>> {
  const normalized = path.normalize(resolvePath(requestedPath));

  if (!(await directoryExists(normalized))) {
    return NextResponse.json(
      {
        path: normalized,
        parent: path.dirname(normalized),
        directories: [],
        uprojectFiles: [],
        isUEProject: false,
      },
      { status: 404 }
    );
  }

  const [directories, uprojectFiles] = await Promise.all([
    listSubdirectories(normalized),
    findUProjectFiles(normalized),
  ]);

  const parent = path.dirname(normalized);

  return NextResponse.json({
    path: normalized,
    parent: parent !== normalized ? parent : null,
    directories,
    uprojectFiles,
    isUEProject: uprojectFiles.length > 0,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, path: requestedPath } = body;

    switch (action) {
      case 'list': {
        if (!requestedPath) {
          return NextResponse.json({ error: 'path is required for list action' }, { status: 400 });
        }
        return handleList(requestedPath);
      }

      case 'detect-projects': {
        const projects = await scanForProjects();
        return NextResponse.json({ projects } satisfies DetectProjectsResponse);
      }

      case 'detect-engines': {
        const engines = await scanForEngines();
        return NextResponse.json({ engines } satisfies DetectEnginesResponse);
      }

      case 'detect-tooling': {
        const tools = await scanForTooling();
        return NextResponse.json({ tools } satisfies DetectToolingResponse);
      }

      case 'validate-path': {
        if (!requestedPath) {
          return NextResponse.json({ error: 'path is required for validate-path action' }, { status: 400 });
        }
        const normalized = path.normalize(resolvePath(requestedPath));
        const exists = await directoryExists(normalized);
        return NextResponse.json({ exists, path: normalized } satisfies ValidatePathResponse);
      }

      case 'drives': {
        const drives = await getWindowsDrives();
        return NextResponse.json({ drives } satisfies DrivesResponse);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
