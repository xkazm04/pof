/**
 * The drop-in that replaces a NAMED VENDOR at a call site.
 *
 * PoF's gates take an injectable vision seam, `(images, prompt) => Promise<VisionAnswer>`,
 * and every one of them used to default to `makeQwenVision()` — a call site naming a vendor,
 * which is exactly what the chokepoint exists to remove. `makeRoutedVision()` has the same
 * shape, so the migration at each gate was one line:
 *
 *     const vision = deps.vision ?? makeQwenVision();   // before: names a vendor
 *     const vision = deps.vision ?? makeRoutedVision(); // after:  names a capability
 *
 * After that, which eye serves is `router.ts`'s PLAN table and nothing else.
 *
 * The routed answer's `provider` and `trail` are dropped here, because the legacy seam's
 * return type has no room for them — the gates that want provenance should call
 * `recognize()` directly. That is a deliberate, stated loss at the compatibility boundary,
 * not an oversight: it keeps the migration to one line per gate, and the trail still
 * reaches anyone whose whole chain failed, through the thrown error.
 */
import type { VisionAnswer } from '@/lib/anim-critique/vision';
import type { VisionImage } from '@/lib/anim-critique/critique';
import { recognize, type RecognizeOptions } from './router';
import { defaultProviders } from './providers';

export function makeRoutedVision(opts: RecognizeOptions = {}) {
  return async (images: VisionImage[], prompt: string): Promise<VisionAnswer> => {
    const routed = await recognize(
      { images, prompt },
      { providers: opts.providers ?? defaultProviders(), ...opts },
    );
    return {
      text: routed.text,
      model: routed.model,
      attribution: routed.attribution,
      fellBackFrom: routed.fellBackFrom,
    };
  };
}

/**
 * The TEXT-ONLY drop-in, matching `makeQwenVision()`'s `Promise<string>` shape — which is
 * what the six visual-gen gates declare. Same one-line migration, same routing.
 */
export function makeRoutedVisionText(opts: RecognizeOptions = {}) {
  const attributed = makeRoutedVision(opts);
  return async (images: VisionImage[], prompt: string): Promise<string> =>
    (await attributed(images, prompt)).text;
}
