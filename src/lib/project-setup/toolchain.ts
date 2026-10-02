/**
 * The UE5 toolchain requirement table — the ONE declaration of what a machine
 * needs to build a UE C++ project (engine, Visual Studio, MSVC, Windows SDK,
 * .NET 8). Client-safe and pure: the scan route's detectors key their results
 * by `id`, and every surface derives from these rows — the missing count, the
 * bootstrap plan, the environment manifest, the install links and the manifest
 * import. A new requirement is one row here.
 */
import { ok, err, type Result } from '@/types/result';

export type ToolId = 'engine' | 'vs' | 'msvc' | 'wsdk' | 'dotnet';

export interface ToolchainRow {
  id: ToolId;
  /** Checklist item id produced by useProjectScan. */
  checklistId: string;
  /** Name the scan reports. */
  name: string;
  /** Name used in "missing" lists and install prompts. */
  requirement: string;
  installUrl: string;
  installLabel: string;
  /** VS installer components that provide this row (installed via vs_installer modify). */
  vsComponents?: string[];
}

export interface DetectedTool { id: string; name: string; ok: boolean; detail: string; path?: string }
export interface DetectedEngine { version: string; path: string }
/** The checklist shape this module reads (structurally the useProjectScan ChecklistItem). */
export interface RequirementItem { id: string; ok: boolean; subDetail?: string }

const VS_WORKLOAD = 'Microsoft.VisualStudio.Workload.NativeDesktopDevelopment';
const VS_VC_TOOLS = 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64';
const VS_WIN_SDK = 'Microsoft.VisualStudio.Component.Windows11SDK.22621';

const VS_INSTALL = `winget install Microsoft.VisualStudio.2022.Community --silent --override "--add ${VS_WORKLOAD} --add ${VS_VC_TOOLS} --add ${VS_WIN_SDK} --includeRecommended"`;
const DOTNET_INSTALL = 'winget install Microsoft.DotNet.Runtime.8 --silent';
const LAUNCHER_INSTALL = 'winget install EpicGames.EpicGamesLauncher --silent';

export const TOOLCHAIN: readonly ToolchainRow[] = [
  { id: 'engine', checklistId: 'engine', name: 'Unreal Engine', requirement: 'Unreal Engine',
    installUrl: 'https://www.unrealengine.com/download', installLabel: 'Get Epic Launcher' },
  { id: 'vs', checklistId: 'tool-vs', name: 'Visual Studio', requirement: 'Visual Studio 2022',
    installUrl: 'https://visualstudio.microsoft.com/downloads/', installLabel: 'Get Visual Studio' },
  { id: 'msvc', checklistId: 'tool-msvc', name: 'C++ Build Tools', requirement: 'C++ Build Tools (MSVC)',
    installUrl: 'https://visualstudio.microsoft.com/visual-cpp-build-tools/', installLabel: 'Get C++ Build Tools',
    vsComponents: [VS_WORKLOAD, VS_VC_TOOLS] },
  { id: 'wsdk', checklistId: 'tool-wsdk', name: 'Windows SDK', requirement: 'Windows SDK',
    installUrl: 'https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/', installLabel: 'Get Windows SDK',
    vsComponents: [VS_WIN_SDK] },
  { id: 'dotnet', checklistId: 'tool-dotnet', name: '.NET 8.0', requirement: '.NET 8.0 Runtime',
    installUrl: 'https://dotnet.microsoft.com/en-us/download/dotnet/8.0', installLabel: 'Get .NET 8.0 Runtime' },
];

const BY_ID = new Map<string, ToolchainRow>(TOOLCHAIN.map((r) => [r.id, r]));
const BY_CHECKLIST_ID = new Map<string, ToolchainRow>(TOOLCHAIN.map((r) => [r.checklistId, r]));

export function toolRow(id: ToolId): ToolchainRow {
  return BY_ID.get(id)!;
}

/** Install link for a checklist item id, or undefined when the item is not a requirement. */
export function installLinkFor(checklistId: string): { url: string; label: string } | undefined {
  const row = BY_CHECKLIST_ID.get(checklistId);
  return row && { url: row.installUrl, label: row.installLabel };
}

function vsModify(vsPath: string, components: string[]): string {
  const addParts = components.map((c) => `--add ${c}`).join(' ');
  return `"C:\\Program Files\\Microsoft Visual Studio\\Installer\\vs_installer.exe" modify --installPath "${vsPath}" ${addParts} --quiet`;
}

/** The runnable install command for one row; VS components modify an existing VS when its path is known. */
export function installCommand(id: ToolId, vsPath?: string): string {
  const row = toolRow(id);
  if (row.vsComponents) return vsPath ? vsModify(vsPath, row.vsComponents) : VS_INSTALL;
  if (id === 'vs') return VS_INSTALL;
  if (id === 'dotnet') return DOTNET_INSTALL;
  return LAUNCHER_INSTALL;
}

/** Checklist ids of the requirements that are present and failing, in checklist order. */
export function missingRequirements(checklist: readonly RequirementItem[]): string[] {
  return checklist.filter((c) => !c.ok && BY_CHECKLIST_ID.has(c.id)).map((c) => c.id);
}

// ── Bootstrap plan (the "Fix N Missing" CLI task) ──

export interface BootstrapPlan { missingTools: string[]; commands: string[]; prompt: string; allInstalled: boolean }

export function buildBootstrapPlan(tools: readonly DetectedTool[], engines: readonly DetectedEngine[]): BootstrapPlan {
  const missing: string[] = [];
  const commands: string[] = [];
  const has = (id: ToolId) => tools.find((t) => t.id === id)?.ok ?? false;
  const vs = tools.find((t) => t.id === 'vs');

  // VS + MSVC + Windows SDK are bundled: install VS with the workload, or modify the existing VS.
  if (!has('vs')) {
    missing.push(toolRow('vs').requirement);
    commands.push(VS_INSTALL);
  } else {
    const lacking = (['msvc', 'wsdk'] as const).filter((id) => !has(id)).map(toolRow);
    if (lacking.length > 0) {
      missing.push(...lacking.map((r) => r.requirement));
      commands.push(vsModify(vs?.path ?? '', lacking.flatMap((r) => r.vsComponents ?? [])));
    }
  }
  if (!has('dotnet')) {
    missing.push(toolRow('dotnet').requirement);
    commands.push(DOTNET_INSTALL);
  }
  if (engines.length === 0) {
    // UE itself is not on winget — install the Epic Games Launcher.
    missing.push(toolRow('engine').requirement);
    commands.push(LAUNCHER_INSTALL);
  }

  const allInstalled = missing.length === 0;
  let prompt = '';
  if (!allInstalled) {
    const commandBlock = commands.map((cmd, i) => `${i + 1}. \`${cmd}\``).join('\n');
    const url = (id: ToolId) => toolRow(id).installUrl;
    prompt = `Install the following missing developer tools for UE5 C++ development on this Windows machine.

MISSING TOOLS: ${missing.join(', ')}

Run these commands in sequence (each requires admin privileges — use PowerShell with elevation if needed):

${commandBlock}

INSTRUCTIONS:
- Run each command one at a time and wait for it to complete before running the next.
- If winget is not available, download and install from the direct URLs instead:
  - Visual Studio 2022 Community: ${url('vs')}
  - .NET 8.0 Runtime: ${url('dotnet')}
  - Epic Games Launcher: ${url('engine')}
- After all installs complete, report which tools were successfully installed.
- Do NOT use TodoWrite.`;
  }
  return { missingTools: missing, commands, prompt, allInstalled };
}

// ── Environment manifest (export) ──

export interface ManifestTool { id: string; name: string; installed: boolean; detail: string; installCommand?: string; category?: string }

export interface EnvironmentManifest {
  version: 1;
  platform: string;
  generatedAt: string;
  tools: ManifestTool[];
  engines: DetectedEngine[];
}

/** The exporter's environment: one row per requirement (engine included), each with its table command. */
export function buildEnvironmentManifest(
  tools: readonly DetectedTool[],
  engines: readonly DetectedEngine[],
  meta: { platform: string; generatedAt?: string },
): EnvironmentManifest {
  const vsPath = tools.find((t) => t.id === 'vs' && t.ok)?.path;
  const engineRow: ManifestTool = {
    id: 'engine',
    name: toolRow('engine').name,
    installed: engines.length > 0,
    detail: engines[0] ? `UE ${engines[0].version}` : 'Not found',
    installCommand: installCommand('engine'),
  };
  return {
    version: 1,
    platform: meta.platform,
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    tools: [
      engineRow,
      ...tools.map((t) => ({
        id: t.id,
        name: t.name,
        installed: t.ok,
        detail: t.detail,
        installCommand: BY_ID.has(t.id) ? installCommand(t.id as ToolId, vsPath) : undefined,
      })),
    ],
    engines: engines.map((e) => ({ version: e.version, path: e.path })),
  };
}

// ── Manifest import ──

/** A pasted manifest: only `tools` is required; every field is untrusted. */
export interface ImportedManifest { tools: Partial<ManifestTool>[] }

export function parseManifest(text: string): Result<ImportedManifest, string> {
  try {
    const parsed: unknown = JSON.parse(text);
    const tools = (parsed as { tools?: unknown } | null)?.tools;
    if (!Array.isArray(tools)) return err('Missing "tools" array in manifest');
    return ok(parsed as ImportedManifest);
  } catch (e) {
    return err(e instanceof SyntaxError ? e.message : 'Invalid JSON');
  }
}

export type ImportSkipReason = 'teammate-lacks' | 'present' | 'not-scanned';

export interface ManifestImportPlan {
  installs: { id: ToolId; name: string; command: string }[];
  skipped: { id: ToolId; reason: ImportSkipReason }[];
  /** Manifest ids the table does not know — never installed. */
  ignored: string[];
  /** The CLI prompt, or null when there is nothing to install. */
  prompt: string | null;
}

/**
 * Plan an import: install what the teammate HAS and this machine LACKS. The
 * diff is against the LOCAL checklist, an absent local row is unknown (not
 * scanned), never "lacks", and every command comes from the table by id — a
 * command pasted into the manifest is never forwarded to the CLI.
 */
export function planManifestImport(manifest: ImportedManifest, local: readonly RequirementItem[]): ManifestImportPlan {
  const plan: ManifestImportPlan = { installs: [], skipped: [], ignored: [], prompt: null };
  const localVs = local.find((c) => c.id === toolRow('vs').checklistId);
  const vsPath = localVs?.ok ? localVs.subDetail : undefined;
  const seen = new Set<string>();

  for (const t of manifest.tools) {
    const id = typeof t?.id === 'string' ? t.id : String(t?.id);
    const row = BY_ID.get(id);
    if (!row) { plan.ignored.push(id); continue; }
    if (seen.has(id)) continue;
    seen.add(id);
    const mine = local.find((c) => c.id === row.checklistId);
    if (t.installed !== true) plan.skipped.push({ id: row.id, reason: 'teammate-lacks' });
    else if (!mine) plan.skipped.push({ id: row.id, reason: 'not-scanned' });
    else if (mine.ok) plan.skipped.push({ id: row.id, reason: 'present' });
    else plan.installs.push({ id: row.id, name: row.requirement, command: installCommand(row.id, vsPath) });
  }

  if (plan.installs.length > 0) {
    // VS components share one command when VS itself is installed fresh — list each command once.
    const byCommand = new Map<string, string[]>();
    for (const i of plan.installs) byCommand.set(i.command, [...(byCommand.get(i.command) ?? []), i.name]);
    const lines = [...byCommand].map(([cmd, names]) => `- ${names.join(' + ')}: \`${cmd}\``).join('\n');
    plan.prompt = `A teammate shared their environment manifest. Install the following missing tools:\n\n${lines}\n\nRun each command and report the result. Do NOT use TodoWrite.`;
  }
  return plan;
}
