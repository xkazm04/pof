/**
 * CLI prompt for the Catalog "Create with AI Image" action.
 *
 * Describes /api/leonardo as it actually behaves: the CLI needs an ABSOLUTE url
 * (it is not a browser), the response is the `{ success, data }` envelope, and the
 * bytes arrive as `data.imageBase64` — the route downloads the image and deletes
 * the Leonardo generation before it answers, so `data.imageUrl` is already dead.
 * The request body is JSON.stringify'd so quotes/newlines in item text stay valid.
 */
/** Leonardo's prompt ceiling (MAX_PROMPT_LENGTH in the server-only @/lib/leonardo; the route 400s above it). */
const MAX_PROMPT_LENGTH = 1500;

/**
 * File/entity slug for a created item: the readable name part (never empty - "item" when the
 * name is only symbols) plus the item's unique suffix, so two same-named items own two icon files.
 */
export function itemSlug(name: string, uniqueSuffix: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';
  return `${base}-${uniqueSuffix}`;
}

export interface CreateItemPromptInput {
  name: string;
  type: string;
  rarity: string;
  description: string;
}

export function buildCreateItemPrompt(item: CreateItemPromptInput, slug: string, origin: string): string {
  const imagePrompt = `Game item icon, ${item.rarity} ${item.type}, ${item.name}, ${item.description}, dark fantasy ARPG style, centered on black background, high detail`
    .slice(0, MAX_PROMPT_LENGTH);
  const body = JSON.stringify({ mode: 'image', prompt: imagePrompt });
  return [
    'Create a new item for the ARPG loot system:',
    `Name: ${item.name}`,
    `Type: ${item.type}`,
    `Rarity: ${item.rarity}`,
    `Description: ${item.description}`,
    '',
    'Steps:',
    `1. POST ${origin}/api/leonardo with Content-Type: application/json and exactly this body:`,
    body,
    '2. The response is { success, data }. On success:false, stop and report its error text.',
    '3. Decode data.imageBase64 (the only copy: the Leonardo generation is already deleted, so do NOT fetch data.imageUrl)',
    `   and write it to public/items/${slug}.webp, converting to WebP (e.g. with sharp) if the bytes are PNG/JPEG.`,
    '4. Confirm the item was created with its image path.',
    '',
    `Item slug: ${slug}`,
  ].join('\n');
}
