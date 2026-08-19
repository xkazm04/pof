/**
 * Input gate — Tier-0 quality gate on the 2D concept image BEFORE an image→3D job is
 * dispatched. Every existing gate (mesh-critique, CLIP fidelity, VLM critique) runs on
 * the OUTPUT; this is the symmetric input check, mechanically enforcing the image→3D
 * input-prep practices (single subject, plain background, near-canonical pose — see
 * reference-roles GEN_PROMPTING_PRACTICES) that otherwise only live in prompts. A bad
 * input caught here saves the generation credits and the downstream fused-limb /
 * fragmented-mesh failures it would cause.
 *
 * WHERE IT RUNS (the saving is realized, not merely claimed): `POST /api/visual-gen/generate`
 * calls `gateInputImage` for every `image-to-3d` submit BEFORE it starts a provider job,
 * and returns a 400 on a `fail` verdict — see the `InputGateOutcome` block below for the
 * three honest states (ran / unavailable / skipped). `POST /api/visual-gen/input-gate`
 * remains the standalone probe for the same check.
 *
 * Pure cores (prompt/parse/score) over the anim-critique vision seam
 * (`(images, prompt) => Promise<string>`, default DashScope Qwen-VL) — gate + regenerate,
 * PoF's pattern, rather than the image-EDIT step other tools use.
 */
import type { VisionImage } from '@/lib/anim-critique/critique';
import { makeQwenVision } from '@/lib/anim-critique/qwen';
import type { Scorecard } from './mesh-critique';

/** One-line reply protocol shared with pof_vlm_critique.py: SCORE / DEFECTS / VERDICT. */
export function buildInputGatePrompt(subject = 'character or object concept'): string {
  return (
    `This image is a 2D concept of a '${subject}' about to be fed to an image-to-3D mesh generator. ` +
    'Score how well it satisfies the generator input requirements: ' +
    '(1) exactly one subject, no scene clutter or companions; ' +
    '(2) plain uniform background (white/neutral) with nothing that could bleed into the mesh; ' +
    '(3) near-canonical pose — roughly A-pose, limbs uncrossed, minimal self-occlusion; ' +
    '(4) subject fully in frame, not cropped; ' +
    '(5) clean readable silhouette without motion blur or extreme stylization. ' +
    'Violations cause fused limbs, floaters and fragmented geometry downstream. ' +
    'Reply on ONE line EXACTLY as: ' +
    "SCORE=<0-10 integer>; DEFECTS=<comma-separated problems or 'none'>; VERDICT=<one short sentence>."
  );
}

export interface GateReply {
  ok: boolean;
  score?: number;
  defects?: string[];
  verdict?: string;
  error?: string;
}

/** Parse the SCORE/DEFECTS/VERDICT line out of a (possibly chatty/fenced) reply. Pure. */
export function parseGateReply(text: string): GateReply {
  const score = text.match(/SCORE=\s*(\d+)/);
  if (!score) return { ok: false, error: 'no SCORE marker in the vision reply' };
  const defectsRaw = text.match(/DEFECTS=\s*([^;\n]+)/)?.[1]?.trim() ?? '';
  const defects = /^(none|n\/a|-)?$/i.test(defectsRaw)
    ? []
    : defectsRaw.split(',').map((d) => d.trim()).filter(Boolean);
  const verdict = text.match(/VERDICT=\s*([^\n`]+)/)?.[1]?.trim();
  return { ok: true, score: Number(score[1]), defects, verdict };
}

export interface GateThresholds {
  /** score >= passAt → pass. Default 7 — the proven gap-loop VLM gate line. */
  passAt: number;
  /** score < failBelow → fail; between failBelow and passAt → warn. */
  failBelow: number;
}

const DEFAULT_GATE: GateThresholds = { passAt: 7, failBelow: 5 };

/** Map a parsed reply to the shared pass/warn/fail scorecard shape. Pure. */
export function scoreInputGate(reply: GateReply, thresholds: Partial<GateThresholds> = {}): Scorecard {
  const t = { ...DEFAULT_GATE, ...thresholds };
  const score = reply.score ?? 0;
  const verdict = score >= t.passAt ? 'pass' : score >= t.failBelow ? 'warn' : 'fail';
  const reasons = [...(reply.defects ?? [])];
  if (reply.verdict) reasons.push(reply.verdict);
  return { verdict, score: score * 10, reasons };
}

/** Split an image data URL into the vision-seam shape; null if not an image data URL. */
export function parseVisionImage(dataUrl: string): VisionImage | null {
  const m = dataUrl.match(/^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/i);
  return m ? { mime: m[1], base64: m[2] } : null;
}

export type GateCard = Scorecard & { ok: true; raw: string };
export type GateFailure = { ok: false; error: string; raw?: string; verdict?: undefined };

export interface InputGateDeps {
  /** Vision seam (images, prompt) => reply text; defaults to DashScope Qwen-VL. */
  vision?: (images: VisionImage[], prompt: string) => Promise<string>;
  subject?: string;
  thresholds?: Partial<GateThresholds>;
}

/**
 * What the generate route REPORTS about the gate, in the same vocabulary the mesh
 * critique uses for its own "could not run" state (`critiqueUnavailable` / `summarizeGate`).
 *
 * `ran: false` is deliberately NOT a pass. Until this shipped, `gateInputImage` had zero
 * callers — the forge posted the raw image straight to the paid generation — so the
 * credit saving this file's header claims was never realized. The one thing worse than
 * no gate is a gate that silently waves an image through when it cannot run, so an
 * unavailable gate says so and the image is stamped as submitted ungated.
 */
export type InputGateOutcome =
  | { ran: true; verdict: Scorecard['verdict']; score: number; reasons: string[]; overridden?: boolean; note: string }
  | { ran: false; unavailable?: boolean; note: string };

/** The gate could not run at all (no key, transport failure, unparseable reply). Pure. */
export function inputGateUnavailable(reason: string): InputGateOutcome {
  return { ran: false, unavailable: true, note: `input gate unavailable: ${reason} — image submitted ungated` };
}

/** The caller explicitly opted out. Stated, never inferred from a missing field. Pure. */
export function inputGateSkipped(reason = 'the caller sent gateInput: false'): InputGateOutcome {
  return { ran: false, note: `input gate skipped: ${reason} — image submitted ungated` };
}

/** Turn one gate result into the outcome a job reports. Pure. */
export function summarizeInputGate(card: GateCard | GateFailure): InputGateOutcome {
  if (!card.ok) return inputGateUnavailable(card.error);
  const reasons = card.reasons ?? [];
  return {
    ran: true,
    verdict: card.verdict,
    score: card.score,
    reasons,
    note:
      `input gate ${card.verdict.toUpperCase()} (score ${card.score}/100)` +
      (reasons.length ? `: ${reasons.join('; ')}` : ''),
  };
}

/**
 * The refusal message for an outcome that must NOT spend a generation — null when the
 * submit may proceed. Pure, so the "which verdicts cost money" rule is one testable line.
 *
 * Only a verdict the gate actually PRODUCED can refuse: an unavailable gate has measured
 * nothing and therefore cannot condemn an image, exactly as an unavailable mesh critique
 * never fails a mesh (wave 12's `critique.unavailable → ungated` early exit).
 */
export function inputGateRefusal(outcome: InputGateOutcome): string | null {
  if (!outcome.ran || outcome.verdict !== 'fail') return null;
  return (
    `${outcome.note} — refused before any provider call, so no generation was spent. ` +
    'Fix the concept image (one subject, plain background, near-canonical uncropped pose) ' +
    'or resubmit with overrideInputGate: true to generate anyway.'
  );
}

/** Stamp an outcome the caller chose to generate through anyway. Pure. */
export function inputGateOverridden(outcome: InputGateOutcome): InputGateOutcome {
  if (!outcome.ran) return outcome;
  return { ...outcome, overridden: true, note: `${outcome.note} — OVERRIDDEN by the caller; generation ran anyway` };
}

/** Gate one concept image. A vision/parse failure is ok:false with the reason — never a fake verdict. */
export async function gateInputImage(image: VisionImage, deps: InputGateDeps = {}): Promise<GateCard | GateFailure> {
  const vision = deps.vision ?? makeQwenVision();
  let raw: string;
  try {
    raw = await vision([image], buildInputGatePrompt(deps.subject));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const reply = parseGateReply(raw);
  if (!reply.ok) return { ok: false, error: reply.error ?? 'unparseable vision reply', raw };
  return { ok: true, raw, ...scoreInputGate(reply, deps.thresholds) };
}
