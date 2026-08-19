/**
 * `generated/` is ~1 GB with no prune, cap or LRU anywhere. Phase 1 measures it —
 * and the whole value of the measurement is that it does not overstate.
 *
 * The two claims this suite exists to hold:
 *   1. a file a scanned referrer names is `referenced`;
 *   2. a file whose referrer scan did NOT complete is `unknown` — never `unreferenced`,
 *      and never a prune candidate.
 *
 * RED before this change: none of this existed; the only measurement of the tree
 * was `du`, which cannot tell a served asset from dead weight.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  categorize,
  attemptIndex,
  summarize,
  summarizeClasses,
  summarizeGroups,
  isEnumerable,
  classify,
  classifyTree,
  sidecarOwnerPath,
  referencedNames,
  prunePlan,
  allPrunePlans,
  PRUNE_POLICIES,
  type TreeFile,
  type ReferenceIndex,
  type PruneContext,
} from '@/lib/visual-gen/generated-tree';

const file = (path: string, sizeBytes = 1000, mtimeMs = 1_700_000_000_000): TreeFile => ({
  path,
  sizeBytes,
  mtimeMs,
});

/** A complete scan that found exactly `names`. */
function refs(names: string[], failed: string[] = []): ReferenceIndex {
  return {
    names: new Set(names),
    sources: new Map(names.map((n) => [n, ['pipeline_artifacts']])),
    scanned: ['pipeline_artifacts', 'repo-source'],
    failed,
  };
}

const ctx = (present: Set<string>, now = 1_800_000_000_000): PruneContext => ({
  now,
  staleDays: 30,
  present,
});

describe('categorize', () => {
  it('buckets by kind, with attempts and previews separated from plain meshes', () => {
    expect(categorize(file('tripo3d/fixture_rig.glb')).bucket).toBe('mesh');
    expect(categorize(file('triposr/fixture_bestof.preview.png')).bucket).toBe('preview');
    expect(categorize(file('tripo3d/hero_a2.glb')).bucket).toBe('attempt');
    expect(categorize(file('tripo3d/hero_a2.preview.png')).bucket).toBe('attempt');
    expect(categorize(file('icons/fixture_props_icon.jpg')).bucket).toBe('image');
    expect(categorize(file('packages/items/item-1/manifest.json')).bucket).toBe('metadata');
    expect(categorize(file('icons/_unaddressable/fixture_unaddr.jpg')).bucket).toBe('unaddressable');
  });

  it('names the provider dir as the group', () => {
    expect(categorize(file('packages/items/item-1/icon-0.jpg')).group).toBe('packages');
    expect(categorize(file('loose.png')).group).toBe('(root)');
  });

  it('reads the retry index only above 1 — a first attempt is not a retry', () => {
    expect(attemptIndex('hero_a2.glb')).toBe(2);
    expect(attemptIndex('hero_a3.preview.png')).toBe(3);
    expect(attemptIndex('hero_a1.glb')).toBeUndefined();
    expect(attemptIndex('hero.glb')).toBeUndefined();
  });
});

describe('summarize', () => {
  it('totals per (group, bucket), largest first', () => {
    const out = summarize([
      categorize(file('tripo3d/a.glb', 500)),
      categorize(file('tripo3d/b.glb', 1500)),
      categorize(file('icons/c.jpg', 100)),
    ]);
    expect(out.count).toBe(3);
    expect(out.bytes).toBe(2100);
    expect(out.rows[0]).toEqual({ key: 'tripo3d/mesh', group: 'tripo3d', bucket: 'mesh', count: 2, bytes: 2000 });
  });
});

describe('isEnumerable — exactly what the serving routes list', () => {
  const present = new Set(['tripo3d/a.glb', 'tripo3d/a.preview.png', 'triposr/b.preview.png']);

  it('lists a top-level .glb in an allow-listed dir', () => {
    expect(isEnumerable(categorize(file('tripo3d/a.glb')), present)).toBe(true);
  });

  it('lists a preview only when its .glb exists', () => {
    expect(isEnumerable(categorize(file('tripo3d/a.preview.png')), present)).toBe(true);
    expect(isEnumerable(categorize(file('triposr/b.preview.png')), present)).toBe(false);
  });

  it('does not list a dir no route allows, nor a nested file', () => {
    expect(isEnumerable(categorize(file('anim/fixture_alpha.glb')), present)).toBe(false);
    expect(isEnumerable(categorize(file('icons/_unaddressable/x.jpg')), present)).toBe(false);
    expect(isEnumerable(categorize(file('icons/fixture_props_icon.jpg')), present)).toBe(true);
  });

  it('does not list an .fbx — the 3D listing reads .glb only', () => {
    expect(isEnumerable(categorize(file('tripo3d/fixture_rig.fbx')), present)).toBe(false);
  });
});

describe('classify', () => {
  const present = new Set(['tripo3d/a.glb', 'anim/fixture_alpha.glb']);

  it('calls a file a scanned referrer names REFERENCED, and says which referrer', () => {
    const out = classify(categorize(file('anim/fixture_alpha.glb')), refs(['fixture_alpha.glb']), present);
    expect(out.refClass).toBe('referenced');
    expect(out.why).toContain('pipeline_artifacts');
  });

  it('calls an unnamed but route-enumerable file REACHABLE, not orphaned', () => {
    const out = classify(categorize(file('tripo3d/a.glb')), refs([]), present);
    expect(out.refClass).toBe('reachable');
  });

  it('only calls a file UNREFERENCED when the scan was complete and found nothing', () => {
    const out = classify(categorize(file('anim/fixture_alpha.glb')), refs([]), present);
    expect(out.refClass).toBe('unreferenced');
    expect(out.why).toContain('pipeline_artifacts');
  });

  it('downgrades to UNKNOWN — never orphaned — when a referrer channel failed', () => {
    const partial = refs([], ['sqlite-all-tables: database is locked']);
    const out = classify(categorize(file('anim/fixture_alpha.glb')), partial, present);

    expect(out.refClass).toBe('unknown');
    expect(out.refClass).not.toBe('unreferenced');
    expect(out.why).toContain('sqlite-all-tables');
  });

  it('still proves a POSITIVE reference from a partial scan', () => {
    // A partial scan can prove a file IS referenced; it can never prove it is not.
    const partial = refs(['fixture_alpha.glb'], ['repo-source: EACCES']);
    expect(classify(categorize(file('anim/fixture_alpha.glb')), partial, present).refClass).toBe('referenced');
  });
});

describe('sidecars are never deader than what they belong to', () => {
  it('maps a preview to its mesh and an .fbm texture to its .fbx', () => {
    expect(sidecarOwnerPath('saber/fixture_hilt.preview.png')).toBe('saber/fixture_hilt.glb');
    expect(sidecarOwnerPath('tripo3d/fixture_rig.fbm/Color_1.jpg')).toBe('tripo3d/fixture_rig.fbx');
    expect(sidecarOwnerPath('tripo3d/fixture_rig.glb')).toBeNull();
  });

  it('inherits the owner class, so a live mesh cannot have a dead thumbnail', () => {
    const present = new Set(['saber/fixture_hilt.glb', 'saber/fixture_hilt.preview.png']);
    const files = [file('saber/fixture_hilt.glb'), file('saber/fixture_hilt.preview.png')].map(categorize);

    const out = classifyTree(files, refs(['fixture_hilt.glb']), present);

    expect(out.find((f) => f.path.endsWith('.preview.png'))!.refClass).toBe('referenced');
  });

  it('does not invent an upgrade when the owner is itself unreferenced', () => {
    const present = new Set(['tripo3d/fixture_rig.fbx', 'tripo3d/fixture_rig.fbm/Color_1.jpg']);
    const files = [file('tripo3d/fixture_rig.fbx'), file('tripo3d/fixture_rig.fbm/Color_1.jpg')].map(categorize);

    const out = classifyTree(files, refs([]), present);

    expect(out.every((f) => f.refClass === 'unreferenced')).toBe(true);
  });
});

describe('referencedNames', () => {
  const onDisk = new Set(['fixture_vael.glb', 'fixture_icon.jpg']);

  it('matches only names that are actually on disk', () => {
    const text = 'url: /api/visual-gen/asset/fixture_vael.glb and some_other.glb';
    expect(referencedNames(text, onDisk)).toEqual(['fixture_vael.glb']);
  });

  it('decodes the percent-encoding artifact URLs are stored with', () => {
    expect(referencedNames('/api/visual-gen/icon/fixture_icon.jpg', onDisk)).toContain('fixture_icon.jpg');
    expect(referencedNames('%2Ffixture_icon.jpg', onDisk)).toContain('fixture_icon.jpg');
  });

  it('survives a lone percent sign rather than dropping the row', () => {
    expect(referencedNames('100% of fixture_vael.glb', onDisk)).toEqual(['fixture_vael.glb']);
  });
});

describe('summarizeGroups', () => {
  it('flags a dir where NOTHING is referenced as a missing referrer channel', () => {
    const present = new Set(['anim/a.glb', 'tripo3d/b.glb']);
    const out = summarizeGroups(
      classifyTree([file('anim/a.glb', 10), file('tripo3d/b.glb', 20)].map(categorize), refs([]), present),
    );

    expect(out.find((g) => g.group === 'anim')!.wholeGroupUnreferenced).toBe(true);
    expect(out.find((g) => g.group === 'tripo3d')!.wholeGroupUnreferenced).toBe(false);
  });
});

describe('dry-run prune plans', () => {
  const present = new Set(['tripo3d/a.glb', 'anim/dead.glb', 'anim/live.glb', 'triposr/lost.preview.png']);
  const files = [
    file('tripo3d/a.glb', 100),
    file('anim/dead.glb', 200),
    file('anim/live.glb', 400),
    file('triposr/lost.preview.png', 50),
    file('tripo3d/hero_a2.glb', 800),
  ].map(categorize);
  const classified = classifyTree(files, refs(['live.glb']), present);

  it('never selects a live file, except the one policy that declares it does', () => {
    for (const plan of allPrunePlans(classified, ctx(present))) {
      const policy = PRUNE_POLICIES.find((p) => p.id === plan.policy)!;
      if (policy.pricesLiveFiles) continue;
      for (const f of plan.files) expect(f.refClass).toBe('unreferenced');
      expect(plan.liveSelected).toBe(0);
    }
  });

  it('prices the unreferenced set with real byte totals', () => {
    const plan = prunePlan(PRUNE_POLICIES.find((p) => p.id === 'unreferenced')!, classified, ctx(present));
    // dead.glb (200) + lost.preview.png (50). a.glb and live.glb survive, and so does
    // hero_a2.glb — a top-level attempt in an allow-listed dir is REACHABLE, not dead.
    expect(plan.files.map((f) => f.path).sort()).toEqual(['anim/dead.glb', 'triposr/lost.preview.png']);
    expect(plan.count).toBe(2);
    expect(plan.bytes).toBe(250);
  });

  it('respects the age threshold rather than pretending mtime is irrelevant', () => {
    const stale = PRUNE_POLICIES.find((p) => p.id === 'stale-unreferenced')!;
    const justNow = { ...ctx(present), now: 1_700_000_000_000 };
    expect(prunePlan(stale, classified, justNow).count).toBe(0);
    expect(prunePlan(stale, classified, ctx(present)).count).toBe(2);
  });

  it('counts the live files a live-pricing policy selected, instead of hiding them in the total', () => {
    const plan = prunePlan(PRUNE_POLICIES.find((p) => p.id === 'retry-attempts')!, classified, ctx(present));
    expect(plan.files.map((f) => f.path)).toEqual(['tripo3d/hero_a2.glb']);
    expect(plan.liveSelected).toBe(1);
  });

  it('selects a preview whose mesh is gone, and no preview whose mesh is present', () => {
    const plan = prunePlan(PRUNE_POLICIES.find((p) => p.id === 'orphan-previews')!, classified, ctx(present));
    expect(plan.files.map((f) => f.path)).toEqual(['triposr/lost.preview.png']);
  });

  it('states that the retry-attempt policy needs adjudication, never claiming attempts are rejects', () => {
    const retry = PRUNE_POLICIES.find((p) => p.id === 'retry-attempts')!;
    expect(retry.caveat).toMatch(/ADJUDICATION/);
    expect(retry.caveat).toMatch(/delivered mesh/i);
  });

  it('gives every policy a caveat — phase 1 prices options, it does not choose one', () => {
    for (const p of PRUNE_POLICIES) expect(p.caveat.length).toBeGreaterThan(40);
  });
});

describe('summarizeClasses', () => {
  it('reports all four classes in ladder order, including empty ones', () => {
    const out = summarizeClasses(classifyTree([file('tripo3d/a.glb', 7)].map(categorize), refs([]), new Set()));
    expect(out.map((c) => c.refClass)).toEqual(['referenced', 'reachable', 'unknown', 'unreferenced']);
    expect(out.find((c) => c.refClass === 'unknown')!.count).toBe(0);
  });
});

describe('this module cannot delete anything', () => {
  it('has no filesystem access at all — the plan is priced, never executed', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/visual-gen/generated-tree.ts'), 'utf8');
    for (const forbidden of ['node:fs', "from 'fs'", 'unlinkSync', 'unlink(', 'rmSync', 'rm(', 'rmdir']) {
      expect(src.includes(forbidden)).toBe(false);
    }
  });
});
