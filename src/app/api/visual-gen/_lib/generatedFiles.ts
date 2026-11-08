import { stat } from 'node:fs/promises';

/**
 * Server-only helpers the generated-file routes share. They sit here, not in
 * `@/lib/visual-gen/generated-assets`, because that module is also imported by client
 * components and must stay free of `node:fs`.
 */

/** The directory's own mtime — the stamp the listing cache revalidates against. `null` = no dir. */
export async function dirStamp(dir: string): Promise<number | null> {
  try {
    return (await stat(dir)).mtimeMs;
  } catch {
    return null;
  }
}

/** Content types of the generated 2D images served by `/icon/:name` and `/image/:name`. */
export const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
