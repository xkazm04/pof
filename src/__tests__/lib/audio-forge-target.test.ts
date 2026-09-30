import { describe, it, expect } from 'vitest';
import { resolveForgeTarget, planForgeRun, type ForgeForm } from '@/lib/audio-library/forgeTarget';
import { ElevenLabsProvider } from '@/lib/audio-gen/providers/elevenlabs';
import type { AudioAsset, AudioSet } from '@/types/audio-asset';

/**
 * The Sound Forge adds FRESH takes to ONE library set: a taken name targets the
 * existing set (never a same-named twin), numbering continues past every take the
 * set already holds (never a cached repeat), and an unservable or ambiguous target
 * is refused before any billed POST. Pure: no fetch, no provider call.
 */

function set(over: Partial<AudioSet> & { id: string; name: string }): AudioSet {
  return {
    id: over.id, name: over.name, kind: over.kind ?? 'sfx',
    eventKey: over.eventKey ?? null, surface: over.surface ?? null,
    loopable: over.loopable ?? false, createdAt: 0,
  };
}
function asset(id: string, setId: string, prompt: string): AudioAsset {
  return {
    id, setId, filename: `${id}.mp3`, relPath: `${setId}/${id}.mp3`, prompt,
    provider: 'elevenlabs', durationMs: 1500, format: 'mp3', favorite: false,
    promptHash: null, createdAt: 0,
  };
}

const S1 = set({ id: 'S1', name: 'footstep-stone', kind: 'sfx', eventKey: 'footstep', surface: 'stone', loopable: false });
const S1_ASSETS = [
  asset('a1', 'S1', 'p (variation 1)'),
  asset('a2', 'S1', 'p (variation 2)'),
  asset('a3', 'S1', 'p (variation 3)'),
];

const form = (over: Partial<ForgeForm> = {}): ForgeForm => ({
  prompt: 'p', variations: 3, kind: 'sfx', eventKey: 'footstep', surface: 'stone',
  loop: false, durationSeconds: 1.5, ...over,
});

describe('resolveForgeTarget', () => {
  it('a taken name targets that set and never mints a new one', () => {
    const t = resolveForgeTarget([S1], S1_ASSETS, { typedName: 'footstep-stone', selectedSetId: null });
    expect(t).toMatchObject({ mode: 'existing', setId: 'S1', takeCount: 3, matchedBy: 'name' });
  });

  it('a free name is a new set', () => {
    const t = resolveForgeTarget([S1], S1_ASSETS, { typedName: 'door-creak', selectedSetId: null });
    expect(t).toEqual({ mode: 'new', name: 'door-creak' });
  });

  it('two sets sharing the typed name are ambiguous, and the plan refuses with 0 bodies', () => {
    const S2 = set({ id: 'S2', name: 'footstep-stone' });
    const t = resolveForgeTarget([S1, S2], S1_ASSETS, { typedName: 'footstep-stone', selectedSetId: null });
    expect(t).toMatchObject({ mode: 'ambiguous', candidates: ['S1', 'S2'] });
    const plan = planForgeRun(t, form(), ElevenLabsProvider);
    expect(plan).toMatchObject({ ok: false, reason: 'name-ambiguous' });
    expect('bodies' in plan ? plan.bodies : []).toHaveLength(0);
  });
});

describe('planForgeRun', () => {
  it('an existing set gets setId on every body, continued numbering and its own locked fields', () => {
    const t = resolveForgeTarget([S1], S1_ASSETS, { typedName: '', selectedSetId: 'S1' });
    const plan = planForgeRun(
      t,
      form({ prompt: 'p', variations: 3, kind: 'ambient', eventKey: 'x', surface: 'y', loop: true }),
      ElevenLabsProvider,
    );
    if (!plan.ok) throw new Error(`expected a plan, got ${plan.reason}`);
    expect(plan.bodies).toHaveLength(3);
    for (const b of plan.bodies) {
      expect(b.setId).toBe('S1');
      expect(b.kind).toBe('sfx');
      expect(b.eventKey).toBe('footstep');
      expect(b.surface).toBe('stone');
      expect(b.loop).toBe(false);
    }
    expect(plan.bodies.map((b) => b.prompt)).toEqual(['p (variation 4)', 'p (variation 5)', 'p (variation 6)']);
    expect(plan.lockedFields.map((f) => f.field).sort()).toEqual(['eventKey', 'kind', 'loop', 'surface']);
    expect(plan.lockedFields.find((f) => f.field === 'kind')).toMatchObject({ formValue: 'ambient', setValue: 'sfx' });
  });

  it('[guard] a new set keeps today\'s request shape', () => {
    const t = resolveForgeTarget([S1], S1_ASSETS, { typedName: 'door-creak', selectedSetId: null });
    const plan = planForgeRun(t, form({ prompt: 'p', variations: 2 }), ElevenLabsProvider);
    if (!plan.ok) throw new Error(`expected a plan, got ${plan.reason}`);
    expect(plan.bodies).toHaveLength(2);
    expect(plan.bodies[0].setName).toBe('door-creak');
    expect(plan.bodies[0].setId).toBeUndefined();
    expect(plan.bodies.map((b) => b.prompt)).toEqual(['p (variation 1)', 'p (variation 2)']);
  });

  it('a set whose kind the provider cannot serve is refused with the provider\'s own reason, 0 bodies', () => {
    const T = set({ id: 'T1', name: 'barks', kind: 'tts' });
    const t = resolveForgeTarget([T], [], { typedName: '', selectedSetId: 'T1' });
    const plan = planForgeRun(t, form(), ElevenLabsProvider);
    expect(plan).toMatchObject({ ok: false, reason: 'kind-unservable', detail: ElevenLabsProvider.unsupported.tts });
    expect('bodies' in plan ? plan.bodies : []).toHaveLength(0);
  });

  it('numbering continues past the highest take even after a deletion, never re-requesting an existing prompt', () => {
    const gapped = [
      asset('g1', 'S1', 'p (variation 1)'),
      asset('g3', 'S1', 'p (variation 3)'),
      asset('g5', 'S1', 'p (variation 5)'),
    ];
    const t = resolveForgeTarget([S1], gapped, { typedName: '', selectedSetId: 'S1' });
    expect(t).toMatchObject({ mode: 'existing', takeCount: 3 });
    const plan = planForgeRun(t, form({ prompt: 'p', variations: 2 }), ElevenLabsProvider);
    if (!plan.ok) throw new Error(`expected a plan, got ${plan.reason}`);
    expect(plan.bodies.map((b) => b.prompt)).toEqual(['p (variation 6)', 'p (variation 7)']);
    const existing = new Set(gapped.map((a) => a.prompt));
    for (const b of plan.bodies) expect(existing.has(b.prompt)).toBe(false);
  });
});
