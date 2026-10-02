import { ok, err, type Result } from '@/types/result';
import { useNavigationStore } from '@/stores/navigationStore';
import { useForgeStore, type ForgeReference, type GenerationMode } from './useForgeStore';

/**
 * The forge's 2D -> 3D handoff: "Make 3D from this image" on a 2D result.
 *
 * It is FREE by construction: one GET of the file our own route already serves
 * (`/api/visual-gen/image/:name`), a store write, and a tab switch through the navigation
 * store's per-module door. Nothing paid runs here; the Generate button stays the one
 * paid click, and the Tier-0 input gate still checks the image server-side on that POST.
 * Fetch and navigation are injected so the handoff is testable without a browser.
 */

export interface HandoffDeps {
  fetchFn?: typeof fetch;
  /** Opens the forge's Generate tab. Default: the navigation store's per-module tab door. */
  navigate?: () => void;
}

const openForgeGenerateTab = () => useNavigationStore.getState().setModuleTab('asset-forge', 'generate');

/** Base64 of raw bytes, chunked so a large image never overflows the call stack. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** The route's own refusal sentence from an `{ success: false, error }` envelope, if any. */
async function refusalOf(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body?.error === 'string' && body.error) return body.error;
  } catch { /* not an envelope */ }
  return `the image could not be read (HTTP ${res.status})`;
}

/**
 * Re-read a served image as a `data:` URL the generate route can decode. An error answer
 * is an err carrying the route's reason; a non-image answer is an err naming its type.
 */
export async function imageUrlToDataUrl(
  url: string,
  fetchFn: typeof fetch = (input, init) => fetch(input, init),
): Promise<Result<string, string>> {
  let res: Response;
  try {
    res = await fetchFn(url);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Network error');
  }
  if (!res.ok) return err(await refusalOf(res));
  const type = (res.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  if (!type.startsWith('image/')) return err(`expected an image, the server answered ${type || 'no content type'}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return ok(`data:${type};base64,${toBase64(bytes)}`);
}

/**
 * Stage a 2D result as the image-to-3D reference (its prompt becomes the subject), then
 * open the Generate tab. A failed read stages nothing and navigates nowhere.
 */
export async function stageImage2DForMesh(
  result: { url: string; name: string },
  prompt: string,
  deps: HandoffDeps = {},
): Promise<Result<ForgeReference, string>> {
  const read = await imageUrlToDataUrl(result.url, deps.fetchFn);
  if (!read.ok) return read;
  const subject = prompt.trim();
  const reference: ForgeReference = {
    dataUrl: read.data,
    source: 'image-2d',
    sourceName: result.name,
    ...(subject ? { subject } : {}),
  };
  useForgeStore.getState().stageReference(reference);
  (deps.navigate ?? openForgeGenerateTab)();
  return ok(reference);
}

/** The mode the Generate tab opens in: a staged reference means image-to-3D. */
export function initialForgeMode(reference: ForgeReference | null): GenerationMode {
  return reference ? 'image-to-3d' : 'text-to-3d';
}
