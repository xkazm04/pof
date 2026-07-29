'use client';

import { useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';

/**
 * The gameplay tags APP-authored ability specs reference (dotted dialect), from
 * `GET /api/ability-spec/tags`. They are the tag audit's third source — the
 * audit used to compare parsed UE5 source against itself and never saw a tag
 * the app authored, so an adopted forge row could not show up at all.
 *
 * One-shot fetch on mount (the specs change only when the user saves/adopts, and
 * both paths re-mount this tree); an error leaves the list empty rather than
 * inventing tags.
 */
export function useAbilitySpecTags(catalogId = 'spellbook'): string[] {
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const res = await tryApiFetch<string[]>(
        `/api/ability-spec/tags?catalogId=${encodeURIComponent(catalogId)}`,
      );
      if (cancelled || !res.ok || !Array.isArray(res.data)) return;
      setTags(res.data);
    };
    void run();
    return () => { cancelled = true; };
  }, [catalogId]);

  return tags;
}
