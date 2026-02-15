/* ------------------------------------------------------------------ */
/*  UE5 Crash Analyzer — Analysis Engine                              */
/* ------------------------------------------------------------------ */

import type {
  CrashReport,
  CrashDiagnosis,
  CrashPattern,
  CrashStats,
  CrashAnalyzerResult,
  CrashType,
  CrashSeverity,
} from '@/types/crash-analyzer';
import { SAMPLE_CRASHES, SAMPLE_DIAGNOSES } from './sample-crashes';

/* ------------------------------------------------------------------ */
/*  Module Mapping                                                     */
/* ------------------------------------------------------------------ */

const MODULE_MAP: { pattern: RegExp; module: string }[] = [
  { pattern: /Character|Player|Movement/i, module: 'arpg-character' },
  { pattern: /AbilitySystem|GAS|Ability|GameplayEffect/i, module: 'arpg-abilities' },
  { pattern: /Inventory|Item|Equip|Slot/i, module: 'arpg-inventory' },
  { pattern: /Menu|HUD|Widget|UI|UMG/i, module: 'arpg-ui-hud' },
  { pattern: /Dialog|Quest|NPC|Conversation/i, module: 'arpg-dialogue-quests' },
  { pattern: /Combat|Damage|Hit|Attack/i, module: 'arpg-combat' },
  { pattern: /Loot|Drop|Reward|Treasure/i, module: 'arpg-loot' },
  { pattern: /AI|BehaviorTree|BTTask|Blackboard|Enemy/i, module: 'arpg-ai' },
  { pattern: /Save|Load|Serial|Persist|Archive/i, module: 'arpg-save-load' },
  { pattern: /Audio|Sound|Music/i, module: 'arpg-audio' },
  { pattern: /Health|Component/i, module: 'arpg-character' },
];

function mapToModule(report: CrashReport): string | null {
  // Check game code frames for module hints
  const gameFrames = report.callstack.filter((f) => f.isGameCode);
  for (const frame of gameFrames) {
    const combined = `${frame.functionName} ${frame.sourceFile ?? ''}`;
    for (const entry of MODULE_MAP) {
      if (entry.pattern.test(combined)) {
        return entry.module;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Crash Origin Detection                                             */
/* ------------------------------------------------------------------ */

function findCulpritFrame(report: CrashReport): CrashReport {
  const updated = { ...report };
  // Find the first game code frame — this is the likely culprit
  const culprit = report.callstack.find((f) => f.isGameCode && f.sourceFile);
  if (culprit) {
    updated.culpritFrame = { ...culprit, isCrashOrigin: true };
    updated.callstack = report.callstack.map((f) =>
      f.index === culprit.index ? { ...f, isCrashOrigin: true } : f,
    );
  }
  // Map to module
  updated.mappedModule = mapToModule(report);
  return updated;
}

/* ------------------------------------------------------------------ */
/*  Pattern Detection                                                  */
/* ------------------------------------------------------------------ */

function detectPatterns(reports: CrashReport[]): CrashPattern[] {
  // Group crashes by their signature (crash type + culprit function)
  const signatureMap = new Map<string, CrashReport[]>();

  for (const report of reports) {
    const culpritFn = report.culpritFrame?.functionName ?? 'unknown';
    const sig = `${report.crashType}::${culpritFn}`;
    const existing = signatureMap.get(sig) ?? [];
    existing.push(report);
    signatureMap.set(sig, existing);
  }

  const patterns: CrashPattern[] = [];
  let patternIdx = 0;

  for (const [sig, crashes] of signatureMap) {
    if (crashes.length < 2) continue; // Only patterns with 2+ occurrences

    const first = crashes[0];
    const signatureFns = [
      ...new Set(
        crashes.flatMap((c) =>
          c.callstack.filter((f) => f.isGameCode).map((f) => f.functionName),
        ),
      ),
    ].slice(0, 5);

    patterns.push({
      id: `pattern-${patternIdx++}`,
      name: `Recurring ${first.crashType.replace(/_/g, ' ')} in ${first.culpritFrame?.functionName ?? 'unknown'}`,
      description: `This crash pattern has been seen ${crashes.length} times. The crash consistently occurs in ${first.culpritFrame?.functionName ?? 'unknown function'} with the same callstack signature.`,
      occurrences: crashes.length,
      crashIds: crashes.map((c) => c.id),
      crashType: first.crashType,
      signatureFunctions: signatureFns,
      isSystemic: crashes.length >= 3,
      rootCause: `Recurring ${first.crashType.replace(/_/g, ' ')} — likely a systemic issue in the ${first.mappedModule ?? 'unknown'} module.`,
      firstSeen: crashes.reduce((min, c) => (c.timestamp < min ? c.timestamp : min), crashes[0].timestamp),
      lastSeen: crashes.reduce((max, c) => (c.timestamp > max ? c.timestamp : max), crashes[0].timestamp),
    });
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/*  Statistics                                                         */
/* ------------------------------------------------------------------ */

function computeStats(reports: CrashReport[], patterns: CrashPattern[]): CrashStats {
  const crashesByType: Record<CrashType, number> = {
    nullptr_deref: 0,
    access_violation: 0,
    assertion_failed: 0,
    ensure_failed: 0,
    gc_reference: 0,
    stack_overflow: 0,
    out_of_memory: 0,
    unhandled_exception: 0,
    fatal_error: 0,
    gpu_crash: 0,
    unknown: 0,
  };

  const crashesBySeverity: Record<CrashSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const crashesByModule: Record<string, number> = {};

  for (const r of reports) {
    crashesByType[r.crashType]++;
    crashesBySeverity[r.severity]++;
    const mod = r.mappedModule ?? 'unmapped';
    crashesByModule[mod] = (crashesByModule[mod] ?? 0) + 1;
  }

  // Find most common type
  let mostCommonType: CrashType = 'unknown';
  let maxTypeCount = 0;
  for (const [type, count] of Object.entries(crashesByType)) {
    if (count > maxTypeCount) {
      maxTypeCount = count;
      mostCommonType = type as CrashType;
    }
  }

  // Find most affected module
  let mostAffectedModule = 'none';
  let maxModCount = 0;
  for (const [mod, count] of Object.entries(crashesByModule)) {
    if (count > maxModCount) {
      maxModCount = count;
      mostAffectedModule = mod;
    }
  }

  // Recent crashes (within 24h)
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentCrashes = reports.filter((r) => new Date(r.timestamp) >= dayAgo).length;

  return {
    totalCrashes: reports.length,
    crashesByType,
    crashesBySeverity,
    crashesByModule,
    patternsDetected: patterns.length,
    systemicIssues: patterns.filter((p) => p.isSystemic).length,
    recentCrashes,
    mostCommonType,
    mostAffectedModule,
  };
}

/* ------------------------------------------------------------------ */
/*  Main Analysis Function                                             */
/* ------------------------------------------------------------------ */

export function analyzeAllCrashes(): CrashAnalyzerResult {
  // Process each crash report
  const processedReports = SAMPLE_CRASHES.map(findCulpritFrame).map((r) => ({
    ...r,
    analyzed: true,
  }));

  // Map diagnoses to processed reports
  const diagnoses = SAMPLE_DIAGNOSES;

  // Detect patterns
  const patterns = detectPatterns(processedReports);

  // Compute stats
  const stats = computeStats(processedReports, patterns);

  return {
    reports: processedReports,
    diagnoses,
    patterns,
    stats,
  };
}

/** Analyze a single crash report (for importing new crashes) */
export function analyzeSingleCrash(report: CrashReport): {
  report: CrashReport;
  diagnosis: CrashDiagnosis | null;
} {
  const processed = findCulpritFrame(report);
  processed.analyzed = true;

  // Try to find a matching diagnosis from known patterns
  const matchingDiagnosis = SAMPLE_DIAGNOSES.find((d) => d.crashId === report.id) ?? null;

  return { report: processed, diagnosis: matchingDiagnosis };
}

/** Parse raw crash log text into a CrashReport */
export function parseCrashLog(rawText: string): CrashReport | null {
  const lines = rawText.split('\n');
  const errorLine = lines.find((l) => l.includes('Error:') && !l.includes('[Callstack]'));
  if (!errorLine) return null;

  // Extract error message
  const errorMatch = errorLine.match(/Error:\s*(.+)/);
  const errorMessage = errorMatch?.[1]?.trim() ?? 'Unknown error';

  // Detect crash type
  let crashType: CrashType = 'unknown';
  if (errorMessage.includes('ACCESS_VIOLATION') || errorMessage.includes('address 0x000000000000')) {
    crashType = 'nullptr_deref';
  } else if (errorMessage.includes('ACCESS_VIOLATION')) {
    crashType = 'access_violation';
  } else if (errorMessage.includes('Assertion failed')) {
    crashType = 'assertion_failed';
  } else if (errorMessage.includes('Ensure condition failed')) {
    crashType = 'ensure_failed';
  } else if (errorMessage.includes('garbage collected')) {
    crashType = 'gc_reference';
  } else if (errorMessage.includes('STACK_OVERFLOW')) {
    crashType = 'stack_overflow';
  } else if (errorMessage.includes('Fatal')) {
    crashType = 'fatal_error';
  }

  // Determine severity
  let severity: CrashSeverity = 'medium';
  if (crashType === 'nullptr_deref' || crashType === 'stack_overflow') severity = 'critical';
  else if (crashType === 'assertion_failed' || crashType === 'gc_reference') severity = 'high';
  else if (crashType === 'ensure_failed') severity = 'low';

  // Extract timestamp
  const tsMatch = rawText.match(/\[(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2})/);
  const timestamp = tsMatch
    ? tsMatch[1].replace(/\./g, (m, offset: number) => (offset <= 9 ? '-' : ':')).replace(/-(\d{2}):/, 'T$1:') + 'Z'
    : new Date().toISOString();

  // Parse callstack frames
  const callstackStart = lines.findIndex((l) => l.includes('[Callstack]'));
  const frames: typeof SAMPLE_CRASHES[0]['callstack'] = [];
  if (callstackStart >= 0) {
    let idx = 0;
    for (let i = callstackStart + 1; i < lines.length; i++) {
      const frameLine = lines[i];
      const frameMatch = frameLine.match(/Error:\s*(\S+)!(\S+)\(\)\s*(?:\[(\S+?)(?::(\d+))?\])?/);
      if (frameMatch) {
        const moduleName = frameMatch[1];
        const isGame = moduleName.includes('MyGame') || !moduleName.includes('UnrealEditor-');
        frames.push({
          index: idx,
          address: `0x00007FF6${(0xA0000000 + idx * 0x1234).toString(16).toUpperCase()}`,
          moduleName,
          functionName: frameMatch[2],
          sourceFile: frameMatch[3] ?? null,
          lineNumber: frameMatch[4] ? parseInt(frameMatch[4]) : null,
          isGameCode: isGame,
          isCrashOrigin: false,
        });
        idx++;
      }
    }
  }

  const id = `crash-${Date.now().toString(36)}`;

  return {
    id,
    timestamp,
    crashType,
    severity,
    errorMessage,
    callstack: frames,
    culpritFrame: null,
    machineState: {
      platform: 'Windows',
      cpuBrand: 'Unknown',
      gpuBrand: 'Unknown',
      ramMB: 0,
      osVersion: 'Unknown',
      engineVersion: '5.5',
      buildConfig: 'Development',
      isEditor: true,
    },
    crashDir: 'Imported',
    mappedModule: null,
    rawLog: rawText,
    analyzed: false,
  };
}
