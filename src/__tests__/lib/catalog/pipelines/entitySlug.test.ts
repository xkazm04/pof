import { describe, it, expect, beforeAll } from 'vitest';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';

/**
 * A non-ASCII entity name sanitises to an EMPTY slug in the lossy form every pipeline used to
 * carry (`name.replace(/[^a-z0-9]+/gi, '')`), so its UE assets came out as bare prefixes
 * (`BP_`, `NS_`, `ACH_`) shared by every such entity.
 */
const NAME_A = '影の刃';
const NAME_B = '炎の剣';
/** An asset-style prefix with nothing after the underscore. */
const BARE_PREFIX = /(?:^|[^A-Za-z0-9])(?:[A-Z]{1,4})_(?=$|[^\p{L}\p{N}_])/gu;
/** Prose in the produced copy legitimately says "SC_ paths"; an ASCII control name cancels it. */
const ASCII_CONTROL = 'Zephyr';

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

function produceAll(name: string): { bare: number; assets: Set<string> } {
  let bare = 0;
  const assets = new Set<string>();
  for (const p of allCatalogPipelines()) {
    const entity = { id: `ent-${name}`, name, lifecycle: 'planned' as const, data: {} };
    for (const step of p.steps) {
      let out;
      try { out = step.produce(entity); } catch { continue; }
      (out.ueAssets ?? []).forEach((a) => assets.add(a));
      for (const s of strings(out.data).concat(out.ueAssets ?? [])) {
        bare += s.match(BARE_PREFIX)?.length ?? 0;
      }
    }
  }
  return { bare, assets };
}

describe('asset slugs survive a name with no ASCII letters', () => {
  beforeAll(async () => { await import('@/lib/catalog/pipelines/registry.generated'); });

  it('emits no bare-prefix asset token beyond the ASCII control prose', () => {
    const control = produceAll(ASCII_CONTROL).bare;
    const { bare } = produceAll(NAME_A);
    expect(bare - control).toBe(0);
  });

  it('two distinct non-ASCII names never share a UE asset path', () => {
    const overlap = (x: string, y: string) => {
      const b = produceAll(y).assets;
      return [...produceAll(x).assets].filter((p) => b.has(p));
    };
    // Entity-independent paths are shared by ASCII names too; only the excess is a slug collision.
    const baseline = new Set(overlap('Zephyr', 'Quill'));
    const collisions = overlap(NAME_A, NAME_B).filter((p) => !baseline.has(p));
    expect(collisions).toEqual([]);
  });
});
