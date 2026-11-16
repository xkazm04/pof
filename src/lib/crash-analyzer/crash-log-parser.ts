/* ------------------------------------------------------------------ */
/*  UE5 Crash Analyzer — Crash Log Parser                              */
/* ------------------------------------------------------------------ */

import { CRASH_HISTORY_LIMITS, type CallstackFrame, type CrashReport, type CrashSeverity, type CrashType, type MachineState } from '@/types/crash-analyzer';
import { CRASH_TAXONOMY, taxonomyRow } from './crash-taxonomy';

/** Highest faulting address still treated as a null-pointer dereference. */
const NULL_PAGE_LIMIT = BigInt(0x10000);

/** Faulting address of an access violation, or null when the message has none. */
function faultingAddress(message: string): bigint | null {
  const m = message.match(/address\s+(0x[0-9a-fA-F]+)/);
  if (!m) return null;
  try {
    return BigInt(m[1]);
  } catch {
    return null;
  }
}

/** Classify an error message: first taxonomy row (in priority order) with a matching marker. */
export function classifyCrash(errorMessage: string): CrashType {
  for (const row of CRASH_TAXONOMY) {
    const markers: readonly string[] = row.markers;
    if (markers.some((marker) => errorMessage.includes(marker))) {
      if (row.id === 'access_violation') {
        const addr = faultingAddress(errorMessage);
        if (addr !== null && addr < NULL_PAGE_LIMIT) return 'nullptr_deref';
      }
      return row.id;
    }
  }
  return 'unknown';
}

/** Read the machine description from the log header; absent fields keep their defaults. */
function readMachineState(rawText: string): MachineState {
  const field = (re: RegExp): string | null => {
    const v = rawText.match(re)?.[1]?.trim();
    return v ? v : null;
  };
  const ram = field(/\bMemory:[ \t]*(\d+)/);
  return {
    platform: 'Windows',
    cpuBrand: field(/CPU Brand:[ \t]*([^\r\n]+)/) ?? 'Unknown',
    gpuBrand: field(/GPU Brand:[ \t]*([^\r\n]+)/) ?? 'Unknown',
    ramMB: ram ? parseInt(ram, 10) : 0,
    osVersion: field(/\bOS:[ \t]*([^\r\n]+)/) ?? 'Unknown',
    engineVersion: '5.5',
    buildConfig: 'Development',
    isEditor: true,
  };
}

/** FNV-1a over the text, base36: a stable content id so identical logs get identical ids. */
function contentHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Header kept from the top of an oversize log: CPU/GPU/OS/memory lines live there. */
const PARSE_HEAD_CHARS = 16_000;
/** Text kept from the first error line on: the message, timestamp and callstack follow it. */
const PARSE_CRASH_CHARS = CRASH_HISTORY_LIMITS.rawLogChars * 3;

/** Offset of the first line holding `Error:` that is not the `[Callstack]` marker, or -1. */
function firstErrorLineStart(text: string): number {
  let from = 0;
  for (;;) {
    const at = text.indexOf('Error:', from);
    if (at < 0) return -1;
    const start = text.lastIndexOf('\n', at) + 1;
    const end = text.indexOf('\n', at);
    const line = text.slice(start, end < 0 ? text.length : end);
    if (!line.includes('[Callstack]')) return start;
    from = end < 0 ? text.length : end + 1;
  }
}

/**
 * Bound what the parser has to read. A pasted Saved/Logs file can be tens of MB;
 * the crash is the first error line and the callstack after it, the machine
 * description is in the header. Everything between is dropped, and the log says so.
 * A log already within the window is returned untouched.
 */
function boundParseWindow(rawText: string): string {
  if (rawText.length <= PARSE_HEAD_CHARS + PARSE_CRASH_CHARS) return rawText;
  const errStart = firstErrorLineStart(rawText);
  if (errStart < 0) return rawText.slice(0, PARSE_HEAD_CHARS);
  if (errStart <= PARSE_HEAD_CHARS) return rawText.slice(0, errStart + PARSE_CRASH_CHARS);
  const omitted = errStart - PARSE_HEAD_CHARS;
  const crash = rawText.slice(errStart, errStart + PARSE_CRASH_CHARS);
  return `${rawText.slice(0, PARSE_HEAD_CHARS)}\n[... ${omitted} chars omitted by the importer ...]\n${crash}`;
}

/** Parse raw crash log text into a CrashReport */
export function parseCrashLog(fullText: string): CrashReport | null {
  const rawText = boundParseWindow(fullText);
  const lines = rawText.split('\n');
  const errorLine = lines.find((l) => l.includes('Error:') && !l.includes('[Callstack]'));
  if (!errorLine) return null;

  const errorMatch = errorLine.match(/Error:\s*(.+)/);
  const errorMessage = errorMatch?.[1]?.trim() ?? 'Unknown error';

  const crashType = classifyCrash(errorMessage);
  const severity: CrashSeverity = taxonomyRow(crashType).severity;

  // Extract timestamp
  const tsMatch = rawText.match(/\[(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2})/);
  const timestamp = tsMatch
    ? tsMatch[1].replace(/\./g, (m, offset: number) => (offset <= 9 ? '-' : ':')).replace(/-(\d{2}):/, 'T$1:') + 'Z'
    : new Date().toISOString();

  // Parse callstack frames
  const callstackStart = lines.findIndex((l) => l.includes('[Callstack]'));
  const frames: CallstackFrame[] = [];
  if (callstackStart >= 0) {
    let idx = 0;
    for (let i = callstackStart + 1; i < lines.length; i++) {
      const frameMatch = lines[i].match(
        /Error:\s*(?:(0x[0-9a-fA-F]+)\s+)?(\S+)!(\S+)\(\)\s*(?:\[(\S+?)(?::(\d+))?\])?/,
      );
      if (frameMatch) {
        const moduleName = frameMatch[2];
        frames.push({
          index: idx,
          address: frameMatch[1] ?? '',
          moduleName,
          functionName: frameMatch[3],
          sourceFile: frameMatch[4] ?? null,
          lineNumber: frameMatch[5] ? parseInt(frameMatch[5]) : null,
          isGameCode: moduleName.includes('MyGame') || !moduleName.includes('UnrealEditor-'),
          isCrashOrigin: false,
        });
        idx++;
      }
    }
  }

  return {
    id: `crash-${contentHash(rawText)}`,
    timestamp,
    crashType,
    severity,
    errorMessage,
    callstack: frames,
    culpritFrame: null,
    machineState: readMachineState(rawText),
    crashDir: 'Imported',
    mappedModule: null,
    rawLog: rawText,
    analyzed: false,
    // Observed, not shipped — this is a crash from the operator's own project.
    source: 'imported',
  };
}
