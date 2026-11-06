/**
 * Design one casting round: up to 5 candidates, each from ITS OWN description (so the owner hears a range, and
 * the casting memory can say which words produced the winner), all speaking the same sample text.
 *
 * Iterate lineage: a spec with `parentVoiceId` re-uses the parent's design seed unless it names its own, so a
 * refined description keeps the iterated voice's identity (ElevenLabs design is seeded: same seed + a close
 * description = a close voice). Only ADDS candidates; verdicts and casting are the owner's clicks (`gate.ts`).
 */
import { randomInt, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { designVoice, DESIGN_MODEL_V3 } from '@/lib/audio-gen/providers/elevenlabs-speech';
import type { SpeechDesignRequest, SpeechDesignResult } from '@/lib/audio-gen/types';
import { ORIGINAL_VOICE_CLAUSE, previewText } from '@/lib/voice/design';
import { insertVoice } from '@/lib/voice/voice-db';
import { writeVoiceFile } from '@/lib/voice/storage';
import {
  getCandidate, insertCandidate, insertRound, MAX_CANDIDATES_PER_ROUND, nextRoundNo, openRound, type CastRound,
} from '@/lib/voice/castingDb';
import type { VoiceRow } from '@/lib/voice/types';
import type { Result } from '@/types/result';

export interface CandidateSpec {
  /** A short handle the owner reads ("gravel, fast, cracking"). */
  label: string;
  /** The design description, 20-900 chars; the original-voice clause is appended. */
  description: string;
  seed?: number;
  /** The voice this one iterates on (its seed is reused unless `seed` is given). */
  parentVoiceId?: string;
}

export interface RoundRequest {
  gameId: string;
  characterId: string;
  brief: string;
  candidates: CandidateSpec[];
  /** Default: the character's own queue lines (100-1000 chars). */
  sampleText?: string;
  model?: string;
}

export interface RoundOutcome { round: CastRound; voices: VoiceRow[]; failed: Array<{ label: string; error: string }>; chars: number }

export interface RoundDeps { design: (req: SpeechDesignRequest) => Promise<SpeechDesignResult>; now: () => number; seed: () => number }
const DEFAULT_DEPS: RoundDeps = { design: designVoice, now: Date.now, seed: () => randomInt(0, 2 ** 31 - 1) };

/** At most this many design calls in flight (the provider's concurrency limit is per plan). */
const CONCURRENCY = 3;

async function mapLimited<T, R>(items: readonly T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export function validateRound(req: RoundRequest): string | null {
  if (!req.brief.trim()) return 'a round needs a brief (what it tries)';
  if (req.candidates.length < 1 || req.candidates.length > MAX_CANDIDATES_PER_ROUND) return `a round has 1-${MAX_CANDIDATES_PER_ROUND} candidates`;
  for (const c of req.candidates) {
    if (!c.label.trim()) return 'every candidate needs a label';
    const d = c.description.trim();
    if (d.length < 20 || d.length > 900) return `candidate "${c.label}": the description must be 20-900 chars (it is ${d.length})`;
    if (c.seed !== undefined && !(Number.isInteger(c.seed) && c.seed >= 0)) return `candidate "${c.label}": seed must be a non-negative integer`;
  }
  return null;
}

export async function designRound(db: Database.Database, req: RoundRequest, deps: RoundDeps = DEFAULT_DEPS): Promise<Result<RoundOutcome, string>> {
  const invalid = validateRound(req);
  if (invalid) return { ok: false, error: invalid };
  const open = openRound(db, req.gameId, req.characterId);
  if (open) return { ok: false, error: `round ${open.roundNo} for ${req.characterId} is still open: the owner closes it (or casts) first` };
  const sampleText = (req.sampleText?.trim() || previewText(db, req.gameId, req.characterId)) ?? '';
  if (sampleText.length < 100 || sampleText.length > 1000) return { ok: false, error: `the sample text must be 100-1000 chars (it is ${sampleText.length}); pass sampleText` };
  const now = deps.now();
  const round: CastRound = {
    id: randomUUID(), gameId: req.gameId, characterId: req.characterId, roundNo: nextRoundNo(db, req.gameId, req.characterId),
    brief: req.brief.trim(), sampleText, model: req.model ?? DESIGN_MODEL_V3, status: 'open', ownerNote: null, createdAt: now, closedAt: null,
  };
  const results = await mapLimited(req.candidates, CONCURRENCY, async (spec, i) => {
    const parentSeed = spec.parentVoiceId ? getCandidate(db, spec.parentVoiceId)?.seed ?? undefined : undefined;
    const seed = spec.seed ?? parentSeed ?? deps.seed();
    const description = `${spec.description.trim()}. ${ORIGINAL_VOICE_CLAUSE}`;
    try {
      const r = await deps.design({ description, text: sampleText, model: round.model, seed });
      const p = r.previews[0];
      if (!p) return { ok: false as const, label: spec.label, error: 'the provider returned no preview' };
      const id = randomUUID();
      const file = writeVoiceFile(`${req.gameId}/previews/${req.characterId}/${id}.mp3`, p.bytes);
      const at = now + i;
      const voice: VoiceRow = {
        id, gameId: req.gameId, characterId: req.characterId, name: `R${round.roundNo}·${i + 1} ${spec.label.trim()}`.slice(0, 80),
        providerVoiceId: null, source: 'designed', designPrompt: description,
        previews: [{ generatedVoiceId: p.generatedVoiceId, file, durationMs: p.durationMs }], status: 'candidate', createdAt: at, updatedAt: at,
      };
      return { ok: true as const, voice, spec, seed, chars: r.chars };
    } catch (e) {
      return { ok: false as const, label: spec.label, error: e instanceof Error ? e.message : String(e) };
    }
  });
  const made = results.filter((r) => r.ok);
  if (made.length === 0) return { ok: false, error: `no candidate was designed: ${results.map((r) => (r.ok ? '' : `${r.label}: ${r.error}`)).join('; ')}` };
  db.transaction(() => {
    insertRound(db, round);
    for (const m of made) {
      insertVoice(db, m.voice);
      insertCandidate(db, { voiceId: m.voice.id, roundId: round.id, label: m.spec.label.trim(), seed: m.seed, parentVoiceId: m.spec.parentVoiceId ?? null, verdict: 'pending', note: null, verdictAt: null });
    }
  })();
  return {
    ok: true,
    data: {
      round, voices: made.map((m) => m.voice), chars: made.reduce((n, m) => n + m.chars, 0),
      failed: results.flatMap((r) => (r.ok ? [] : [{ label: r.label, error: r.error }])),
    },
  };
}
