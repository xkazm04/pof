/**
 * CLI-based Claude Terminal Service
 * Copied from vibeman - spawns Claude Code CLI process and parses stream-json output.
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface CLISystemMessage {
  type: 'system';
  subtype: 'init';
  session_id: string;
  tools: string[];
  model?: string;
  cwd?: string;
  claude_code_version?: string;
}

export interface CLIAssistantMessage {
  type: 'assistant';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    content: Array<{
      type: 'text' | 'tool_use';
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
    model: string;
    stop_reason: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

export interface CLIUserMessage {
  type: 'user';
  message: {
    role: 'user';
    content: Array<{
      type: 'tool_result';
      tool_use_id: string;
      content: string;
    }>;
  };
}

export interface CLIResultMessage {
  type: 'result';
  subtype?: string;
  result?: {
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
    session_id?: string;
  };
  duration_ms?: number;
  cost_usd?: number;
  is_error?: boolean;
}

export type CLIMessage = CLISystemMessage | CLIAssistantMessage | CLIUserMessage | CLIResultMessage;

export interface CLIExecutionEvent {
  type: 'init' | 'text' | 'tool_use' | 'tool_result' | 'result' | 'error' | 'stdout';
  data: Record<string, unknown>;
  timestamp: number;
}

export interface CLIExecution {
  id: string;
  projectPath: string;
  prompt: string;
  process: ChildProcess | null;
  sessionId?: string;
  status: 'running' | 'completed' | 'error' | 'aborted';
  startTime: number;
  endTime?: number;
  events: CLIExecutionEvent[];
  logFilePath?: string;
}

const globalForExecutions = globalThis as unknown as {
  cliActiveExecutions: Map<string, CLIExecution> | undefined;
};

const activeExecutions = globalForExecutions.cliActiveExecutions ?? new Map<string, CLIExecution>();

if (!globalForExecutions.cliActiveExecutions) {
  globalForExecutions.cliActiveExecutions = activeExecutions;
}

function getLogsDirectory(projectPath: string): string {
  return path.join(projectPath, '.claude', 'logs');
}

function ensureLogsDirectory(projectPath: string): void {
  const logsDir = getLogsDirectory(projectPath);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

function getLogFilePath(projectPath: string, executionId: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitized = executionId.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50);
  return path.join(getLogsDirectory(projectPath), `terminal_${sanitized}_${timestamp}.log`);
}

export function parseStreamJsonLine(line: string): CLIMessage | null {
  try {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('[')) return null;
    return JSON.parse(trimmed) as CLIMessage;
  } catch {
    return null;
  }
}

export function extractTextContent(msg: CLIAssistantMessage): string {
  return msg.message.content.filter(c => c.type === 'text').map(c => c.text || '').join('\n');
}

export function extractToolUses(msg: CLIAssistantMessage): Array<{ id: string; name: string; input: Record<string, unknown> }> {
  return msg.message.content.filter(c => c.type === 'tool_use').map(c => ({ id: c.id || '', name: c.name || '', input: c.input || {} }));
}

export function startExecution(
  projectPath: string,
  prompt: string,
  resumeSessionId?: string,
  onEvent?: (event: CLIExecutionEvent) => void
): string {
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Ensure project directory exists (for fresh projects the dir may not exist yet)
  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  ensureLogsDirectory(projectPath);
  const logFilePath = getLogFilePath(projectPath, executionId);

  const execution: CLIExecution = {
    id: executionId,
    projectPath,
    prompt,
    process: null,
    status: 'running',
    startTime: Date.now(),
    events: [],
    logFilePath,
  };

  activeExecutions.set(executionId, execution);

  const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
  let streamClosed = false;

  const logMessage = (msg: string) => {
    const timestamp = new Date().toISOString();
    if (!streamClosed) {
      try { logStream.write(`[${timestamp}] ${msg}\n`); } catch { /* ignore */ }
    }
  };

  const closeLogStream = () => {
    if (!streamClosed) { streamClosed = true; logStream.end(); }
  };

  const emitEvent = (event: CLIExecutionEvent) => {
    execution.events.push(event);
    if (onEvent) onEvent(event);
  };

  logMessage('=== Claude Terminal Execution Started ===');
  logMessage(`Execution ID: ${executionId}`);
  logMessage(`Project Path: ${projectPath}`);

  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'claude.cmd' : 'claude';
  const args = ['-p', '-', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'];

  if (resumeSessionId) args.push('--resume', resumeSessionId);

  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;

  try {
    const childProcess = spawn(command, args, {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
      env,
    });

    execution.process = childProcess;
    childProcess.stdin.write(prompt);
    childProcess.stdin.end();

    let lineBuffer = '';
    let resultEventEmitted = false;
    let initEventReceived = false;
    let assistantMessageCount = 0;

    const processLine = (line: string) => {
      const parsed = parseStreamJsonLine(line);
      if (!parsed) return;

      if (parsed.type === 'system' && parsed.subtype === 'init') {
        initEventReceived = true;
        execution.sessionId = parsed.session_id;
        emitEvent({ type: 'init', data: { sessionId: parsed.session_id, tools: parsed.tools, model: parsed.model, cwd: parsed.cwd, version: parsed.claude_code_version }, timestamp: Date.now() });
      } else if (parsed.type === 'assistant') {
        assistantMessageCount++;
        const textContent = extractTextContent(parsed);
        if (textContent) {
          emitEvent({ type: 'text', data: { content: textContent, model: parsed.message.model }, timestamp: Date.now() });
        }
        for (const toolUse of extractToolUses(parsed)) {
          emitEvent({ type: 'tool_use', data: { id: toolUse.id, name: toolUse.name, input: toolUse.input }, timestamp: Date.now() });
        }
      } else if (parsed.type === 'user') {
        for (const result of parsed.message.content.filter(c => c.type === 'tool_result')) {
          emitEvent({ type: 'tool_result', data: { toolUseId: result.tool_use_id, content: result.content }, timestamp: Date.now() });
        }
      } else if (parsed.type === 'result') {
        resultEventEmitted = true;
        execution.sessionId = parsed.result?.session_id || execution.sessionId;
        emitEvent({ type: 'result', data: { sessionId: parsed.result?.session_id, usage: parsed.result?.usage, durationMs: parsed.duration_ms, costUsd: parsed.cost_usd, isError: parsed.is_error }, timestamp: Date.now() });
      }
    };

    childProcess.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      logMessage(`[STDOUT] ${text.trim()}`);
      emitEvent({ type: 'stdout', data: { raw: text }, timestamp: Date.now() });
      lineBuffer += text;
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';
      for (const line of lines) processLine(line);
    });

    childProcess.stderr.on('data', (data: Buffer) => {
      logMessage(`[STDERR] ${data.toString().trim()}`);
    });

    childProcess.on('close', (code: number) => {
      if (lineBuffer.trim()) { processLine(lineBuffer); lineBuffer = ''; }
      const durationMs = Date.now() - execution.startTime;
      logMessage(`Process exited with code: ${code}, duration: ${durationMs}ms`);
      closeLogStream();
      execution.endTime = Date.now();
      execution.status = code === 0 ? 'completed' : 'error';

      if (code !== 0) {
        emitEvent({ type: 'error', data: { exitCode: code, message: `Process exited with code ${code}` }, timestamp: Date.now() });
      } else if (!resultEventEmitted) {
        const shouldEmitSynthetic = initEventReceived && assistantMessageCount > 0 && durationMs > 5000;
        if (shouldEmitSynthetic) {
          emitEvent({ type: 'result', data: { sessionId: execution.sessionId, isError: false, synthetic: true }, timestamp: Date.now() });
        }
      }
    });

    childProcess.on('error', (err: Error) => {
      logMessage(`[ERROR] ${err.message}`);
      closeLogStream();
      execution.endTime = Date.now();
      execution.status = 'error';
      emitEvent({ type: 'error', data: { message: err.message }, timestamp: Date.now() });
    });

    const timeoutHandle = setTimeout(() => {
      if (!childProcess.killed) {
        childProcess.kill();
        execution.status = 'error';
        emitEvent({ type: 'error', data: { message: 'Execution timed out after 100 minutes' }, timestamp: Date.now() });
      }
    }, 6000000);

    childProcess.on('close', () => clearTimeout(timeoutHandle));
  } catch (error) {
    closeLogStream();
    execution.status = 'error';
    execution.endTime = Date.now();
    emitEvent({ type: 'error', data: { message: error instanceof Error ? error.message : 'Unknown error' }, timestamp: Date.now() });
  }

  return executionId;
}

export function getExecution(executionId: string): CLIExecution | undefined {
  return activeExecutions.get(executionId);
}

export function abortExecution(executionId: string): boolean {
  const execution = activeExecutions.get(executionId);
  if (!execution || !execution.process) return false;
  execution.process.kill();
  execution.status = 'aborted';
  execution.endTime = Date.now();
  return true;
}

export function getActiveExecutions(): CLIExecution[] {
  return Array.from(activeExecutions.values()).filter(e => e.status === 'running');
}

export function cleanupExecutions(maxAgeMs: number = 3600000): void {
  const now = Date.now();
  for (const [id, execution] of activeExecutions) {
    if (execution.status !== 'running' && execution.endTime && now - execution.endTime > maxAgeMs) {
      activeExecutions.delete(id);
    }
  }
}
