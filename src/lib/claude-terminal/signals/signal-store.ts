/**
 * Signal Store — File-based persistence for CLI improvement signals.
 *
 * Stores signals, patterns, and improvement records in `.pof/signals/`.
 * Uses JSONL (one JSON object per line) for append-only signal logging.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Signal, Pattern, ImprovementRecord } from './signal-types';

// ============ Paths ============

const SIGNALS_DIR = path.join(process.cwd(), '.pof', 'signals');
const EVENTS_FILE = path.join(SIGNALS_DIR, 'events.jsonl');
const PATTERNS_FILE = path.join(SIGNALS_DIR, 'patterns.json');
const IMPROVEMENTS_FILE = path.join(SIGNALS_DIR, 'improvements.jsonl');

// ============ Directory Setup ============

function ensureDir(): void {
  if (!fs.existsSync(SIGNALS_DIR)) {
    fs.mkdirSync(SIGNALS_DIR, { recursive: true });
  }
}

// ============ Signals (JSONL) ============

export function appendSignal(signal: Signal): void {
  ensureDir();
  fs.appendFileSync(EVENTS_FILE, JSON.stringify(signal) + '\n', 'utf-8');
}

export function getSignals(since?: number): Signal[] {
  if (!fs.existsSync(EVENTS_FILE)) return [];

  const lines = fs.readFileSync(EVENTS_FILE, 'utf-8').split('\n').filter(Boolean);
  const signals: Signal[] = [];

  for (const line of lines) {
    try {
      const signal = JSON.parse(line) as Signal;
      if (!since || signal.timestamp >= since) {
        signals.push(signal);
      }
    } catch {
      // Skip malformed lines
    }
  }

  return signals;
}

// ============ Patterns (JSON) ============

export function getPatterns(): Pattern[] {
  if (!fs.existsSync(PATTERNS_FILE)) return [];

  try {
    const raw = fs.readFileSync(PATTERNS_FILE, 'utf-8');
    return JSON.parse(raw) as Pattern[];
  } catch {
    return [];
  }
}

export function savePatterns(patterns: Pattern[]): void {
  ensureDir();
  fs.writeFileSync(PATTERNS_FILE, JSON.stringify(patterns, null, 2), 'utf-8');
}

export function markPatternsResolved(fingerprints: string[]): void {
  const patterns = getPatterns();
  const fpSet = new Set(fingerprints);
  let changed = false;

  for (const pattern of patterns) {
    if (fpSet.has(pattern.fingerprint) && !pattern.resolved) {
      pattern.resolved = true;
      changed = true;
    }
  }

  if (changed) {
    savePatterns(patterns);
  }
}

// ============ Improvements (JSONL) ============

export function appendImprovement(record: ImprovementRecord): void {
  ensureDir();
  fs.appendFileSync(IMPROVEMENTS_FILE, JSON.stringify(record) + '\n', 'utf-8');
}

export function getImprovements(): ImprovementRecord[] {
  if (!fs.existsSync(IMPROVEMENTS_FILE)) return [];

  const lines = fs.readFileSync(IMPROVEMENTS_FILE, 'utf-8').split('\n').filter(Boolean);
  const records: ImprovementRecord[] = [];

  for (const line of lines) {
    try {
      records.push(JSON.parse(line) as ImprovementRecord);
    } catch {
      // Skip malformed
    }
  }

  return records;
}
