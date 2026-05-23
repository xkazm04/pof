/**
 * Packaging pre-flight checks — pure, testable logic.
 *
 * Catches the build-config defect class that wasted multiple cook runs during
 * the vertical-slice initiative (SP-C): an empty `ProjectID`, an unset
 * `GameDefaultMap`, an editor-only API used unguarded in a plugin Runtime
 * module. Running these *before* a 30-minute cook fails fast and diagnosably.
 *
 * Everything here is pure (string/array in, result out). The API route at
 * `/api/packaging/preflight` does the filesystem reads + the UBT spawn and
 * feeds the results through these functions.
 */

export type PreflightStatus = 'pass' | 'fail' | 'warn';

export interface PreflightCheckResult {
  /** Stable id for the check (used as the panel tile testId). */
  id: string;
  /** Human label for the tile. */
  label: string;
  status: PreflightStatus;
  /** One-line summary. */
  detail: string;
  /** Specific issues found (empty when pass). */
  issues: string[];
}

// ── INI parsing ─────────────────────────────────────────────────────────────

/**
 * Read a flat `Key=Value` from a `[Section]` of an INI file's text.
 * Returns the raw value (may be empty string), or null if the key is absent.
 * Scans only within the requested section (until the next `[...]` header).
 */
export function iniValue(
  content: string | null,
  section: string,
  key: string,
): string | null {
  if (!content) return null;
  const lines = content.split(/\r?\n/);
  let inSection = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('[') && line.endsWith(']')) {
      inSection = line.slice(1, -1) === section;
      continue;
    }
    if (!inSection) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    if (line.slice(0, eq).trim() === key) {
      return line.slice(eq + 1).trim();
    }
  }
  return null;
}

// ── Config sanity ───────────────────────────────────────────────────────────

export interface ConfigSanityInput {
  /** Contents of `Config/DefaultGame.ini`, or null if the file is missing. */
  defaultGameIni: string | null;
  /** Contents of `Config/DefaultEngine.ini`, or null if missing. */
  defaultEngineIni: string | null;
  /**
   * Whether the configured `GameDefaultMap` `.umap` resolves on disk. The
   * caller resolves the path; null means "not checked / no map configured".
   */
  defaultMapExists?: boolean | null;
}

const GENERAL_SETTINGS = '/Script/EngineSettings.GeneralProjectSettings';
const MAP_SETTINGS = '/Script/EngineSettings.GameMapsSettings';

/**
 * Verify the project config is cook-ready: a non-empty `ProjectID` (the cook
 * commandlet errors on a blank one), a `GameDefaultMap` + `GlobalDefaultGameMode`
 * set (a packaged game with neither launches into nothing — SP-E found exactly
 * that), and the configured map actually present on disk.
 */
export function checkConfigSanity(input: ConfigSanityInput): PreflightCheckResult {
  const issues: string[] = [];
  let status: PreflightStatus = 'pass';

  if (input.defaultGameIni === null) {
    issues.push('Config/DefaultGame.ini not found.');
  }
  if (input.defaultEngineIni === null) {
    issues.push('Config/DefaultEngine.ini not found.');
  }

  // ProjectID — empty value is a hard cook failure.
  const projectId = iniValue(input.defaultGameIni, GENERAL_SETTINGS, 'ProjectID');
  if (projectId === null || projectId === '') {
    issues.push('ProjectID is empty — the cook commandlet rejects a blank ProjectID. Set a GUID in [/Script/EngineSettings.GeneralProjectSettings].');
    status = 'fail';
  }

  // GameDefaultMap / GlobalDefaultGameMode — a packaged build with neither
  // launches into a black screen. Warn, do not hard-fail the pre-flight.
  const gameDefaultMap = iniValue(input.defaultEngineIni, MAP_SETTINGS, 'GameDefaultMap');
  if (gameDefaultMap === null || gameDefaultMap === '') {
    issues.push('GameDefaultMap is not set — the packaged build will not load a level on launch.');
    if (status !== 'fail') status = 'warn';
  } else if (input.defaultMapExists === false) {
    issues.push(`GameDefaultMap is set to "${gameDefaultMap}" but no matching .umap was found on disk.`);
    status = 'fail';
  }

  const gameMode = iniValue(input.defaultEngineIni, MAP_SETTINGS, 'GlobalDefaultGameMode');
  if (gameMode === null || gameMode === '') {
    issues.push('GlobalDefaultGameMode is not set — the packaged build has no default game mode.');
    if (status !== 'fail') status = 'warn';
  }

  return {
    id: 'config-sanity',
    label: 'Config sanity',
    status,
    detail:
      status === 'pass'
        ? 'ProjectID, default map, and game mode are configured.'
        : `${issues.length} config issue${issues.length === 1 ? '' : 's'}.`,
    issues,
  };
}

// ── WITH_EDITOR audit ───────────────────────────────────────────────────────

export interface SourceFile {
  path: string;
  content: string;
}

export interface WithEditorViolation {
  path: string;
  line: number;
  token: string;
  text: string;
}

/**
 * Editor-only API tokens. Using any of these in a plugin *Runtime* module
 * without a `#if WITH_EDITOR` guard breaks the Shipping build (SP-C hit this
 * with an unguarded `FEditorDelegates::PostPIEStarted.RemoveAll(this)` in the
 * bridge plugin's runtime module). AssetRegistry is intentionally NOT here —
 * it is a runtime module.
 */
const EDITOR_ONLY_TOKENS = [
  'FEditorDelegates',
  'GEditor',
  'GUnrealEd',
  'UnrealEdEngine',
  'IAssetTools',
  'FAssetToolsModule',
  'FEditorScriptExecutionGuard',
  'WITH_EDITOR_ONLY_REMOVE', // sentinel, never matches real code
];

/** Tokens that appear in `#include` lines pulling editor-only headers. */
const EDITOR_ONLY_INCLUDES = [
  '"Editor.h"',
  'UnrealEdGlobals.h',
  'Editor/UnrealEdEngine.h',
  'AssetToolsModule.h',
  'IAssetTools.h',
];

/**
 * Scan Runtime-module source files for editor-only API usage that is NOT
 * inside a `#if WITH_EDITOR` (or `WITH_EDITORONLY_DATA`) preprocessor guard.
 *
 * The scanner tracks `#if` / `#endif` nesting and whether the current block is
 * (transitively) guarded by a WITH_EDITOR condition. A flagged token on an
 * unguarded line is a violation. `#include` of an editor-only header is also
 * a violation when unguarded (the include itself fails to resolve in a
 * Shipping/non-editor build).
 */
export function auditWithEditor(files: SourceFile[]): WithEditorViolation[] {
  const violations: WithEditorViolation[] = [];
  const editorGuard = /^#if\s+(?:.*\b)?(WITH_EDITOR|WITH_EDITORONLY_DATA)\b/;

  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    // Stack of booleans: is this #if level a WITH_EDITOR guard?
    const guardStack: boolean[] = [];
    const isGuarded = () => guardStack.some(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (/^#if/.test(trimmed)) {
        guardStack.push(editorGuard.test(trimmed));
        continue;
      }
      if (/^#endif/.test(trimmed)) {
        guardStack.pop();
        continue;
      }
      // #else / #elif keep the same nesting level; leave the stack as-is.
      if (/^#(else|elif)/.test(trimmed)) {
        continue;
      }

      if (isGuarded()) continue;

      // Strip a trailing `// ...` comment so commented-out code is ignored.
      const code = trimmed.replace(/\/\/.*$/, '');
      if (!code) continue;

      if (/^#include/.test(code)) {
        const hit = EDITOR_ONLY_INCLUDES.find((inc) => code.includes(inc));
        if (hit) {
          violations.push({ path: file.path, line: i + 1, token: hit, text: trimmed });
        }
        continue;
      }

      for (const token of EDITOR_ONLY_TOKENS) {
        if (token === 'WITH_EDITOR_ONLY_REMOVE') continue;
        // word-boundary match
        const re = new RegExp(`\\b${token}\\b`);
        if (re.test(code)) {
          violations.push({ path: file.path, line: i + 1, token, text: trimmed });
          break;
        }
      }
    }
  }

  return violations;
}

/** Wrap WITH_EDITOR audit violations into a pre-flight check result. */
export function withEditorCheckResult(violations: WithEditorViolation[]): PreflightCheckResult {
  return {
    id: 'with-editor-audit',
    label: 'Plugin WITH_EDITOR audit',
    status: violations.length === 0 ? 'pass' : 'fail',
    detail:
      violations.length === 0
        ? 'No unguarded editor-only API in Runtime-module sources.'
        : `${violations.length} unguarded editor-only API use${violations.length === 1 ? '' : 's'} — breaks the Shipping build.`,
    issues: violations.map((v) => `${v.path}:${v.line} — \`${v.token}\` not under #if WITH_EDITOR`),
  };
}

// ── UnrealBuildTool result parsing ──────────────────────────────────────────

export interface UbtParseResult {
  succeeded: boolean;
  errors: string[];
}

/**
 * Parse UnrealBuildTool stdout for the build result. UBT prints
 * `Result: Succeeded` / `Result: Failed (...)` and per-file `error:` lines.
 * "Target is up to date" also counts as a success (nothing to compile).
 */
export function parseUbtResult(output: string): UbtParseResult {
  const lines = output.split(/\r?\n/);
  const errors: string[] = [];
  let sawSucceeded = false;
  let sawFailed = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (/^Result:\s*Succeeded/i.test(line) || /Target is up to date/i.test(line)) {
      sawSucceeded = true;
    }
    if (/^Result:\s*Failed/i.test(line) || /\bBUILD FAILED\b/.test(line)) {
      sawFailed = true;
    }
    // Compiler / UBT error lines (avoid matching "0 error(s)" summaries).
    if (/\berror\b/i.test(line) && !/\b0 error/i.test(line)) {
      if (/error\s+[A-Z]?C?\d+|error:|\): error|RulesError|OtherCompilationError/i.test(line)) {
        errors.push(line);
      }
    }
  }

  const succeeded = sawSucceeded && !sawFailed && errors.length === 0;
  return { succeeded, errors };
}

/** Wrap a UBT parse into a pre-flight check result. */
export function buildVerifyCheckResult(
  id: string,
  label: string,
  parse: UbtParseResult,
): PreflightCheckResult {
  return {
    id,
    label,
    status: parse.succeeded ? 'pass' : 'fail',
    detail: parse.succeeded
      ? 'Target compiles cleanly.'
      : `Build failed${parse.errors.length ? ` — ${parse.errors.length} error line(s).` : '.'}`,
    issues: parse.errors.slice(0, 20),
  };
}

/** Overall pre-flight status: fail if any check fails; warn if any warns. */
export function overallStatus(results: PreflightCheckResult[]): PreflightStatus {
  if (results.some((r) => r.status === 'fail')) return 'fail';
  if (results.some((r) => r.status === 'warn')) return 'warn';
  return 'pass';
}
