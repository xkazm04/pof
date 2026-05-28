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

// ── Asset / content validation audit ────────────────────────────────────────

export type AssetValidationCategory =
  | 'missing-reference'
  | 'redirector'
  | 'texture'
  | 'map-not-in-cook'
  | 'other';

export interface AssetValidationViolation {
  severity: 'error' | 'warning';
  category: AssetValidationCategory;
  /** The validator's message, with the log prefix/verbosity stripped. */
  message: string;
}

/**
 * UE log categories that the DataValidation / asset-audit commandlets emit
 * under. Scoping the parser to these avoids treating unrelated engine errors
 * (a `LogTemp: Error` from gameplay code, say) as content defects.
 */
const VALIDATION_LOG_CATEGORIES = new Set([
  'LogContentValidation',
  'LogDataValidation',
  'LogEditorValidator',
  'LogContentValidator',
  'LogAssetValidation',
  'LogContentCommandlet', // ResavePackages / -fixupredirectors
  'LogSavePackage',
]);

const VERBOSITY_RE = /^(Error|Warning|Display|Verbose|VeryVerbose|Fatal):\s*/;
// Strips any number of leading `[...]` log prefixes (timestamp, frame counter).
const LOG_LINE_RE = /^(?:\[[^\]]*\])*\s*([A-Za-z_]\w*):\s*(.*)$/;
const REDIRECTOR_COUNT_RE = /\b(\d+)\s+redirectors?\b/i;

const CATEGORY_LABELS: Record<AssetValidationCategory, string> = {
  'missing-reference': 'Missing reference',
  redirector: 'Redirector',
  texture: 'Texture',
  'map-not-in-cook': 'Map not in cook set',
  other: 'Content',
};

/** Classify a validator message into the content-defect class it describes. */
function categorizeAssetIssue(message: string): AssetValidationCategory {
  const m = message.toLowerCase();
  if (/redirector/.test(m)) return 'redirector';
  if (/\b(map|level)\b/.test(m) && /(not in|missing from|outside)\b.{0,20}(cook|build|package)/.test(m)) {
    return 'map-not-in-cook';
  }
  if (
    /(missing|unresolved|dangling|null|failed to load|can't find|cannot find|could not find|broken)\b.{0,30}(reference|asset|object|dependenc)/.test(m)
    || /missing reference/.test(m)
  ) {
    return 'missing-reference';
  }
  if (/texture/.test(m)) return 'texture';
  return 'other';
}

/**
 * Parse the editor commandlet's log output for content defects: missing/broken
 * asset references, leftover ObjectRedirectors, oversized/uncompressed textures,
 * and references to maps outside the cook set.
 *
 * Errors fail the cook; warnings (e.g. fixed-up redirectors, fat textures) only
 * warn. The parser keys off UE's `Category: Verbosity: message` log shape and is
 * scoped to the validation/audit categories so unrelated engine errors are
 * ignored. Judged by output content, never by exit code — headless
 * `UnrealEditor-Cmd` exits non-zero on a benign shutdown null-deref.
 */
export function parseAssetValidation(output: string): AssetValidationViolation[] {
  const violations: AssetValidationViolation[] = [];
  const seen = new Set<string>();

  const push = (severity: 'error' | 'warning', category: AssetValidationCategory, message: string) => {
    const key = `${severity}|${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ severity, category, message });
  };

  for (const raw of output.split(/\r?\n/)) {
    const m = LOG_LINE_RE.exec(raw.trim());
    if (!m) continue;
    const category = m[1];
    if (!VALIDATION_LOG_CATEGORIES.has(category)) continue;

    let rest = m[2];
    let verbosity: string | null = null;
    const vm = VERBOSITY_RE.exec(rest);
    if (vm) {
      verbosity = vm[1];
      rest = rest.slice(vm[0].length);
    }
    const message = rest.trim();
    if (!message) continue;

    if (verbosity === 'Error' || verbosity === 'Fatal') {
      push('error', categorizeAssetIssue(message), message);
    } else if (verbosity === 'Warning') {
      push('warning', categorizeAssetIssue(message), message);
    } else {
      // Display / informational: only a non-zero redirector-fixup summary is a
      // signal (leftover redirectors bloat the cook and should be resaved out).
      const rm = REDIRECTOR_COUNT_RE.exec(message);
      if (rm && Number(rm[1]) > 0) push('warning', 'redirector', message);
    }
  }

  return violations;
}

/** Wrap asset-validation violations into a pre-flight check result. */
export function assetValidationCheckResult(violations: AssetValidationViolation[]): PreflightCheckResult {
  const errors = violations.filter((v) => v.severity === 'error').length;
  const warnings = violations.length - errors;
  const status: PreflightStatus = errors > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass';
  return {
    id: 'asset-validation',
    label: 'Asset validation',
    status,
    detail:
      status === 'pass'
        ? 'No content defects — references, redirectors, textures, and maps are cook-clean.'
        : `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'} in content validation.`,
    issues: violations
      .slice(0, 30)
      .map((v) => `[${v.severity}] ${CATEGORY_LABELS[v.category]}: ${v.message}`),
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
