/**
 * Signal Analyzer — Classifies raw CLI execution events into typed Signals.
 *
 * Adapted for POF (UE5 game dev tool). Detects:
 * - Tool errors (Read/Edit/Write failures)
 * - Build errors (MSVC, Clang, UBT, linker)
 * - N+1 patterns (same tool called repeatedly)
 * - Retry storms (same tool + same input)
 * - Performance issues (slow executions)
 */

import type { CLIExecutionEvent } from '../cli-service';
import type { Signal, SignalType } from './signal-types';
import { SIGNAL_CATEGORY_MAP, SIGNAL_SEVERITY_MAP } from './signal-types';

// ============ Fingerprinting ============

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function normalizeError(msg: string): string {
  return msg
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*/g, '<TIMESTAMP>')
    .replace(/[A-Z]:\\[^\s]+/gi, '<PATH>') // Normalize Windows paths
    .replace(/\/[^\s]+\.(cpp|h|cs|uproject)/gi, '<PATH>') // Normalize Unix paths
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function makeFingerprint(type: SignalType, toolName: string, errorPattern: string): string {
  return simpleHash(`${type}:${toolName}:${normalizeError(errorPattern)}`);
}

function makeSignalId(): string {
  return `sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============ Error Pattern Matchers ============

// UE5 Build errors
const MSVC_ERROR_RE = /error\s+C\d{4}/i;
const CLANG_ERROR_RE = /:\d+:\d+:\s+error:/;
const LINKER_ERROR_RE = /error\s+LNK\d{4}/i;
const UBT_ERROR_RE = /^ERROR:\s/m;
const BUILD_FAILED_RE = /Build\s+FAILED/i;

// File system errors
const FILE_NOT_FOUND_RE = /(?:ENOENT|no such file|file not found|cannot find)/i;
const PERMISSION_ERROR_RE = /(?:EACCES|permission denied|access denied)/i;

// Generic tool errors
const TOOL_NOT_FOUND_RE = /tool\s+["']?(\w+)["']?\s+(?:not found|does not exist|is not available)/i;

// ============ Main Analyzer ============

/**
 * Analyze a CLI execution event and return a Signal if it indicates a problem.
 */
export function analyzeEvent(
  event: CLIExecutionEvent,
  recentEvents: CLIExecutionEvent[],
  executionId: string,
): Signal | null {
  // ---- Tool Result Errors ----
  if (event.type === 'tool_result') {
    const content = String(event.data.content || '');
    const toolName = findToolNameForResult(event, recentEvents);

    // UE5 Build errors (high severity)
    if (MSVC_ERROR_RE.test(content) || CLANG_ERROR_RE.test(content) ||
        LINKER_ERROR_RE.test(content) || UBT_ERROR_RE.test(content) ||
        BUILD_FAILED_RE.test(content)) {
      return buildSignal('build_error', toolName, content, executionId);
    }

    // File system errors
    if (FILE_NOT_FOUND_RE.test(content)) {
      return buildSignal('tool_error', toolName, content, executionId);
    }

    if (PERMISSION_ERROR_RE.test(content)) {
      return buildSignal('tool_error', toolName, content, executionId);
    }

    // Generic error detection
    const isError = content.toLowerCase().includes('error') ||
                    content.toLowerCase().includes('failed');
    if (isError && content.length < 2000) {
      return buildSignal('tool_error', toolName, content, executionId);
    }
  }

  // ---- Tool Use patterns (N+1, retry storms) ----
  if (event.type === 'tool_use') {
    const toolName = String(event.data.name || '');

    // N+1 detection: same tool called 3+ times in recent window
    const recentSameTool = recentEvents.filter(
      e => e.type === 'tool_use' && String(e.data.name) === toolName
    );
    if (recentSameTool.length >= 3) {
      return buildSignal('n_plus_one', toolName,
        `Tool ${toolName} called ${recentSameTool.length + 1} times in sequence`,
        executionId);
    }

    // Retry storm: same tool + same input called 3+ times
    const inputStr = JSON.stringify(event.data.input || {});
    const recentRetries = recentEvents.filter(
      e => e.type === 'tool_use' &&
           String(e.data.name) === toolName &&
           JSON.stringify(e.data.input || {}) === inputStr
    );
    if (recentRetries.length >= 2) {
      return buildSignal('retry_storm', toolName,
        `Tool ${toolName} retried ${recentRetries.length + 1} times with same input`,
        executionId);
    }
  }

  // ---- Performance (on result events) ----
  if (event.type === 'result') {
    const durationMs = event.data.durationMs as number | undefined;
    if (durationMs && durationMs > 60000) {
      return buildSignal('performance', '',
        `Execution took ${Math.round(durationMs / 1000)}s`,
        executionId);
    }
  }

  // ---- Text content analysis (prompt hallucinations) ----
  if (event.type === 'text') {
    const content = String(event.data.content || '');

    const toolMissing = content.match(TOOL_NOT_FOUND_RE);
    if (toolMissing) {
      return buildSignal('tool_missing', toolMissing[1],
        `Referenced non-existent tool: ${toolMissing[1]}`,
        executionId);
    }
  }

  return null;
}

// ============ Helpers ============

function buildSignal(
  type: SignalType,
  toolName: string,
  errorMessage: string,
  executionId: string,
  errorCode?: string,
): Signal {
  return {
    id: makeSignalId(),
    type,
    severity: SIGNAL_SEVERITY_MAP[type],
    category: SIGNAL_CATEGORY_MAP[type],
    fingerprint: makeFingerprint(type, toolName, errorMessage),
    toolName: toolName || undefined,
    errorMessage: errorMessage.slice(0, 500),
    errorCode,
    executionId,
    timestamp: Date.now(),
    resolved: false,
  };
}

function findToolNameForResult(
  resultEvent: CLIExecutionEvent,
  recentEvents: CLIExecutionEvent[],
): string {
  const toolUseId = resultEvent.data.toolUseId as string | undefined;
  if (!toolUseId) {
    for (let i = recentEvents.length - 1; i >= 0; i--) {
      if (recentEvents[i].type === 'tool_use') {
        return String(recentEvents[i].data.name || '');
      }
    }
    return '';
  }

  for (let i = recentEvents.length - 1; i >= 0; i--) {
    if (recentEvents[i].type === 'tool_use' && recentEvents[i].data.id === toolUseId) {
      return String(recentEvents[i].data.name || '');
    }
  }
  return '';
}
