/**
 * Style DNA — distill a mood board ONCE into a compact per-project style descriptor,
 * then inject it into generation prompts (see `STYLE_DNA_REACH` for exactly which
 * paths inject it today — the claim is asserted, not assumed). The $0 alternative to per-generation
 * image conditioning: no image-reference API dependency, works identically across
 * Leonardo, local SDXL and Tripo text-to-3d prompts, and keeps all generated concepts
 * in one coherent art direction (the "repeat the process in the same style" loop).
 *
 * Pure cores (prompt/parse/fragment) over the anim-critique vision seam — the same
 * structure as input-gate.ts. Persistence lives in style-dna-db.ts.
 */
import type { VisionImage } from '@/lib/anim-critique/critique';
import { makeRoutedVisionText } from '@/lib/vision/seam';

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
export const FRAGMENT_CAP = 4;

/**
 * The fragment's grammar, exported so `styleFragmentPreview` (style-dna-edit.ts) can locate each
 * chip INSIDE the real fragment instead of re-deriving a second one. Order = emission order.
 */
export const STYLE_DNA_FRAGMENT_PREFIX = 'In the established project art style — ';
export const STYLE_DNA_FRAGMENT_LABELS: ReadonlyArray<readonly [keyof StyleDna, string]> = [
  ['palette', 'palette of'],
  ['materials', 'materials:'],
  ['mood', 'mood:'],
  ['render', 'rendered'],
  ['motifs', 'recurring motifs:'],
];

/** Compact prompt fragment appended to a generation prompt. Empty dimensions are skipped. */
export function styleDnaToPromptFragment(dna: StyleDna): string {
  const parts = STYLE_DNA_FRAGMENT_LABELS.map(([key, label]) =>
    dna[key].length ? `${label} ${dna[key].slice(0, FRAGMENT_CAP).join(', ')}` : '',
  ).filter(Boolean);
  return `${STYLE_DNA_FRAGMENT_PREFIX}${parts.join('; ')}.`;
}

/**
 * Provider prompt ceiling the COMBINED prompt+fragment is capped against.
 *
 * 1500 is Leonardo's `MAX_PROMPT_LENGTH` — the tightest limit of the paths that inject
 * the fragment, so capping there is safe everywhere. The two injection sites used to
 * disagree: the Leonardo route sliced, the 3D submit concatenated uncapped, so the path
 * with NO server-side length check was the one that could overrun a provider limit.
 */
export const STYLE_PROMPT_MAX_LENGTH = 1500;

/**
 * The ONE way a style fragment is appended to a generation prompt. Pure.
 *
 * A falsy fragment (style off, or no active profile) returns the prompt untouched —
 * including its original length, so a route's own "prompt too long" 400 still fires on
 * the user's text instead of being silently truncated behind their back.
 */
export function applyStyleFragment(
  prompt: string,
  fragment: string | null | undefined,
  maxLength: number = STYLE_PROMPT_MAX_LENGTH,
): string {
  const base = prompt.trim();
  if (!fragment || !base) return prompt;
  return `${base}. ${fragment}`.slice(0, maxLength);
}

/**
 * One sender of the forge's "apply project style" flag: a file that READS the flag to build a
 * submitted prompt. `resolution` says where the style is resolved — `server` = the file sends the
 * flag and a route resolves it through the ONE canon-aware resolver (`style-apply.ts`); `client` =
 * the file appends the store's active-style snapshot itself (canon-blind; the 3D MCP path has no
 * server hop to resolve on).
 */
export interface StyleDnaSender {
  file: string;
  path: '2D' | '3D';
  resolution: 'server' | 'client';
  /** What it reaches, in the operator's words — the note is built from these. */
  reaches: string;
}

export const STYLE_DNA_SENDERS: readonly StyleDnaSender[] = [
  {
    file: 'src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx',
    path: '3D',
    resolution: 'client',
    reaches: 'Asset Forge 3D generation prompts (text-to-3D and image-to-3D)',
  },
  {
    file: 'src/components/modules/visual-gen/asset-forge/Image2DPanel.tsx',
    path: '2D',
    resolution: 'server',
    reaches: 'Asset Forge 2D image prompts (resolved on the server)',
  },
];

const reachedPaths = [...new Set(STYLE_DNA_SENDERS.map((s) => s.path))].sort();

/**
 * WHERE the flag actually reaches — DERIVED from {@link STYLE_DNA_SENDERS}, so the toggle's label
 * cannot claim more than its senders deliver (it once read "Applied to prompts" while reaching
 * only the 3D submit, then "3D prompts" while the 2D front sent no style at all).
 *
 * `senders` is asserted against the real readers of the flag by
 * `src/__tests__/components/visual-gen/StyleDnaReach.test.tsx`: adding a reader without a table
 * row (or the reverse) fails that test. Server routes that accept `applyStyleDna` without a forge
 * sender (/api/leonardo, /api/visual-gen/contact-sheet — batch scripts and catalog sheets) resolve
 * through the same `style-apply.ts` and are not toggle reach.
 */
export const STYLE_DNA_REACH = {
  /** Source files that READ the flag and inject (or send) the style for a submitted prompt. */
  senders: STYLE_DNA_SENDERS.map((s) => s.file),
  /** The noun the toggle uses — every path a sender covers, and no other. */
  label: `${reachedPaths.join(' + ')} prompts`,
  /** The full sentence shown beside the toggle. */
  note: `Appended to ${STYLE_DNA_SENDERS.map((s) => s.reaches).join(' and ')}.`,
} as const;

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
  const vision = deps.vision ?? makeRoutedVisionText();
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
