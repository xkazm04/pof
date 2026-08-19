/**
 * The pure half of `generated-images-cacheable`: the validator, the `If-None-Match`
 * parser, and the in-process directory-listing cache's freshness rule.
 *
 * These are forced-failure tests for the two claims the policy makes in prose:
 *  - an etag derived from size+mtime MOVES when a file is overwritten in place, so a
 *    mutable path (every gap-loop icon is one — the filename is `iconSlug(catalog, step)`)
 *    can never be masked by a stored response;
 *  - the listing cache only ever serves an entry whose DIRECTORY stamp still matches and
 *    whose age is under the TTL, so an out-of-process file add/remove is visible on the
 *    very next request rather than after the TTL.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  GENERATED_FILE_CACHE_CONTROL,
  LISTING_TTL_MS,
  etagMatches,
  fileEtag,
  invalidateListingCache,
  readListingCache,
  writeListingCache,
} from '@/lib/visual-gen/generated-assets';

describe('GENERATED_FILE_CACHE_CONTROL — cacheable, but never immutable', () => {
  it('is store-and-revalidate, NOT the old no-store', () => {
    expect(GENERATED_FILE_CACHE_CONTROL).toContain('no-cache');
    expect(GENERATED_FILE_CACHE_CONTROL).not.toContain('no-store');
  });

  it('never claims immutability or a long max-age (generated filenames are reused in place)', () => {
    expect(GENERATED_FILE_CACHE_CONTROL).not.toContain('immutable');
    expect(GENERATED_FILE_CACHE_CONTROL).not.toMatch(/max-age=[1-9]/);
  });
});

describe('fileEtag', () => {
  it('changes when the bytes change under the SAME filename (size differs)', () => {
    expect(fileEtag(1024, 1_700_000_000_000)).not.toBe(fileEtag(2048, 1_700_000_000_000));
  });

  it('changes when a same-size file is rewritten (mtime differs)', () => {
    expect(fileEtag(1024, 1_700_000_000_000)).not.toBe(fileEtag(1024, 1_700_000_000_001));
  });

  it('is stable for an untouched file, and a quoted opaque token', () => {
    const tag = fileEtag(1024, 1_700_000_000_000);
    expect(tag).toBe(fileEtag(1024, 1_700_000_000_000));
    expect(tag.startsWith('"') && tag.endsWith('"')).toBe(true);
  });
});

describe('etagMatches', () => {
  const tag = fileEtag(10, 20);

  it('matches an exact echo', () => expect(etagMatches(tag, tag)).toBe(true));
  it('matches a weak echo of the same tag', () => expect(etagMatches(`W/${tag}`, tag)).toBe(true));
  it('matches inside a comma list', () => expect(etagMatches(`"other", ${tag}`, tag)).toBe(true));
  it('matches `*`', () => expect(etagMatches('*', tag)).toBe(true));
  it('does NOT match a different tag', () => expect(etagMatches(fileEtag(11, 20), tag)).toBe(false));
  it('does NOT match when the header is absent', () => {
    expect(etagMatches(null, tag)).toBe(false);
    expect(etagMatches(undefined, tag)).toBe(false);
    expect(etagMatches('', tag)).toBe(false);
  });
});

describe('listing cache freshness', () => {
  const KEY = 'test-listing';
  beforeEach(() => invalidateListingCache());

  it('serves a warm entry while the dir stamp matches and the TTL has not elapsed', () => {
    writeListingCache(KEY, ['a'], 100, 0);
    expect(readListingCache<string[]>(KEY, 100, LISTING_TTL_MS - 1)).toEqual(['a']);
  });

  it('MISSES the instant the directory stamp moves — an out-of-process add is not hidden for the TTL', () => {
    writeListingCache(KEY, ['a'], 100, 0);
    // A gap-loop script wrote a new icon: the dir mtime bumped, so the entry is stale
    // even though it is milliseconds old.
    expect(readListingCache<string[]>(KEY, 101, 1)).toBeUndefined();
  });

  it('MISSES once the TTL has elapsed, even with an unchanged stamp (in-place overwrites)', () => {
    writeListingCache(KEY, ['a'], 100, 0);
    expect(readListingCache<string[]>(KEY, 100, LISTING_TTL_MS)).toBeUndefined();
  });

  it('is bounded: the TTL is short enough to be an honest freshness claim', () => {
    expect(LISTING_TTL_MS).toBeGreaterThan(0);
    expect(LISTING_TTL_MS).toBeLessThanOrEqual(10_000);
  });

  it('never caches (or serves) a listing whose dir could not be stat-ed', () => {
    writeListingCache(KEY, ['a'], null, 0);
    expect(readListingCache<string[]>(KEY, null, 1)).toBeUndefined();
    writeListingCache(KEY, ['a'], 100, 0);
    expect(readListingCache<string[]>(KEY, null, 1)).toBeUndefined();
  });

  it('keys are independent — one dir warming does not answer for another', () => {
    writeListingCache('assets:tripo3d', ['x'], 7, 0);
    expect(readListingCache<string[]>('assets:meshes', 7, 1)).toBeUndefined();
    expect(readListingCache<string[]>('assets:tripo3d', 7, 1)).toEqual(['x']);
  });

  it('invalidateListingCache drops one key, or all of them', () => {
    writeListingCache('a', [1], 1, 0);
    writeListingCache('b', [2], 1, 0);
    invalidateListingCache('a');
    expect(readListingCache('a', 1, 1)).toBeUndefined();
    expect(readListingCache('b', 1, 1)).toEqual([2]);
    invalidateListingCache();
    expect(readListingCache('b', 1, 1)).toBeUndefined();
  });
});
