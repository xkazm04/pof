/**
 * Shared project-context builder for all CLI prompts.
 *
 * Single source of truth for project metadata, engine paths, build commands,
 * CLI rules, and past build error memory. All prompt builders import from
 * here to avoid divergence.
 */

import type { SubModuleId } from '@/types/modules';
import type { ErrorContextEntry } from '@/types/error-memory';

export interface ProjectContext {
  projectName: string;
  projectPath: string;
  ueVersion: string;
  /** Dynamically scanned project state (classes, plugins, deps). Optional — omit if no scan data. */
  dynamicContext?: DynamicProjectContext | null;
}

/** Result of scanning the actual UE5 project files on disk. */
export interface DynamicProjectContext {
  scannedAt: string;
  classes: { name: string; prefix: string; headerPath: string }[];
  plugins: { name: string; enabled: boolean }[];
  buildDependencies: { module: string; type: 'public' | 'private' }[];
  sourceFileCount: number;
}

/**
 * Derive the UE module name from the project name.
 * In UE5, the default module shares the project name.
 */
export function getModuleName(projectName: string): string {
  return projectName || 'MyProject';
}

/**
 * Derive the API export macro from the module name.
 * UE convention: MODULE_API (e.g., Did → DID_API).
 */
export function getAPIMacro(moduleName: string): string {
  return `${moduleName.toUpperCase()}_API`;
}

/**
 * Derive the UE engine install path from the UE version string (e.g., "5.5.4" → "UE_5.5").
 * Supports both installed builds (Epic Games Launcher) and source builds.
 */
export function getEnginePath(ueVersion: string): string {
  const parts = ueVersion.split('.');
  const majorMinor = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : ueVersion;
  return `C:\\Program Files\\Epic Games\\UE_${majorMinor}`;
}

/**
 * Returns the minimum required MSVC toolchain version for a given UE version.
 * UE 5.7+ requires MSVC 14.44 (VS 2022 17.14+).
 */
export function getRequiredMSVCVersion(ueVersion: string): string {
  const parts = ueVersion.split('.').map(Number);
  if (parts[0] >= 5 && parts[1] >= 7) return '14.44';
  if (parts[0] >= 5 && parts[1] >= 4) return '14.38';
  return '14.34';
}

/**
 * Build the full build command for UnrealBuildTool.
 */
export function getBuildCommand(enginePath: string, moduleName: string, projectPath: string): string {
  const ubt = `"${enginePath}\\Engine\\Binaries\\DotNET\\UnrealBuildTool\\UnrealBuildTool.exe"`;
  const proj = `"-Project=${projectPath}\\${moduleName}.uproject"`;
  return `${ubt} ${moduleName}Editor Win64 Development ${proj} -WaitMutex`;
}

/**
 * Formats the dynamically scanned project state into a compact prompt section.
 * Groups classes by prefix (A=Actors, U=Objects, F=Structs, E=Enums).
 */
function formatDynamicContext(dc: DynamicProjectContext, moduleName: string): string {
  const lines: string[] = [];
  lines.push(`\n\n## Existing Project State (scanned from disk)`);
  lines.push(`- Source files: ${dc.sourceFileCount} (.h/.cpp)`);

  // Group classes by UE prefix
  if (dc.classes.length > 0) {
    const actors = dc.classes.filter((c) => c.prefix === 'A');
    const objects = dc.classes.filter((c) => c.prefix === 'U');
    const structs = dc.classes.filter((c) => c.prefix === 'F');
    const enums = dc.classes.filter((c) => c.prefix === 'E');
    const other = dc.classes.filter((c) => !c.prefix);

    lines.push(`- Total classes/types: ${dc.classes.length}`);
    if (actors.length > 0) {
      lines.push(`- Actors (A*): ${actors.map((c) => c.name).join(', ')}`);
    }
    if (objects.length > 0) {
      lines.push(`- UObjects (U*): ${objects.map((c) => c.name).join(', ')}`);
    }
    if (structs.length > 0) {
      lines.push(`- Structs (F*): ${structs.map((c) => c.name).join(', ')}`);
    }
    if (enums.length > 0) {
      lines.push(`- Enums (E*): ${enums.map((c) => c.name).join(', ')}`);
    }
    if (other.length > 0) {
      lines.push(`- Other types: ${other.map((c) => c.name).join(', ')}`);
    }
  } else {
    lines.push(`- No UCLASS/USTRUCT/UENUM types found yet in Source/${moduleName}/`);
  }

  // Build.cs dependencies
  if (dc.buildDependencies.length > 0) {
    const pub = dc.buildDependencies.filter((d) => d.type === 'public').map((d) => d.module);
    const priv = dc.buildDependencies.filter((d) => d.type === 'private').map((d) => d.module);
    if (pub.length > 0) lines.push(`- Build.cs public deps: ${pub.join(', ')}`);
    if (priv.length > 0) lines.push(`- Build.cs private deps: ${priv.join(', ')}`);
  }

  // Plugins
  if (dc.plugins.length > 0) {
    const enabled = dc.plugins.filter((p) => p.enabled).map((p) => p.name);
    if (enabled.length > 0) lines.push(`- Enabled plugins: ${enabled.join(', ')}`);
  }

  // Instructions for Claude
  lines.push('');
  lines.push('IMPORTANT: The classes listed above already exist. Do NOT recreate them. Instead, extend or use them. If you need a new class, check this list first to avoid duplicates.');

  return lines.join('\n');
}

// ── Module-specific domain context ──────────────────────────────────────────
// Merges the 19 prompt constants from core-engine, content, and game-systems
// into a single lookup keyed by moduleId (including genre sub-modules).

const DOMAIN_CONTEXT: Record<string, string> = {
  // Content modules (6) — from CONTENT_PROMPTS
  'models': 'You are helping with 3D model import pipelines, procedural mesh generation, and data table setup in UE5.',
  'animations': 'You are helping create animation systems including AnimBP, locomotion states, montages, and notifies in UE5.',
  'materials': 'You are helping create material systems including dynamic materials, post-process effects, and shaders in UE5. For 5.7+: Substrate is production-ready — prefer Substrate Slab over legacy shading models (Default Lit, Subsurface, Cloth) for new materials.',
  'level-design': 'You are helping with level design systems including living design documents, room/encounter flow, spawn systems, difficulty arcs, and bidirectional design-to-code synchronization in UE5. For 5.7+: PCG framework is production-ready for procedural content generation, MegaLights (beta) for dynamic lighting without lightmaps.',
  'ui-hud': 'You are helping create UI/HUD systems using UMG in UE5 C++ including menus, HUD elements, and inventory UI.',
  'audio': 'You are helping create spatial audio systems including audio volumes with reverb/attenuation/occlusion, sound emitter placement, Sound Cue randomization, sound pooling managers, and natural-language soundscape-to-code generation in UE5.',

  // Game Systems modules (7) — from GAME_SYSTEMS_PROMPTS
  'ai-behavior': 'You are helping create AI/NPC behavior systems including behavior trees, State Trees (5.7+ enhanced alternative to BTs), EQS, perception, combat AI, and scenario-based unit testing using UE5 Automation Framework with mock stimuli in UE5.',
  'physics': 'You are helping set up physics and collision systems including profiles, materials, projectiles, and destruction in UE5.',
  'multiplayer': 'You are helping implement multiplayer systems including replication, RPCs, and session management in UE5. For 5.7+: Iris replication system (beta) replaces UReplicationBridge with StartActorReplication API. Note: this is one of the most challenging areas.',
  'save-load': 'You are helping create save/load systems using USaveGame with auto-save and slot management in UE5.',
  'input-handling': 'You are helping set up input handling with Enhanced Input System including rebinding and gamepad support in UE5.',
  'dialogue-quests': 'You are helping create dialogue and quest systems with data-driven content and quest tracking in UE5.',
  'packaging': 'You are helping with build configuration, automation, and versioning for shipping UE5 games.',

  // Core Engine — aRPG genre sub-modules (12)
  // Mapped to the most relevant CORE_ENGINE_PROMPTS + cross-domain context
  'arpg-character': 'You are helping create UE5 C++ gameplay classes (GameMode, Character, Controller, GameInstance, etc.) for an action RPG. Focus on ACharacter subclasses, movement components, camera setup, and Enhanced Input integration.',
  'arpg-animation': 'You are helping create animation systems including AnimBP, locomotion states, montages, and notifies in UE5 for an action RPG. Focus on combat animation state machines, hit-react montages, and blend spaces.',
  'arpg-gas': 'You are helping integrate UE5 APIs including Gameplay Ability System, Enhanced Input, Navigation System, and other engine subsystems. Focus on GAS: AbilitySystemComponent, AttributeSets, GameplayEffects, GameplayTags, and ability activation.',
  'arpg-combat': 'You are helping implement game logic systems including state machines, scoring, and win/lose conditions in UE5 C++ for an action RPG. Focus on melee attack combos, hit detection, damage calculation, and combat state management.',
  'arpg-enemy-ai': 'You are helping create AI/NPC behavior systems including behavior trees, EQS, perception, combat AI, and scenario-based unit testing using UE5 Automation Framework with mock stimuli in UE5. Focus on enemy AI controllers, aggro, patrol, and attack patterns.',
  'arpg-inventory': 'You are helping implement game logic systems including state machines, scoring, and win/lose conditions in UE5 C++ for an action RPG. Focus on inventory data structures, item data assets, equipment slots, and stack management.',
  'arpg-loot': 'You are helping implement game logic systems including state machines, scoring, and win/lose conditions in UE5 C++ for an action RPG. Focus on loot tables, weighted random drops, rarity tiers, and world item spawning.',
  'arpg-ui': 'You are helping create UI/HUD systems using UMG in UE5 C++ including menus, HUD elements, and inventory UI for an action RPG. Focus on health/mana bars, ability hotbar, inventory grid, and floating damage numbers.',
  'arpg-progression': 'You are helping implement game logic systems including state machines, scoring, and win/lose conditions in UE5 C++ for an action RPG. Focus on XP gain, level-up systems, skill point allocation, and ability unlock trees.',
  'arpg-world': 'You are helping with level design systems including living design documents, room/encounter flow, spawn systems, difficulty arcs, and bidirectional design-to-code synchronization in UE5 for an action RPG. Focus on zone layouts, enemy placement, boss arenas, and level streaming.',
  'arpg-save': 'You are helping create save/load systems using USaveGame with auto-save and slot management in UE5 for an action RPG. Focus on serializing character progression, inventory state, world state, and quest progress.',
  'arpg-polish': 'You are helping set up debugging tools including custom log categories, debug draw helpers, and console commands for UE5. Also helping optimize UE5 game performance including object pooling, tick optimization, and async loading.',
};

/**
 * Get the domain-specific context string for a module, or undefined if none exists.
 */
export function getModuleDomainContext(moduleId: SubModuleId): string | undefined {
  return DOMAIN_CONTEXT[moduleId];
}

// ── Error memory formatting ─────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  'missing-include': 'Missing #include',
  'unresolved-external': 'Linker / unresolved external',
  'gc-issue': 'Garbage Collection',
  'type-mismatch': 'Type mismatch',
  'missing-module-dep': 'Missing Build.cs dependency',
  'uclass-macro': 'UCLASS macro',
  'forward-declaration': 'Incomplete type / forward decl',
  'linker-duplicate': 'Duplicate symbol',
  'syntax': 'Syntax error',
  'access-specifier': 'Access specifier',
  'generated-header': '.generated.h issue',
  'msvc-version': 'MSVC compiler version',
  'other': 'Build error',
};

/**
 * Formats past build errors into a compact prompt section.
 * Only included when there are relevant errors to warn about.
 */
function formatErrorMemory(errors: ErrorContextEntry[]): string {
  if (errors.length === 0) return '';

  const lines: string[] = [];
  lines.push('\n\n## Past Build Errors (avoid repeating these)');
  lines.push('The following errors have occurred previously in this project. Proactively avoid them:');

  for (const err of errors) {
    const label = CATEGORY_LABELS[err.category] || err.category;
    const codeStr = err.errorCode ? ` [${err.errorCode}]` : '';
    lines.push(`- **${label}**${codeStr}: ${err.fixDescription} (${err.occurrences} past occurrence${err.occurrences !== 1 ? 's' : ''})`);
  }

  return lines.join('\n');
}

/**
 * Options for the shared project context header.
 */
interface ContextHeaderOptions {
  /** Include the build command section (default: true) */
  includeBuildCommand?: boolean;
  /** Include the full rules block (default: true) */
  includeRules?: boolean;
  /** Extra rules to append after the standard ones */
  extraRules?: string[];
  /** Past build errors relevant to this task — injected as warnings */
  errorMemory?: ErrorContextEntry[];
}

/**
 * Builds the shared project context header used by all prompt types.
 *
 * This is the single source of truth for project metadata formatting.
 * All prompt builder functions should call this instead of formatting their own.
 */
export function buildProjectContextHeader(
  ctx: ProjectContext,
  opts: ContextHeaderOptions = {},
): string {
  const {
    includeBuildCommand = true,
    includeRules = true,
    extraRules = [],
    errorMemory = [],
  } = opts;

  const moduleName = getModuleName(ctx.projectName);
  const apiMacro = getAPIMacro(moduleName);
  const enginePath = getEnginePath(ctx.ueVersion);
  const buildCmd = getBuildCommand(enginePath, moduleName, ctx.projectPath);

  const msvcVersion = getRequiredMSVCVersion(ctx.ueVersion);

  let header = `## Project Context
- Project: "${moduleName}" at ${ctx.projectPath}
- UE Version: ${ctx.ueVersion}
- Module: ${moduleName} | API export macro: ${apiMacro}
- Source root: Source/${moduleName}/
- Engine: ${enginePath}
- Required MSVC toolchain: ${msvcVersion}+`;

  // Append dynamically scanned project state if available
  if (ctx.dynamicContext) {
    header += formatDynamicContext(ctx.dynamicContext, moduleName);
  }

  // Append past build error warnings if available
  if (errorMemory.length > 0) {
    header += formatErrorMemory(errorMemory);
  }

  if (includeBuildCommand) {
    header += `\n\n## Build Command\n${buildCmd}`;
  }

  if (includeRules) {
    const rules = [
      'Do NOT use TodoWrite or Task/Explore tools — all context is provided above.',
      'Do NOT explore the project structure. Your CWD is the project root.',
      `Source files live under Source/${moduleName}/.`,
      `Include paths: same-directory → \`#include "FileName.h"\`, cross-directory → \`#include "SubDir/FileName.h"\` (relative to Source/${moduleName}/).`,
      'UBA error code 9666 is normal — those actions retry without UBA and succeed.',
      ...(includeBuildCommand
        ? [
            'ALWAYS verify the build compiles after creating or modifying C++ files using the build command above.',
            'Quote ALL paths containing spaces in shell commands.',
            'If the build fails, read the error, fix the code, and rebuild — do not give up.',
          ]
        : []),
      ...extraRules,
    ];

    header += '\n\n## Rules\n' + rules.map((r) => `- ${r}`).join('\n');
  }

  return header;
}

