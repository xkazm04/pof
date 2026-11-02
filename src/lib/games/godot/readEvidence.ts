/**
 * Server-only (fs + git): PoF's reading of one `pof.godot-evidence/1` file (spark gtai-phase-2, WP2).
 *
 * Verdict, in this order (the brief's rules; first match wins):
 *  1. file absent                                   → deferred "no evidence yet"
 *  2. unparseable, schema / kind / gameId mismatch,
 *     a missing required field or a `null` optional → fail
 *  3. game HEAD unknown (git rev-parse failed)       → deferred, reason names it
 *  4. `commit` ≠ the game HEAD                       → deferred "stale: evidence from <sha7>, HEAD <sha7>"
 *  5. `status: 'fail'`                               → fail
 *  6. otherwise                                      → pass
 *
 * The game writes the file; PoF never observes the run. Rule 4 is what keeps a green file from an
 * older commit from certifying today's tree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { Result } from '@/types/result';
import {
  GODOT_EVIDENCE_DIR, GODOT_EVIDENCE_SCHEMA,
  type GodotEvidence, type GodotEvidenceKind, type GodotEvidenceVerdict,
} from './evidenceTypes';

export interface ReadEvidenceDeps {
  /** Full SHA of the game repo HEAD, or null when unknown. Default: `git -C <root> rev-parse HEAD`. */
  headOf?: (root: string) => string | null;
  /** File text, or null when the file does not exist. Throws for any other read error. */
  readFile?: (p: string) => string | null;
  /** When set, the envelope's `gameId` must equal it. */
  gameId?: string;
}

export function godotEvidencePath(root: string, kind: GodotEvidenceKind): string {
  return path.join(root, ...GODOT_EVIDENCE_DIR.split('/'), `${kind}.json`);
}

export function gitHeadOf(root: string): string | null {
  try {
    const out = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000, windowsHide: true,
    }).trim();
    return /^[0-9a-f]{40}$/i.test(out) ? out.toLowerCase() : null;
  } catch {
    return null;
  }
}

function readFileOrNull(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

const sha7 = (s: string): string => s.slice(0, 7);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const REQUIRED_STRINGS = ['gameId', 'commit', 'builtAt', 'godotVersion', 'summary'] as const;

/** Validate an evidence file's text against the envelope. Pure. */
export function parseGodotEvidence(text: string, kind: GodotEvidenceKind, gameId?: string): Result<GodotEvidence, string> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `unparseable JSON: ${(e as Error).message}` };
  }
  if (!isObj(raw)) return { ok: false, error: 'not a JSON object' };
  if (raw.schema !== GODOT_EVIDENCE_SCHEMA) return { ok: false, error: `schema ${JSON.stringify(raw.schema)}, expected ${GODOT_EVIDENCE_SCHEMA}` };
  if (raw.kind !== kind) return { ok: false, error: `kind ${JSON.stringify(raw.kind)}, expected ${kind}` };
  for (const k of REQUIRED_STRINGS) {
    if (typeof raw[k] !== 'string' || raw[k] === '') return { ok: false, error: `required field ${k} missing or not a non-empty string` };
  }
  if (raw.status !== 'pass' && raw.status !== 'fail') return { ok: false, error: `status ${JSON.stringify(raw.status)}, expected pass|fail` };
  if (gameId !== undefined && raw.gameId !== gameId) return { ok: false, error: `gameId ${raw.gameId}, expected ${gameId}` };
  for (const k of ['counts', 'metrics', 'artifacts'] as const) {
    if (raw[k] === null) return { ok: false, error: `${k} is null: absent optional keys are omitted, never null` };
  }
  if (raw.counts !== undefined) {
    const c = raw.counts;
    if (!isObj(c) || !['passed', 'failed', 'skipped'].every((n) => typeof c[n] === 'number')) {
      return { ok: false, error: 'counts must be {passed, failed, skipped} numbers' };
    }
  }
  if (raw.metrics !== undefined && (!isObj(raw.metrics) || !Object.values(raw.metrics).every((n) => typeof n === 'number'))) {
    return { ok: false, error: 'metrics must be a record of numbers' };
  }
  if (raw.artifacts !== undefined && (!Array.isArray(raw.artifacts) || !raw.artifacts.every((a) => typeof a === 'string'))) {
    return { ok: false, error: 'artifacts must be an array of strings' };
  }
  return { ok: true, data: raw as unknown as GodotEvidence };
}

function countsText(e: GodotEvidence): string {
  return e.counts ? ` (${e.counts.passed} passed, ${e.counts.failed} failed, ${e.counts.skipped} skipped)` : '';
}

/** Read and judge `<root>/build/evidence/<kind>.json`. Never throws. */
export function readGodotEvidence(root: string, kind: GodotEvidenceKind, deps: ReadEvidenceDeps = {}): GodotEvidenceVerdict {
  const file = godotEvidencePath(root, kind);
  let text: string | null;
  try {
    text = (deps.readFile ?? readFileOrNull)(file);
  } catch (e) {
    return { status: 'fail', detail: `${kind}: evidence unreadable`, reason: `${file}: ${(e as Error).message}` };
  }
  if (text === null) return { status: 'deferred', detail: `${kind}: no evidence yet`, reason: `no evidence yet: ${file} is absent` };

  const parsed = parseGodotEvidence(text, kind, deps.gameId);
  if (!parsed.ok) return { status: 'fail', detail: `${kind}: evidence malformed`, reason: `${file}: ${parsed.error}` };
  const evidence = parsed.data;

  const head = (deps.headOf ?? gitHeadOf)(root);
  if (head === null) {
    return { status: 'deferred', detail: `${kind}: game HEAD unknown`, reason: `cannot read the game HEAD (git -C ${root} rev-parse HEAD failed), so evidence from ${sha7(evidence.commit)} cannot be dated`, evidence };
  }
  if (evidence.commit.toLowerCase() !== head.toLowerCase()) {
    return { status: 'deferred', detail: `${kind}: stale evidence`, reason: `stale: evidence from ${sha7(evidence.commit)}, HEAD ${sha7(head)}`, evidence };
  }
  if (evidence.status === 'fail') {
    return { status: 'fail', detail: `${kind}: ${evidence.summary}${countsText(evidence)}`, reason: `${kind} failed at ${sha7(head)}: ${evidence.summary}`, evidence };
  }
  return { status: 'pass', detail: `${kind}: ${evidence.summary}${countsText(evidence)} at ${sha7(head)}`, evidence };
}
