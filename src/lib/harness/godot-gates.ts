/**
 * Godot verification gates (spark gtai-phase-2, WP2) — the harness's gate for a game whose engine is
 * Godot. Environment: `POF_GODOT_BIN` (the Godot executable) + the game root (`gameRootFor(game)`:
 * `POF_GAME_ROOT_<ID>`, else the game's `engine.root`).
 *
 * The run is `"<bin>" --headless --path "<root>" -s <script>`, or the gate's own `command`, executed in
 * the game root. It is judged by the `pof.godot-evidence/1` file it WROTE, never by exit code alone:
 *  - no env, no game, no root, nothing to run      → unverifiable (never a pass)
 *  - evidence `fail` (incl. malformed)             → fail
 *  - evidence pass, fresh (builtAt ≥ run start), exit 0 → pass
 *  - evidence absent / stale commit / HEAD unknown / not written by this run / pass with a non-zero exit
 *                                                 → unverifiable (the run's outcome is not known)
 */
import type { VerificationGate, VerificationResult } from './types';
import type { Result } from '@/types/result';
import type { GameId } from '@/lib/games/types';
import type { GodotEvidenceKind, GodotEvidenceVerdict } from '@/lib/games/godot/evidenceTypes';
import { gameRootEnvVar, gameRootFor } from '@/lib/games/gameRoot';
import { readGodotEvidence } from '@/lib/games/godot/readEvidence';

export type GodotGateType = Extract<VerificationGate['type'], 'godot-test' | 'godot-export'>;

/** Which evidence kind each godot gate type is judged by. */
export const GODOT_GATE_EVIDENCE: Readonly<Record<GodotGateType, GodotEvidenceKind>> = {
  'godot-test': 'unit-tests',
  'godot-export': 'export-audit',
};

export function isGodotGate(gate: Pick<VerificationGate, 'type'>): gate is VerificationGate & { type: GodotGateType } {
  return gate.type === 'godot-test' || gate.type === 'godot-export';
}

export interface GodotEnv {
  /** Absolute path to the Godot executable — POF_GODOT_BIN. */
  bin: string;
}

export function resolveGodotEnv(env: Readonly<Record<string, string | undefined>> = process.env): GodotEnv | null {
  const bin = env.POF_GODOT_BIN?.trim();
  return bin ? { bin } : null;
}

/** The command a godot gate runs: its own `command`, else the headless `-s <script>` form, else null. */
export function deriveGodotCommand(env: GodotEnv, root: string, gate: Pick<VerificationGate, 'command' | 'script'>): string | null {
  if (gate.command?.trim()) return gate.command;
  if (!gate.script?.trim()) return null;
  return `"${env.bin}" --headless --path "${root}" -s ${gate.script.trim()}`;
}

/** Build a godot gate for a game. Advisory unless `required` is set. */
export function createGodotGate(
  type: GodotGateType, game: GameId, opts: { script?: string; command?: string; required?: boolean; name?: string } = {},
): VerificationGate {
  return {
    name: opts.name ?? type,
    type,
    required: opts.required ?? false,
    game,
    ...(opts.script ? { script: opts.script } : {}),
    ...(opts.command ? { command: opts.command } : {}),
  };
}

export interface GodotGateDeps {
  /** `undefined` → `resolveGodotEnv()`; `null` forces the no-env path. */
  env?: GodotEnv | null;
  rootFor?: (id: GameId) => string | null;
  run: (command: string, cwd: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  read?: (root: string, kind: GodotEvidenceKind, game: GameId) => GodotEvidenceVerdict;
  now?: () => number;
}

/** Tolerance for `builtAt` vs the run start (same machine; second-resolution timestamps). */
const FRESH_SLACK_MS = 2_000;

export interface GodotGatePlan {
  env: GodotEnv;
  game: GameId;
  root: string;
  command: string;
}

/** Resolve everything a godot gate needs to run, or the reason it cannot (also the launch preflight). */
export function planGodotGate(gate: VerificationGate, deps: Pick<GodotGateDeps, 'env' | 'rootFor'> = {}): Result<GodotGatePlan, string> {
  const env = deps.env !== undefined ? deps.env : resolveGodotEnv();
  if (!env) return { ok: false, error: 'POF_GODOT_BIN is not set' };
  if (!gate.game) return { ok: false, error: 'the gate names no game' };
  const root = (deps.rootFor ?? ((id: GameId) => gameRootFor(id)))(gate.game);
  if (root === null) return { ok: false, error: `no game root for ${gate.game} (${gameRootEnvVar(gate.game)} or engine.root not on disk)` };
  const command = deriveGodotCommand(env, root, gate);
  if (!command) return { ok: false, error: 'the gate has neither a command nor a script' };
  return { ok: true, data: { env, game: gate.game, root, command } };
}

function unverifiable(gate: VerificationGate, why: string, durationMs = 0, output?: string): VerificationResult {
  return {
    gate: gate.name,
    passed: false,
    unverifiable: true,
    output: `Godot gate UNVERIFIABLE — ${why}. The area is NOT self-certified.${output ? `\n${output}` : ''}`,
    durationMs,
    errors: [{ message: why }],
  };
}

export async function runGodotGate(gate: VerificationGate, deps: GodotGateDeps): Promise<VerificationResult> {
  if (!isGodotGate(gate)) return unverifiable(gate, `gate type ${gate.type} is not a godot gate`);
  const plan = planGodotGate(gate, deps);
  if (!plan.ok) return unverifiable(gate, plan.error);
  const { game, root, command } = plan.data;
  const kind = GODOT_GATE_EVIDENCE[gate.type];
  const now = deps.now ?? Date.now;

  const start = now();
  const res = await deps.run(command, root);
  const durationMs = now() - start;
  const tail = [res.stdout, res.stderr].filter(Boolean).join('\n').slice(-2000);
  const v = (deps.read ?? ((r, k, g) => readGodotEvidence(r, k, { gameId: g })))(root, kind, game);

  if (v.status === 'fail') {
    return { gate: gate.name, passed: false, output: `${v.detail}${v.reason ? ` — ${v.reason}` : ''}\n${tail}`.trim(), durationMs, errors: [{ message: v.reason ?? v.detail }] };
  }
  if (v.status === 'deferred') return unverifiable(gate, `${kind} evidence not usable: ${v.reason ?? v.detail} (exit ${res.exitCode})`, durationMs, tail);
  const builtAt = v.evidence ? Date.parse(v.evidence.builtAt) : NaN;
  if (!Number.isFinite(builtAt) || builtAt < start - FRESH_SLACK_MS) {
    return unverifiable(gate, `${kind} evidence was not written by this run (builtAt ${v.evidence?.builtAt ?? '?'})`, durationMs, tail);
  }
  if (res.exitCode !== 0) {
    return unverifiable(gate, `${kind} evidence says pass but the run exited ${res.exitCode}`, durationMs, tail);
  }
  return { gate: gate.name, passed: true, output: v.detail, durationMs };
}
