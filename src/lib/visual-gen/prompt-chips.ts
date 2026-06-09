import type { GenerationMode } from '@/lib/visual-gen/providers';

/**
 * Chip vocabulary for the no-jargon visual prompt builder. Each chip pairs a
 * plain-English label the user clicks with a richer `fragment` that carries the
 * technical phrasing image/3D models respond to. Every chip's `keyword` is a
 * member of a rule in `@/lib/visual-gen/style-keywords`, and the keyword is
 * embedded in the fragment, so a chip-built prompt stays detectable by the same
 * heuristic analyzer the materials style-transfer route uses — one source, no
 * jargon drift.
 */

export type ChipGroupId = 'material' | 'mood' | 'gameStyle';

export interface PromptChip {
  /** Unique, stable id (e.g. `mat-stone`). */
  id: string;
  /** Plain-English label shown on the chip. */
  label: string;
  group: ChipGroupId;
  /** Keyword shared with a `STYLE_RULES` rule — also present in `fragment`. */
  keyword: string;
  /** Prompt phrasing injected when the chip is selected. */
  fragment: string;
}

export interface PromptChipGroup {
  id: ChipGroupId;
  label: string;
  hint: string;
  chips: PromptChip[];
}

/** Render + composition order of the groups. */
export const CHIP_GROUP_ORDER: ChipGroupId[] = ['material', 'mood', 'gameStyle'];

const MATERIAL_CHIPS: PromptChip[] = [
  { id: 'mat-stone', label: 'Stone', group: 'material', keyword: 'stone', fragment: 'carved stone, weathered rock surface' },
  { id: 'mat-metal', label: 'Metal', group: 'material', keyword: 'metal', fragment: 'forged metal, brushed steel surface' },
  { id: 'mat-wood', label: 'Wood', group: 'material', keyword: 'wood', fragment: 'carved wood, natural wood grain' },
  { id: 'mat-fabric', label: 'Fabric', group: 'material', keyword: 'fabric', fragment: 'woven fabric, soft cloth folds' },
  { id: 'mat-leather', label: 'Leather', group: 'material', keyword: 'leather', fragment: 'tanned leather, worn hide texture' },
  { id: 'mat-glass', label: 'Glass', group: 'material', keyword: 'glass', fragment: 'translucent glass, clean reflections' },
  { id: 'mat-crystal', label: 'Crystal', group: 'material', keyword: 'crystal', fragment: 'faceted crystal, gemstone facets' },
  { id: 'mat-foliage', label: 'Foliage', group: 'material', keyword: 'foliage', fragment: 'lush foliage, organic leaves' },
];

const MOOD_CHIPS: PromptChip[] = [
  { id: 'mood-gritty', label: 'Gritty', group: 'mood', keyword: 'weathered', fragment: 'gritty, weathered, battle-worn' },
  { id: 'mood-polished', label: 'Polished', group: 'mood', keyword: 'polished', fragment: 'polished, glossy, pristine finish' },
  { id: 'mood-glowing', label: 'Glowing', group: 'mood', keyword: 'glow', fragment: 'glowing, luminous emissive accents' },
  { id: 'mood-rough', label: 'Rough', group: 'mood', keyword: 'rough', fragment: 'rough, matte, rugged surface' },
  { id: 'mood-magical', label: 'Magical', group: 'mood', keyword: 'magic', fragment: 'magical, arcane, enchanted aura' },
  { id: 'mood-stylized', label: 'Stylized', group: 'mood', keyword: 'stylized', fragment: 'stylized, hand-painted, clean forms' },
  { id: 'mood-realistic', label: 'Realistic', group: 'mood', keyword: 'realistic', fragment: 'realistic, photorealistic detail' },
];

const GAME_STYLE_CHIPS: PromptChip[] = [
  { id: 'game-dark-souls', label: 'Dark Souls', group: 'gameStyle', keyword: 'dark souls', fragment: 'Dark Souls grim dark-fantasy mood' },
  { id: 'game-elden-ring', label: 'Elden Ring', group: 'gameStyle', keyword: 'elden ring', fragment: 'Elden Ring epic dark-fantasy look' },
  { id: 'game-hades', label: 'Hades', group: 'gameStyle', keyword: 'hades', fragment: 'Hades bold stylized rim-lit look' },
  { id: 'game-hollow-knight', label: 'Hollow Knight', group: 'gameStyle', keyword: 'hollow knight', fragment: 'Hollow Knight hand-drawn muted palette' },
  { id: 'game-zelda', label: 'Zelda', group: 'gameStyle', keyword: 'zelda', fragment: 'Zelda cel-shaded painterly style' },
];

export const PROMPT_CHIP_GROUPS: PromptChipGroup[] = [
  { id: 'material', label: 'Material', hint: 'What is it made of?', chips: MATERIAL_CHIPS },
  { id: 'mood', label: 'Mood', hint: 'How should it feel?', chips: MOOD_CHIPS },
  { id: 'gameStyle', label: 'Game style', hint: 'Borrow a familiar look', chips: GAME_STYLE_CHIPS },
];

export const PROMPT_CHIPS: PromptChip[] = PROMPT_CHIP_GROUPS.flatMap((g) => g.chips);

const CHIP_BY_ID = new Map<string, PromptChip>(PROMPT_CHIPS.map((c) => [c.id, c]));

export function getChip(id: string): PromptChip | undefined {
  return CHIP_BY_ID.get(id);
}

/** Technical quality phrasing appended so users never type "game-ready PBR" etc. */
const QUALITY_SUFFIX = 'game-ready 3D asset, clean topology, PBR materials, neutral studio lighting, high detail';

export interface ComposePromptInput {
  /** Free-text "what is it" the user typed (optional). */
  subject?: string;
  /** Ids of the chips the user has toggled on. */
  chipIds?: string[];
  mode?: GenerationMode;
}

/**
 * Compose the final generation prompt from the user's subject + selected chips.
 * Pure: deterministic, no side effects — safe to call inside `useMemo`.
 * Returns `''` when there is nothing to generate from.
 */
export function composeVisualPrompt({ subject, chipIds = [] }: ComposePromptInput): string {
  const subj = (subject ?? '').trim();

  // Resolve + order chips by group so material → mood → style reads naturally.
  const chips = chipIds
    .map((id) => CHIP_BY_ID.get(id))
    .filter((c): c is PromptChip => c !== undefined);

  const fragments: string[] = [];
  for (const group of CHIP_GROUP_ORDER) {
    for (const chip of chips) {
      if (chip.group === group) fragments.push(chip.fragment);
    }
  }

  const parts: string[] = [];
  if (subj) parts.push(subj);
  parts.push(...fragments);

  if (parts.length === 0) return '';

  parts.push(QUALITY_SUFFIX);
  return parts.join(', ').replace(/\s+/g, ' ').trim();
}
