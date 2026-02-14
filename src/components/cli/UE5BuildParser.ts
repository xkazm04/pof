/**
 * UE5 Build Output Parser
 *
 * Parses UBT/MSBuild/Clang output from tool_result log entries to extract
 * structured compilation errors, warnings, linker issues, and build summaries.
 *
 * Supported formats:
 * - MSVC:  file(line): error CXXXX: message
 * - MSVC:  file(line): warning CXXXX: message
 * - Clang: file:line:col: error: message
 * - Clang: file:line:col: warning: message
 * - Linker: file.obj : error LNK2019: unresolved external symbol ...
 * - UBT:   ERROR: ... / WARNING: ...
 * - Build summary: Build [SUCCEEDED|FAILED]
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type BuildDiagnosticSeverity = 'error' | 'warning';

export interface BuildDiagnostic {
  id: string;
  severity: BuildDiagnosticSeverity;
  file: string | null;
  line: number | null;
  column: number | null;
  code: string | null;
  message: string;
  rawText: string;
  category: 'compile' | 'linker' | 'ubt' | 'general';
}

export interface BuildSummary {
  success: boolean;
  errorCount: number;
  warningCount: number;
  /** Duration string if found (e.g., "1m 23s") */
  duration: string | null;
  /** Raw summary line */
  rawText: string;
}

export interface BuildParseResult {
  diagnostics: BuildDiagnostic[];
  summary: BuildSummary | null;
  /** True if the text contains build output at all */
  isBuildOutput: boolean;
}

// ─── Regex patterns ──────────────────────────────────────────────────────────

// MSVC compilation error/warning: file(line[,col]): error CXXXX: message
const MSVC_DIAG = /^(.+?)\((\d+)(?:,(\d+))?\)\s*:\s*(error|warning)\s+(C\d+|D\d+)?\s*:\s*(.+)$/;

// Clang compilation error/warning: file:line:col: error|warning: message
const CLANG_DIAG = /^(.+?):(\d+):(\d+):\s*(error|warning):\s*(.+)$/;

// MSVC linker error: file.obj : error LNK2019: message
const LINKER_DIAG = /^(.+?\.(?:obj|lib))\s*:\s*(error|warning)\s+(LNK\d+)\s*:\s*(.+)$/;

// UBT errors/warnings: ERROR: message / WARNING: message
const UBT_DIAG = /^\s*(ERROR|WARNING)\s*:\s*(.+)$/;

// Build summary: "Build SUCCEEDED" / "Build FAILED"
const BUILD_RESULT = /Build\s+(SUCCEEDED|FAILED)/i;

// Error/warning count: "X error(s), Y warning(s)"
const ERROR_COUNT = /(\d+)\s+error\(?s?\)?/i;
const WARNING_COUNT = /(\d+)\s+warning\(?s?\)?/i;

// UBT duration: "Total time was XX.XXs"
const UBT_DURATION = /Total\s+(?:build\s+)?time\s+(?:was\s+)?(\d+(?:\.\d+)?)\s*s/i;

// Build output detection — look for patterns that indicate this is build output
const BUILD_INDICATORS = [
  /UnrealBuildTool/i,
  /Building\s+\d+\s+actions/i,
  /Compiling\s+/i,
  /Linking\s+/i,
  /Build\s+(SUCCEEDED|FAILED)/i,
  /\berror\s+C\d{4}\b/,
  /\berror\s+LNK\d{4}\b/,
  /\bwarning\s+C\d{4}\b/,
  /\.cpp\(\d+\)/,
  /\.h\(\d+\)/,
];

// ─── Parser ──────────────────────────────────────────────────────────────────

let diagnosticCounter = 0;

function nextDiagId(): string {
  return `diag-${Date.now()}-${diagnosticCounter++}`;
}

/**
 * Parse a block of text (typically from a tool_result) for UE5 build diagnostics.
 */
export function parseBuildOutput(text: string): BuildParseResult {
  const diagnostics: BuildDiagnostic[] = [];
  let summary: BuildSummary | null = null;

  // Quick check: does this look like build output at all?
  const isBuildOutput = BUILD_INDICATORS.some((re) => re.test(text));
  if (!isBuildOutput) {
    return { diagnostics: [], summary: null, isBuildOutput: false };
  }

  const lines = text.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Try MSVC compilation pattern
    let match = line.match(MSVC_DIAG);
    if (match) {
      diagnostics.push({
        id: nextDiagId(),
        severity: match[4] as BuildDiagnosticSeverity,
        file: normalizePath(match[1]),
        line: parseInt(match[2], 10),
        column: match[3] ? parseInt(match[3], 10) : null,
        code: match[5] || null,
        message: match[6].trim(),
        rawText: line,
        category: 'compile',
      });
      continue;
    }

    // Try Clang pattern
    match = line.match(CLANG_DIAG);
    if (match) {
      diagnostics.push({
        id: nextDiagId(),
        severity: match[4] as BuildDiagnosticSeverity,
        file: normalizePath(match[1]),
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        code: null,
        message: match[5].trim(),
        rawText: line,
        category: 'compile',
      });
      continue;
    }

    // Try linker pattern
    match = line.match(LINKER_DIAG);
    if (match) {
      diagnostics.push({
        id: nextDiagId(),
        severity: match[2] as BuildDiagnosticSeverity,
        file: normalizePath(match[1]),
        line: null,
        column: null,
        code: match[3],
        message: match[4].trim(),
        rawText: line,
        category: 'linker',
      });
      continue;
    }

    // Try UBT error/warning
    match = line.match(UBT_DIAG);
    if (match) {
      // Skip UBA error code 9666 — it's normal and retries succeed
      if (line.includes('9666') || line.includes('UBA')) continue;

      diagnostics.push({
        id: nextDiagId(),
        severity: match[1].toLowerCase() === 'error' ? 'error' : 'warning',
        file: null,
        line: null,
        column: null,
        code: null,
        message: match[2].trim(),
        rawText: line,
        category: 'ubt',
      });
      continue;
    }

    // Check for build summary
    match = line.match(BUILD_RESULT);
    if (match) {
      const success = match[1].toUpperCase() === 'SUCCEEDED';
      let errorCount = 0;
      let warningCount = 0;
      let duration: string | null = null;

      // Scan nearby lines for counts and duration
      const fullText = text;
      const errMatch = fullText.match(ERROR_COUNT);
      const warnMatch = fullText.match(WARNING_COUNT);
      const durMatch = fullText.match(UBT_DURATION);

      if (errMatch) errorCount = parseInt(errMatch[1], 10);
      if (warnMatch) warningCount = parseInt(warnMatch[1], 10);
      if (durMatch) {
        const seconds = parseFloat(durMatch[1]);
        duration = seconds >= 60
          ? `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
          : `${Math.round(seconds)}s`;
      }

      // Use parsed diagnostics count if regex didn't find counts
      if (errorCount === 0) errorCount = diagnostics.filter((d) => d.severity === 'error').length;
      if (warningCount === 0) warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

      summary = {
        success,
        errorCount,
        warningCount,
        duration,
        rawText: line,
      };
    }
  }

  return { diagnostics, summary, isBuildOutput };
}

// ─── Warning aggregation ─────────────────────────────────────────────────────

export interface WarningGroup {
  code: string | null;
  messagePattern: string;
  warnings: BuildDiagnostic[];
  count: number;
}

/**
 * Group similar warnings together by error code or message prefix.
 */
export function aggregateWarnings(diagnostics: BuildDiagnostic[]): WarningGroup[] {
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  const groups = new Map<string, BuildDiagnostic[]>();

  for (const w of warnings) {
    // Group by code if available, otherwise by first 60 chars of message
    const key = w.code ?? w.message.slice(0, 60);
    const arr = groups.get(key) ?? [];
    arr.push(w);
    groups.set(key, arr);
  }

  return Array.from(groups.entries()).map(([key, items]) => ({
    code: items[0].code,
    messagePattern: key,
    warnings: items,
    count: items.length,
  }));
}

// ─── Fix prompt builder ──────────────────────────────────────────────────────

/**
 * Build a targeted fix prompt from a compilation error.
 */
export function buildFixPromptFromError(diagnostic: BuildDiagnostic): string {
  const fileRef = diagnostic.file
    ? `in file ${diagnostic.file}${diagnostic.line ? ` at line ${diagnostic.line}` : ''}`
    : '';

  const codeRef = diagnostic.code ? ` (${diagnostic.code})` : '';

  let prompt = `Fix this compilation ${diagnostic.severity}${codeRef} ${fileRef}:

${diagnostic.message}`;

  if (diagnostic.file) {
    prompt += `

Start by reading ${diagnostic.file} to understand the context around ${diagnostic.line ? `line ${diagnostic.line}` : 'the issue'}.`;
  }

  if (diagnostic.category === 'linker') {
    prompt += `

This is a linker error. Check for:
- Missing #include directives
- Missing module dependencies in Build.cs
- Unimplemented declared functions
- Incorrect UCLASS/UFUNCTION signatures`;
  }

  prompt += `

After fixing, verify the build compiles successfully.`;

  return prompt;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize file paths for display — extract relative path from Source/.
 */
function normalizePath(filePath: string): string {
  const trimmed = filePath.trim();
  // Extract from Source/ if present
  const sourceIdx = trimmed.indexOf('Source\\');
  const sourceSlashIdx = trimmed.indexOf('Source/');
  const idx = Math.max(sourceIdx, sourceSlashIdx);
  if (idx >= 0) return trimmed.slice(idx);
  // Extract just filename if it's an absolute path
  const lastSlash = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
  if (lastSlash >= 0 && trimmed.length - lastSlash < 80) return trimmed.slice(lastSlash + 1);
  return trimmed;
}

/**
 * Check if a log entry's content contains build output.
 * Used to decide whether to show build cards inline.
 */
export function containsBuildOutput(content: string): boolean {
  return BUILD_INDICATORS.some((re) => re.test(content));
}
