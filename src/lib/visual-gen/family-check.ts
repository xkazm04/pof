/**
 * Creature FAMILY check — does a generated figure read as the family it was generated for?
 * (/diablo W04, decision D15.)
 *
 * The bestiary's Concept 2D Art checker only asks whether a candidate is SELECTED, so a "zombie"
 * that renders as a skeleton (W03: 3 of 3 with the Diablo style applied) would pass. This is the
 * instrument that can fail it: a vision model names which of the listed families the figure reads
 * as, and the verdict compares that answer with the family the entity belongs to.
 *
 * BLIND by construction: the prompt lists the candidate families but never says which one is
 * expected, so the model cannot be led to the answer; the list order is fixed by the caller, not
 * by the expectation. A vision or parse failure is a described outcome, never a pass.
 *
 * Pure prompt/parse cores over the injectable vision seam (same structure as style-dna.ts).
 */
import type { VisionImage } from '@/lib/anim-critique/critique';
import { makeRoutedVisionText } from '@/lib/vision/seam';

export interface FamilyReply {
  family: string;
  confidence: number | null;
  cues: string;
}

export type FamilyVerdict =
  | { ok: true; pass: boolean; expected: string; seen: FamilyReply; raw: string; reason: string }
  | { ok: false; expected: string; error: string; raw?: string };

const norm = (s: string) => s.trim().toLowerCase();

/** The one-line marker protocol. `families` must include the expected one; 'other' is always offered. */
export function buildFamilyPrompt(families: readonly string[]): string {
  const offered = [...new Set([...families.map(norm), 'other'])];
  return (
    'This image shows ONE creature figure. Judge ONLY its anatomy — flesh, bone, horns, limbs, posture — not its ' +
    'style, colours or rendering. Which ONE of these creature families does it read as: ' +
    `${offered.join(' | ')}? ` +
    'Reply on ONE line EXACTLY as: FAMILY=<one name from the list>; CONFIDENCE=<0-1>; CUES=<the visible anatomy that decided it>'
  );
}

export function parseFamilyReply(text: string, families: readonly string[]): FamilyReply | { error: string } {
  const offered = new Set([...families.map(norm), 'other']);
  const fam = /FAMILY\s*=\s*([^;\n]+)/i.exec(text)?.[1];
  if (!fam) return { error: 'no FAMILY= marker in the vision reply' };
  const family = norm(fam);
  if (!offered.has(family)) return { error: `FAMILY="${family}" is not one of the offered families` };
  const c = /CONFIDENCE\s*=\s*([0-9.]+)/i.exec(text)?.[1];
  const confidence = c != null && Number.isFinite(Number(c)) ? Math.max(0, Math.min(1, Number(c))) : null;
  const cues = /CUES\s*=\s*(.+)$/im.exec(text)?.[1]?.trim() ?? '';
  return { family, confidence, cues };
}

export interface FamilyCheckDeps {
  vision?: (images: VisionImage[], prompt: string) => Promise<string>;
}

/** Judge one image against the family its entity belongs to. */
export async function checkFamily(
  image: VisionImage,
  expected: string,
  families: readonly string[],
  deps: FamilyCheckDeps = {},
): Promise<FamilyVerdict> {
  const exp = norm(expected);
  if (!families.map(norm).includes(exp)) {
    return { ok: false, expected: exp, error: `expected family "${exp}" is not in the offered list — the check would be rigged` };
  }
  const vision = deps.vision ?? makeRoutedVisionText();
  let raw: string;
  try {
    raw = await vision([image], buildFamilyPrompt(families));
  } catch (e) {
    return { ok: false, expected: exp, error: e instanceof Error ? e.message : String(e) };
  }
  const seen = parseFamilyReply(raw, families);
  if ('error' in seen) return { ok: false, expected: exp, error: seen.error, raw };
  const pass = seen.family === exp;
  return {
    ok: true,
    pass,
    expected: exp,
    seen,
    raw,
    reason: pass
      ? `reads as "${seen.family}" as intended (${seen.cues || 'no cues given'})`
      : `generated as "${exp}" but reads as "${seen.family}" (${seen.cues || 'no cues given'})`,
  };
}
