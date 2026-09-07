/**
 * Scene decomposition — one scene image → the prop list `generateComposition` consumes.
 *
 * PoF has the placer and not the planner: `generateComposition` takes `assets` as INPUT
 * and, at HEAD~1, nothing in `src/` outside its own file imported it (the only other
 * match was a *string* inside a `ue-gotchas.ts` entry). This is the producer half, with
 * an IMAGE as the input modality rather than a sentence.
 *
 * Everything here is pure or runs over the injected vision seam
 * (`(images, prompt) => Promise<string>`, the shape `input-gate.ts` established) — no
 * live VLM call happens in this suite.
 */
import { describe, it, expect } from 'vitest';
import {
  buildSceneDecomposePrompt,
  parseSceneDecomposeReply,
  toCompositionAssets,
  decomposeScene,
  type DecomposedProp,
} from '@/lib/visual-gen/generators/scene-decompose';

/** A realistic reply: chatty preamble, a fence, one malformed row, varied spacing. */
const REPLY = [
  'Here are the props I can see:',
  '```',
  'PROP=wooden barrel; BOX=0.10,0.55,0.26,0.92; SIZE_CM=90; COUNT=2; MATERIAL=wood',
  'PROP=trading post table; BOX=0.30,0.48,0.72,0.86; SIZE_CM=170; COUNT=1; MATERIAL=wood',
  'PROP=clay bottle ; BOX=0.44,0.40,0.49,0.50 ; SIZE_CM=28 ; COUNT=3 ; MATERIAL=glass',
  'this row is prose and should be skipped',
  'PROP=hanging lantern; BOX=0.80,0.10,0.88,0.24; SIZE_CM=35; COUNT=1; MATERIAL=metal',
  '```',
].join('\n');

describe('buildSceneDecomposePrompt', () => {
  it('asks for the one-line-per-prop protocol with a normalized box', () => {
    const p = buildSceneDecomposePrompt();
    expect(p).toContain('PROP=');
    expect(p).toContain('BOX=');
    expect(p).toContain('SIZE_CM=');
    expect(p).toContain('COUNT=');
    expect(p.toLowerCase()).toContain('normalized');
  });

  it('asks for the material so the physical contract is not always the default', () => {
    expect(buildSceneDecomposePrompt()).toContain('MATERIAL=');
    expect(buildSceneDecomposePrompt()).toContain('wood');
  });

  it('carries the scene hint when one is given', () => {
    expect(buildSceneDecomposePrompt('a desert trading post')).toContain('a desert trading post');
  });

  it('excludes the things that are not extractable props', () => {
    const p = buildSceneDecomposePrompt().toLowerCase();
    // Ground/sky/walls are background, not props — asking for them poisons the list.
    expect(p).toContain('ground');
    expect(p).toContain('sky');
  });

  it('excludes architecture and vegetation, which a live run wrongly returned as props', () => {
    // Observed against generated/packages/combat-map/arena-ravaged-courtyard: the reply
    // listed "stairs" and "bush", and the solver then stacked the bush on the stairs.
    const p = buildSceneDecomposePrompt().toLowerCase();
    expect(p).toContain('stairs');
    expect(p).toContain('bushes');
    // An empty list must be an acceptable answer, or the model reclassifies scenery to comply.
    expect(p).toMatch(/no rows at all/i);
  });
});

describe('parseSceneDecomposeReply', () => {
  it('extracts every well-formed prop row and skips prose', () => {
    const r = parseSceneDecomposeReply(REPLY);
    expect(r.ok).toBe(true);
    expect(r.props.map((p) => p.name)).toEqual([
      'wooden barrel',
      'trading post table',
      'clay bottle',
      'hanging lantern',
    ]);
    // Prose is not counted as skipped: `skipped` means "looked like a prop row and failed
    // validation", which is the number worth surfacing. A chatty preamble is not a defect.
    expect(r.skipped).toBe(0);
  });

  it('reads the normalized box and the count', () => {
    const [barrel] = parseSceneDecomposeReply(REPLY).props;
    expect(barrel.box).toEqual({ x0: 0.1, y0: 0.55, x1: 0.26, y1: 0.92 });
    expect(barrel.count).toBe(2);
    expect(barrel.longestCm).toBe(90);
    expect(barrel.material).toBe('wood');
  });

  it('falls back to the default material when the row omits MATERIAL', () => {
    // Older/terser replies drop the field; a missing material must not lose the whole row.
    const r = parseSceneDecomposeReply('PROP=crate; BOX=0,0,0.2,0.3; SIZE_CM=60; COUNT=1');
    expect(r.props).toHaveLength(1);
    expect(r.props[0].material).toBe('default');
  });

  it('maps an unknown material onto the default instead of inventing a density', () => {
    const r = parseSceneDecomposeReply(
      'PROP=orb; BOX=0,0,0.2,0.3; SIZE_CM=60; COUNT=1; MATERIAL=unobtanium',
    );
    expect(r.props[0].material).toBe('default');
  });

  it('accepts a material the VLM spells with different case or plural', () => {
    const r = parseSceneDecomposeReply(
      'PROP=slab; BOX=0,0,0.2,0.3; SIZE_CM=60; COUNT=1; MATERIAL=Stone\n' +
        'PROP=planks; BOX=0,0,0.2,0.3; SIZE_CM=60; COUNT=1; MATERIAL=woods',
    );
    expect(r.props.map((p) => p.material)).toEqual(['stone', 'wood']);
  });

  it('does not depluralize a material whose own name ends in s', () => {
    // 'glass' -> 'glas' was a real regression: exact match must win over depluralizing.
    const r = parseSceneDecomposeReply(
      'PROP=bottle; BOX=0,0,0.2,0.3; SIZE_CM=30; COUNT=1; MATERIAL=glass',
    );
    expect(r.props[0].material).toBe('glass');
  });

  it('slugs a stable id per prop', () => {
    const ids = parseSceneDecomposeReply(REPLY).props.map((p) => p.id);
    expect(ids).toEqual(['wooden-barrel', 'trading-post-table', 'clay-bottle', 'hanging-lantern']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('de-duplicates a repeated name rather than emitting a colliding id', () => {
    const r = parseSceneDecomposeReply(
      'PROP=barrel; BOX=0,0,0.1,0.1; SIZE_CM=90; COUNT=1\n' +
        'PROP=barrel; BOX=0.2,0.2,0.3,0.3; SIZE_CM=90; COUNT=1',
    );
    expect(r.props.map((p) => p.id)).toEqual(['barrel', 'barrel-2']);
  });

  it('rejects a box outside 0..1 or inverted instead of trusting it', () => {
    const r = parseSceneDecomposeReply(
      'PROP=bad; BOX=0.5,0.5,0.2,0.9; SIZE_CM=50; COUNT=1\n' +
        'PROP=oob; BOX=0.1,0.1,1.4,0.5; SIZE_CM=50; COUNT=1',
    );
    expect(r.props).toEqual([]);
    expect(r.skipped).toBe(2);
  });

  it('clamps an absurd count and a non-positive size instead of propagating them', () => {
    const r = parseSceneDecomposeReply(
      'PROP=swarm; BOX=0,0,0.2,0.2; SIZE_CM=0; COUNT=999',
    );
    expect(r.props).toEqual([]);
    expect(r.skipped).toBe(1);
  });

  it('reports ok:false with a reason when nothing parsed at all', () => {
    const r = parseSceneDecomposeReply('I cannot see any objects in this image.');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no prop rows/i);
    // It RAN — an empty scene is an answer, not an outage.
    expect(r.ran).toBe(true);
  });
});

describe('toCompositionAssets', () => {
  const props: DecomposedProp[] = parseSceneDecomposeReply(REPLY).props;

  it('produces one CompositionAsset per prop with copies from COUNT', () => {
    const assets = toCompositionAssets(props);
    expect(assets).toHaveLength(4);
    expect(assets[0].id).toBe('wooden-barrel');
    expect(assets[0].affordance?.copies).toBe(2);
  });

  it('derives cm extents whose longest axis is the estimated longest dimension', () => {
    const [barrel] = toCompositionAssets(props);
    expect(Math.max(...barrel.size)).toBeCloseTo(90, 5);
  });

  it('uses the box aspect ratio for the width/height split', () => {
    // table box is 0.42 wide x 0.14 tall → wide and low, so x must exceed z.
    const table = toCompositionAssets(props).find((a) => a.id === 'trading-post-table')!;
    expect(table.size[0]).toBeGreaterThan(table.size[2]);
    // barrel box is 0.16 x 0.37 → tall and narrow, so z must exceed x.
    const barrel = toCompositionAssets(props).find((a) => a.id === 'wooden-barrel')!;
    expect(barrel.size[2]).toBeGreaterThan(barrel.size[0]);
  });

  it('assigns size-class affordances so the solver knows what carries what', () => {
    const assets = toCompositionAssets(props);
    const table = assets.find((a) => a.id === 'trading-post-table')!;
    const bottle = assets.find((a) => a.id === 'clay-bottle')!;
    // A 170cm table is a large prop: floor-only and load-bearing.
    expect(table.affordance?.place).toBe('floor');
    expect(table.affordance?.stackable).toBe(true);
    // A 28cm bottle is small clutter: nothing balances on it.
    expect(bottle.affordance?.stackable).toBe(false);
  });

  it('keeps the VLM COUNT rather than the size-class default copies', () => {
    const bottle = toCompositionAssets(props).find((a) => a.id === 'clay-bottle')!;
    expect(bottle.affordance?.copies).toBe(3);
    const lantern = toCompositionAssets(props).find((a) => a.id === 'hanging-lantern')!;
    expect(lantern.affordance?.copies).toBe(1);
  });
});

describe('decomposeScene', () => {
  const image = { mime: 'image/png', base64: 'AAAA' };

  it('runs the prompt over the injected vision seam and returns parsed props', async () => {
    const seen: string[] = [];
    const r = await decomposeScene(image, {
      vision: async (_imgs, prompt) => {
        seen.push(prompt);
        return REPLY;
      },
      hint: 'a desert trading post',
    });
    expect(r.ok).toBe(true);
    expect(r.props).toHaveLength(4);
    expect(seen[0]).toContain('a desert trading post');
  });

  it('reports a transport failure as ok:false, never as an empty prop list', async () => {
    const r = await decomposeScene(image, {
      vision: async () => {
        throw new Error('DASHSCOPE_API_KEY missing');
      },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('DASHSCOPE_API_KEY missing');
    expect(r.props).toEqual([]);
    // A transport failure is the one case that learned nothing.
    expect(r.ran).toBe(false);
  });

  it('passes exactly the one scene image to the seam', async () => {
    let count = -1;
    await decomposeScene(image, {
      vision: async (imgs) => {
        count = imgs.length;
        return REPLY;
      },
    });
    expect(count).toBe(1);
  });
});
