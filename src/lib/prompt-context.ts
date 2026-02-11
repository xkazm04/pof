/**
 * Builds a rich project-context prefix for checklist prompts sent to the CLI.
 *
 * Eliminates the need for the CLI to explore the project — all critical
 * information (paths, build command, conventions) is injected directly.
 */

export interface ProjectContext {
  projectName: string;
  projectPath: string;
  ueVersion: string;
}

/**
 * Derive the UE module name from the project name.
 * In UE5, the default module shares the project name.
 */
function getModuleName(projectName: string): string {
  return projectName || 'MyProject';
}

/**
 * Derive the API export macro from the module name.
 * UE convention: MODULE_API (e.g., Did → DID_API).
 */
function getAPIMacro(moduleName: string): string {
  return `${moduleName.toUpperCase()}_API`;
}

/**
 * Derive the UE engine install path from the UE version string (e.g., "5.5.4" → "UE_5.5").
 */
function getEnginePath(ueVersion: string): string {
  const parts = ueVersion.split('.');
  const majorMinor = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : ueVersion;
  return `C:\\Program Files\\Epic Games\\UE_${majorMinor}`;
}

/**
 * Build the full build command for UnrealBuildTool.
 */
function getBuildCommand(enginePath: string, moduleName: string, projectPath: string): string {
  const ubt = `"${enginePath}\\Engine\\Binaries\\DotNET\\UnrealBuildTool\\UnrealBuildTool.exe"`;
  const proj = `"-Project=${projectPath}\\${moduleName}.uproject"`;
  return `${ubt} ${moduleName}Editor Win64 Development ${proj} -WaitMutex`;
}

/**
 * Wraps a checklist item prompt with full project context so the CLI
 * can execute immediately without exploring.
 */
export function buildChecklistPrompt(
  taskPrompt: string,
  ctx: ProjectContext
): string {
  const moduleName = getModuleName(ctx.projectName);
  const apiMacro = getAPIMacro(moduleName);
  const enginePath = getEnginePath(ctx.ueVersion);
  const buildCmd = getBuildCommand(enginePath, moduleName, ctx.projectPath);

  return `## Project Context
- Project: "${moduleName}" at ${ctx.projectPath}
- UE Version: ${ctx.ueVersion}
- Module: ${moduleName} | API export macro: ${apiMacro}
- Source root: Source/${moduleName}/
- Engine: ${enginePath}

## Build Command
${buildCmd}

## Rules
- Do NOT use TodoWrite or Task/Explore tools — all context is provided above.
- Do NOT explore the project structure. Your CWD is the project root.
- Source files live under Source/${moduleName}/.
- Include paths: same-directory → \`#include "FileName.h"\`, cross-directory → \`#include "SubDir/FileName.h"\` (relative to Source/${moduleName}/).
- UBA error code 9666 is normal — those actions retry without UBA and succeed.
- ALWAYS verify the build compiles after creating or modifying C++ files using the build command above.
- Quote ALL paths containing spaces in shell commands.
- If the build fails, read the error, fix the code, and rebuild — do not give up.

## Task
${taskPrompt}`;
}
