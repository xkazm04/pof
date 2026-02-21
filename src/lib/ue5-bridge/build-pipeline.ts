/**
 * Headless UE5 Build Pipeline
 *
 * Executes UnrealBuildTool as a child process, captures output, parses
 * diagnostics, fingerprints errors into the error memory DB, and persists
 * build results to SQLite for history/trending.
 */

import { spawn } from 'child_process';
import { getEnginePath } from '@/lib/prompt-context';
import { parseBuildOutput } from '@/components/cli/UE5BuildParser';
import { fingerprintErrors } from '@/lib/error-fingerprint';
import { recordError } from '@/lib/error-memory-db';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { BuildRequest, BuildResult, BuildOptions, BuildStatus } from '@/types/ue5-bridge';
import type { SubModuleId } from '@/types/modules';

// ── DB Schema ────────────────────────────────────────────────────────────────

function ensureHeadlessBuildsTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS headless_builds (
      build_id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      target_name TEXT NOT NULL,
      ue_version TEXT NOT NULL,
      platform TEXT NOT NULL,
      configuration TEXT NOT NULL,
      target_type TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER,
      exit_code INTEGER,
      error_count INTEGER NOT NULL DEFAULT 0,
      warning_count INTEGER NOT NULL DEFAULT 0,
      output TEXT NOT NULL DEFAULT '',
      diagnostics_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_headless_builds_project
    ON headless_builds(project_path, created_at DESC)
  `);
}

// ── UBT Progress Pattern ─────────────────────────────────────────────────────

/** Matches UBT compile progress lines like "[3/42] Compile MyFile.cpp" */
const UBT_PROGRESS_RE = /\[(\d+)\/(\d+)\]/;

// ── Core Build Executor ──────────────────────────────────────────────────────

/**
 * Execute a headless UE5 build via UnrealBuildTool.
 *
 * Spawns UBT as a child process, streams output, detects progress from
 * `[N/M]` patterns, supports abort via AbortSignal, parses diagnostics,
 * fingerprints errors into error memory, and persists the result to DB.
 */
export async function executeBuild(
  request: BuildRequest,
  options?: BuildOptions,
): Promise<BuildResult> {
  const buildId = `build-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  const enginePath = getEnginePath(request.ueVersion);
  const ubtPath = `${enginePath}\\Engine\\Binaries\\DotNET\\UnrealBuildTool\\UnrealBuildTool.exe`;
  const target = `${request.targetName}${request.targetType}`;
  const projectArg = `-Project="${request.projectPath}\\${request.targetName}.uproject"`;

  const args = [
    target,
    request.platform,
    request.configuration,
    projectArg,
    '-WaitMutex',
    ...(request.additionalArgs ?? []),
  ];

  logger.info(`[build-pipeline] Starting build ${buildId}: ${ubtPath} ${args.join(' ')}`);

  return new Promise<BuildResult>((resolve) => {
    let output = '';
    let aborted = false;
    let timedOut = false;

    const proc = spawn(`"${ubtPath}"`, args, {
      shell: true,
      cwd: request.projectPath,
      env: { ...process.env },
    });

    // ── Timeout watchdog ──
    const timeout = setTimeout(() => {
      timedOut = true;
      logger.warn(`[build-pipeline] Build ${buildId} timed out after ${UI_TIMEOUTS.buildProcessTimeout}ms`);
      proc.kill('SIGTERM');
    }, UI_TIMEOUTS.buildProcessTimeout);

    // ── Abort signal handling ──
    const onAbort = () => {
      aborted = true;
      logger.info(`[build-pipeline] Build ${buildId} aborted by signal`);
      proc.kill('SIGTERM');
    };

    if (options?.abortSignal) {
      if (options.abortSignal.aborted) {
        // Already aborted before we started
        clearTimeout(timeout);
        aborted = true;
        proc.kill('SIGTERM');
      } else {
        options.abortSignal.addEventListener('abort', onAbort, { once: true });
      }
    }

    // ── Stream output ──
    const handleData = (data: Buffer) => {
      const text = data.toString();
      output += text;

      // Detect progress from [N/M] patterns
      const lines = text.split('\n');
      for (const line of lines) {
        const match = line.match(UBT_PROGRESS_RE);
        if (match) {
          const current = parseInt(match[1], 10);
          const total = parseInt(match[2], 10);
          const percent = total > 0 ? Math.round((current / total) * 100) : undefined;
          const message = line.trim();
          options?.onProgress?.(message, percent);
        }
      }
    };

    proc.stdout?.on('data', handleData);
    proc.stderr?.on('data', handleData);

    // ── Process exit ──
    proc.on('close', (exitCode) => {
      clearTimeout(timeout);
      options?.abortSignal?.removeEventListener('abort', onAbort);

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startMs;

      // Determine status
      let status: BuildStatus;
      if (aborted) {
        status = 'aborted';
      } else if (timedOut) {
        status = 'failed';
      } else if (exitCode === 0) {
        status = 'success';
      } else {
        status = 'failed';
      }

      // Parse build output for diagnostics
      const parsed = parseBuildOutput(output);
      const diagnostics = parsed.diagnostics;
      const errorCount = parsed.summary?.errorCount ?? diagnostics.filter((d) => d.severity === 'error').length;
      const warningCount = parsed.summary?.warningCount ?? diagnostics.filter((d) => d.severity === 'warning').length;

      // Fingerprint errors and record to error memory if moduleId provided
      if (options?.moduleId && errorCount > 0) {
        try {
          const errors = diagnostics
            .filter((d) => d.severity === 'error')
            .map((d) => ({ message: d.message, code: d.code, file: d.file }));

          const fingerprinted = fingerprintErrors(errors);
          for (const fp of fingerprinted) {
            recordError({
              moduleId: options.moduleId as SubModuleId,
              fingerprint: fp.fingerprint,
              category: fp.category,
              errorCode: fp.errorCode,
              pattern: fp.pattern,
              message: fp.message,
              file: fp.file,
              fixDescription: fp.fixDescription,
            });
          }
        } catch (err) {
          logger.warn('[build-pipeline] Failed to record errors to memory:', err);
        }
      }

      const result: BuildResult = {
        buildId,
        status,
        startedAt,
        completedAt,
        durationMs,
        exitCode: exitCode ?? null,
        errorCount,
        warningCount,
        diagnostics,
        output,
      };

      // Persist to DB
      try {
        saveBuildToDb(result, request);
      } catch (err) {
        logger.warn('[build-pipeline] Failed to save build to DB:', err);
      }

      logger.info(
        `[build-pipeline] Build ${buildId} finished: status=${status} errors=${errorCount} warnings=${warningCount} duration=${durationMs}ms`,
      );

      resolve(result);
    });

    // ── Process spawn error ──
    proc.on('error', (err) => {
      clearTimeout(timeout);
      options?.abortSignal?.removeEventListener('abort', onAbort);

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startMs;

      const result: BuildResult = {
        buildId,
        status: 'failed',
        startedAt,
        completedAt,
        durationMs,
        exitCode: null,
        errorCount: 1,
        warningCount: 0,
        diagnostics: [],
        output: `Failed to spawn UBT process: ${err.message}\n\nUBT path: ${ubtPath}\nArgs: ${args.join(' ')}\n\nEnsure UE ${request.ueVersion} is installed at: ${enginePath}`,
      };

      try {
        saveBuildToDb(result, request);
      } catch (dbErr) {
        logger.warn('[build-pipeline] Failed to save build error to DB:', dbErr);
      }

      resolve(result);
    });
  });
}

// ── DB Persistence ───────────────────────────────────────────────────────────

/**
 * Save a build result to the headless_builds table.
 */
export function saveBuildToDb(result: BuildResult, request: BuildRequest): void {
  ensureHeadlessBuildsTable();
  const db = getDb();

  db.prepare(`
    INSERT OR REPLACE INTO headless_builds
      (build_id, project_path, target_name, ue_version, platform,
       configuration, target_type, status, started_at, completed_at,
       duration_ms, exit_code, error_count, warning_count, output, diagnostics_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    result.buildId,
    request.projectPath,
    request.targetName,
    request.ueVersion,
    request.platform,
    request.configuration,
    request.targetType,
    result.status,
    result.startedAt,
    result.completedAt,
    result.durationMs,
    result.exitCode,
    result.errorCount,
    result.warningCount,
    result.output,
    JSON.stringify(result.diagnostics),
  );
}

// ── Build History Query ──────────────────────────────────────────────────────

interface HeadlessBuildRow {
  build_id: string;
  project_path: string;
  target_name: string;
  ue_version: string;
  platform: string;
  configuration: string;
  target_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  exit_code: number | null;
  error_count: number;
  warning_count: number;
  output: string;
  diagnostics_json: string;
}

/**
 * Retrieve past build results for a project, most recent first.
 */
export function getBuildHistory(projectPath: string, limit = 20): BuildResult[] {
  ensureHeadlessBuildsTable();
  const db = getDb();

  const rows = db.prepare(
    'SELECT * FROM headless_builds WHERE project_path = ? ORDER BY created_at DESC LIMIT ?',
  ).all(projectPath, limit) as HeadlessBuildRow[];

  return rows.map((row) => ({
    buildId: row.build_id,
    status: row.status as BuildStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? '',
    durationMs: row.duration_ms ?? 0,
    exitCode: row.exit_code,
    errorCount: row.error_count,
    warningCount: row.warning_count,
    diagnostics: safeParseDiagnostics(row.diagnostics_json),
    output: row.output,
  }));
}

function safeParseDiagnostics(json: string): BuildResult['diagnostics'] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}
