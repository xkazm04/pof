/**
 * The set-dressing solver gets its FIRST production caller.
 *
 * At HEAD~1 `generateComposition` and `placement-tags` had zero importers anywhere in
 * `src/` outside their own two files — the only other match in the tree was a *string*
 * inside a `ue-gotchas.ts` knowledge entry. The solver was a tested pure function with no
 * path to an engine, which is precisely what `docs/research/agentic-world-composition-spec.md`
 * predicted ("any world-scale ambition is blocked behind that wiring").
 *
 * This route is the wiring: image → VLM decompose → per-prop crop + Tier-0 gate →
 * CompositionAsset[] → generateComposition → a manifest whose every prop carries the UE
 * actor tags a spawn script reads. The vision seam is INJECTED via the mocked module, so
 * no live VLM call happens here; sharp cropping is real.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import sharp from 'sharp';

const vision = vi.fn();
vi.mock('@/lib/anim-critique/qwen', () => ({ makeQwenVision: () => vision }));

const { POST } = await import('@/app/api/visual-gen/scene-decompose/route');

const DECOMPOSE_REPLY = [
  'PROP=trading post table; BOX=0.30,0.48,0.72,0.86; SIZE_CM=170; COUNT=1; MATERIAL=wood',
  'PROP=wooden barrel; BOX=0.10,0.55,0.26,0.92; SIZE_CM=90; COUNT=2; MATERIAL=wood',
  'PROP=clay bottle; BOX=0.44,0.40,0.49,0.50; SIZE_CM=28; COUNT=2; MATERIAL=glass',
].join('\n');

const GATE_REPLY = 'SCORE=8; DEFECTS=none; VERDICT=clean single subject.';

async function sceneDataUrl(): Promise<string> {
  const png = await sharp({
    create: { width: 512, height: 384, channels: 3, background: { r: 90, g: 70, b: 50 } },
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3001/api/visual-gen/scene-decompose', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

/** First vision call is the decompose; every later one is a per-crop gate. */
function stubDecomposeThenGates() {
  vision.mockImplementation(async (_imgs: unknown, prompt: string) =>
    prompt.includes('PROP=') ? DECOMPOSE_REPLY : GATE_REPLY,
  );
}

beforeEach(() => {
  vision.mockReset();
});

describe('POST /api/visual-gen/scene-decompose', () => {
  it('rejects a missing image with a 400', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it('rejects a non-image data URL with a 400', async () => {
    const res = await POST(req({ imageDataUrl: 'https://example.com/scene.png' }));
    expect(res.status).toBe(400);
  });

  it('returns the decomposed props and a placed composition', async () => {
    stubDecomposeThenGates();
    const res = await POST(req({ imageDataUrl: await sceneDataUrl(), gateCrops: false }));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.props.map((p: { id: string }) => p.id)).toEqual([
      'trading-post-table',
      'wooden-barrel',
      'clay-bottle',
    ]);
    expect(data.composition.props.length).toBeGreaterThan(0);
  });

  it('expands COUNT into placed instances rather than one prop each', async () => {
    stubDecomposeThenGates();
    const res = await POST(req({ imageDataUrl: await sceneDataUrl(), gateCrops: false }));
    const { data } = await res.json();
    // 1 table + 2 barrels + 2 bottles = 5 instances.
    const total = data.composition.props.length + data.composition.unplaced.length;
    expect(total).toBe(5);
  });

  it('gives every placed prop the UE actor tags a spawn script reads', async () => {
    stubDecomposeThenGates();
    const res = await POST(req({ imageDataUrl: await sceneDataUrl(), gateCrops: false }));
    const { data } = await res.json();
    const first = data.composition.props[0];
    expect(first.ueActorTags).toEqual(expect.arrayContaining([expect.stringMatching(/^place_/)]));
    expect(first.ueActorTags).toEqual(expect.arrayContaining([expect.stringMatching(/^mass_kg_/)]));
    expect(first.ueActorTags).toEqual(expect.arrayContaining([expect.stringMatching(/^phys_/)]));
  });

  it('carries the VLM material into the tags rather than defaulting every prop', async () => {
    stubDecomposeThenGates();
    const res = await POST(req({ imageDataUrl: await sceneDataUrl(), gateCrops: false }));
    const { data } = await res.json();
    const tagsFor = (assetId: string) =>
      data.composition.props.find((p: { assetId: string }) => p.assetId === assetId).ueActorTags;
    expect(tagsFor('clay-bottle')).toContain('phys_glass');
    expect(tagsFor('wooden-barrel')).toContain('phys_wood');
    // A live run before this was wired returned phys_default for every prop.
    expect(data.composition.props.every((p: { ueActorTags: string[] }) => p.ueActorTags.includes('phys_default'))).toBe(false);
  });

  it('gives the same-size props different masses when their materials differ', async () => {
    vision.mockImplementation(async (_i: unknown, prompt: string) =>
      prompt.includes('PROP=')
        ? 'PROP=stone block; BOX=0.1,0.1,0.3,0.3; SIZE_CM=40; COUNT=1; MATERIAL=stone\n' +
          'PROP=cloth sack; BOX=0.5,0.1,0.7,0.3; SIZE_CM=40; COUNT=1; MATERIAL=fabric'
        : GATE_REPLY,
    );
    const res = await POST(req({ imageDataUrl: await sceneDataUrl(), gateCrops: false }));
    const { data } = await res.json();
    const massOf = (assetId: string) =>
      Number(
        data.composition.props
          .find((p: { assetId: string }) => p.assetId === assetId)
          .ueActorTags.find((t: string) => t.startsWith('mass_kg_'))
          .slice('mass_kg_'.length),
      );
    expect(massOf('stone-block')).toBeGreaterThan(massOf('cloth-sack') * 10);
  });

  it('is deterministic for a given seed', async () => {
    stubDecomposeThenGates();
    const url = await sceneDataUrl();
    const a = await (await POST(req({ imageDataUrl: url, seed: 7, gateCrops: false }))).json();
    stubDecomposeThenGates();
    const b = await (await POST(req({ imageDataUrl: url, seed: 7, gateCrops: false }))).json();
    expect(a.data.composition).toEqual(b.data.composition);
  });

  it('gates each cropped prop through the Tier-0 input gate when asked', async () => {
    stubDecomposeThenGates();
    const res = await POST(req({ imageDataUrl: await sceneDataUrl(), gateCrops: true }));
    const { data } = await res.json();
    expect(data.gate).toHaveLength(3);
    expect(data.gate[0]).toMatchObject({ id: 'trading-post-table', ran: true, verdict: 'pass' });
    // one decompose call + one gate call per prop
    expect(vision).toHaveBeenCalledTimes(4);
  });

  it('does not spend a vision call per prop when gating is off', async () => {
    stubDecomposeThenGates();
    await POST(req({ imageDataUrl: await sceneDataUrl(), gateCrops: false }));
    expect(vision).toHaveBeenCalledTimes(1);
  });

  it('reports a failing crop as fail without dropping it from the composition', async () => {
    vision.mockImplementation(async (_i: unknown, prompt: string) => {
      if (prompt.includes('PROP=')) return DECOMPOSE_REPLY;
      return 'SCORE=2; DEFECTS=heavily occluded,cropped; VERDICT=unusable.';
    });
    const res = await POST(req({ imageDataUrl: await sceneDataUrl(), gateCrops: true }));
    const { data } = await res.json();
    expect(data.gate.every((g: { verdict: string }) => g.verdict === 'fail')).toBe(true);
    // The gate ADVISES; it must not silently delete props from the manifest.
    expect(data.props).toHaveLength(3);
  });

  it('surfaces a vision failure as a 502 rather than an empty success', async () => {
    vision.mockRejectedValue(new Error('QWEN_API_KEY missing'));
    const res = await POST(req({ imageDataUrl: await sceneDataUrl() }));
    expect(res.status).toBe(502);
    const { error } = await res.json();
    expect(error).toContain('QWEN_API_KEY missing');
  });

  it('reports a scene with no movable props as an honest empty 200, not an outage', async () => {
    // Observed live on the ravaged-courtyard arena art once the prompt stopped accepting
    // architecture and foliage: the model looked and there was genuinely nothing to take.
    vision.mockResolvedValue('There are no movable props in this image.');
    const res = await POST(req({ imageDataUrl: await sceneDataUrl() }));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.props).toEqual([]);
    expect(data.composition.props).toEqual([]);
    expect(data.note).toMatch(/no movable props/i);
  });

  it('still 502s when the vision call itself never completed', async () => {
    vision.mockRejectedValue(new Error('socket hang up'));
    const res = await POST(req({ imageDataUrl: await sceneDataUrl() }));
    expect(res.status).toBe(502);
  });
});
