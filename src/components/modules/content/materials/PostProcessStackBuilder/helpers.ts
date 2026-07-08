import { DEFAULT_EFFECTS } from '@/lib/post-process-studio/effects';
import type { PPStudioEffect } from '@/types/post-process-studio';

/** Deep-clone DEFAULT_EFFECTS so local edits never mutate the shared source. */
export function cloneDefaultEffects(): PPStudioEffect[] {
  return DEFAULT_EFFECTS.map((e) => ({
    ...e,
    params: e.params.map((p) => ({ ...p })),
  }));
}
