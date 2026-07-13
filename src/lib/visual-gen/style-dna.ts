/**
 * Style DNA — distill a mood board ONCE into a compact per-project style descriptor,
 * then inject it into every 2D-generation prompt. The $0 alternative to per-generation
 * image conditioning: no image-reference API dependency, works identically across
 * Leonardo, local SDXL and Tripo text-to-3d prompts, and keeps all generated concepts
 * in one coherent art direction (the "repeat the process in the same style" loop).
 *
 * Pure cores (prompt/parse/fragment) over the anim-critique vision seam — the same
 * structure as input-gate.ts. Persistence lives in style-dna-db.ts.
 */
import type { VisionImage } from '@/lib/anim-critique/critique';
import { makeQwenVision } from '@/lib/anim-critique/qwen';

export interface StyleDna {
  palette: string[];
  materials: string[];
  mood: string[];
  render: string[];
  motifs: string[];
}

/** One-line marker protocol (PALETTE/MATERIALS/MOOD/RENDER/MOTIFS), same discipline as the input gate. */
export function buildStyleDnaPrompt(imageCount: number): string {
  return (
    `These ${imageCount} images are a mood board defining one game project's art direction. ` +
    'Distill the SHARED style into its reusable DNA — what makes any new asset belong to this set. ' +
    'Name only what is common across the board, not per-image content. ' +
    'Reply on ONE line EXACTLY as: ' +
    'PALETTE=<3-4 comma-separated color descriptions>; ' +
    'MATERIALS=<comma-separated signature materials/surfaces>; ' +
    'MOOD=<comma-separated mood/tone words>; ' +
    'RENDER=<comma-separated rendering-style terms (e.g. painterly, cel shaded, photoreal)>; ' +
    "MOTIFS=<comma-separated recurring shapes/themes, or 'none'>."
  );
}

export interface StyleDnaReply {
  ok: boolean;
  dna?: StyleDna;
  error?: string;
}

const parseList = (text: string, key: string): string[] => {
  const raw = text.match(new RegExp(`${key}=\\s*([^;\\n\`]+)`))?.[1]?.trim() ?? '';
  if (/^(none|n\/a|-)?$/i.test(raw)) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
};

/** Parse the five-dimension line out of a (possibly chatty/fenced) reply. Pure. */
export function parseStyleDnaReply(text: string): StyleDnaReply {
  if (!/PALETTE=/.test(text)) return { ok: false, error: 'no PALETTE marker in the vision reply' };
  return {
    ok: true,
    dna: {
      palette: parseList(text, 'PALETTE'),
      materials: parseList(text, 'MATERIALS'),
      mood: parseList(text, 'MOOD'),
      render: parseList(text, 'RENDER'),
      motifs: parseList(text, 'MOTIFS'),
    },
  };
}

/** Max items per dimension in the injected fragment — keeps it inside prompt budgets. */
const FRAGMENT_CAP = 4;

/** Compact prompt fragment appended to a generation prompt. Empty dimensions are skipped. */
export function styleDnaToPromptFragment(dna: StyleDna): string {
  const part = (label: string, items: string[]) =>
    items.length ? `${label} ${items.slice(0, FRAGMENT_CAP).join(', ')}` : '';
  const parts = [
    part('palette of', dna.palette),
    part('materials:', dna.materials),
    part('mood:', dna.mood),
    part('rendered', dna.render),
    part('recurring motifs:', dna.motifs),
  ].filter(Boolean);
  return `In the established project art style — ${parts.join('; ')}.`;
}

export type StyleDnaResult =
  | { ok: true; dna: StyleDna; raw: string }
  | { ok: false; error: string; raw?: string };

export interface StyleDnaDeps {
  /** Vision seam (images, prompt) => reply text; defaults to DashScope Qwen-VL. */
  vision?: (images: VisionImage[], prompt: string) => Promise<string>;
}

/** Distill a mood board into StyleDna. A vision/parse failure carries the reason — never fake DNA. */
export async function distillStyleDna(images: VisionImage[], deps: StyleDnaDeps = {}): Promise<StyleDnaResult> {
  if (!images.length) return { ok: false, error: 'mood board is empty — provide at least one image' };
  const vision = deps.vision ?? makeQwenVision();
  let raw: string;
  try {
    raw = await vision(images, buildStyleDnaPrompt(images.length));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const reply = parseStyleDnaReply(raw);
  if (!reply.ok || !reply.dna) return { ok: false, error: reply.error ?? 'unparseable vision reply', raw };
  return { ok: true, dna: reply.dna, raw };
}
