import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MESH_NEG_TAIL, MESH_PACKS, meshPromptFor } from '@/lib/media-prompts/meshPrompts';
import { ASSET_CLASS_IDS } from '@/lib/visual-gen/polycount-presets';
import { routePromptShape } from '@/lib/visual-gen/linear-prop-routing';

const { startTripoJob } = vi.hoisted(() => ({ startTripoJob: vi.fn(() => 'job-1') }));
vi.mock('@/lib/visual-gen/tripo-job-store', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/tripo-job-store')>()),
  startTripoJob,
}));
const { POST } = await import('@/app/api/visual-gen/generate/route');

const post = (body: Record<string, unknown>) =>
  POST(new NextRequest('http://localhost/api/visual-gen/generate', {
    method: 'POST',
    body: JSON.stringify({ mode: 'text-to-3d', providerId: 'tripo3d', ...body }),
  }));
const sentPrompt = () => (startTripoJob.mock.calls[0] as unknown as [{ prompt: string }])[0].prompt;

beforeEach(() => startTripoJob.mockClear());

describe('meshPromptFor', () => {
  it('has a pack for every asset class', () => {
    expect(Object.keys(MESH_PACKS).sort()).toEqual([...ASSET_CLASS_IDS].sort());
  });

  it.each([...ASSET_CLASS_IDS])('composes the %s clause and shared tail after the subject', (cls) => {
    const out = meshPromptFor(cls, 'A rusted greatsword.')!;
    expect(out.startsWith('A rusted greatsword. ')).toBe(true);
    expect(out).toContain(MESH_PACKS[cls].clause);
    expect(out.endsWith(MESH_NEG_TAIL)).toBe(true);
  });

  it.each([undefined, '', 'no-such-class', 'constructor'])('has no pack for assetClass %j', (cls) => {
    expect(meshPromptFor(cls, 'A sword')).toBeNull();
  });
});

describe('POST /api/visual-gen/generate text-to-3d', () => {
  it('reaches Tripo with the class clause and tail', async () => {
    const res = await post({ prompt: 'A rusted greatsword', assetClass: 'weapon' });
    expect(res.status).toBe(202);
    expect(sentPrompt()).toBe(meshPromptFor('weapon', 'A rusted greatsword'));
    expect(sentPrompt()).toContain(MESH_PACKS.weapon.clause);
  });

  it.each([undefined, 'no-such-class'])('sends the raw prompt byte-identical for assetClass %j', async (cls) => {
    await post({ prompt: '  A rusted greatsword  ', assetClass: cls });
    expect(sentPrompt()).toBe('  A rusted greatsword  ');
  });

  it('still refuses a linear prop on the RAW prompt, pack or not', async () => {
    const raw = 'a coil of rope';
    expect(routePromptShape(raw).route).toBe('procedural');
    const res = await post({ prompt: raw, assetClass: 'prop' });
    expect(res.status).toBe(400);
    expect(startTripoJob).not.toHaveBeenCalled();
  });
});
