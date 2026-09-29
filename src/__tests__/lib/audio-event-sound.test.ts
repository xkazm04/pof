import { describe, it, expect } from 'vitest';
import {
  suggestEventSounds,
  eventSoundCoverage,
  eventCueLine,
  type EventSoundOption,
} from '@/lib/audio-event-sound';
import { DEFAULT_EVENTS } from '@/components/modules/content/audio/AudioEventCatalog/constants';
import type { AudioEvent } from '@/components/modules/content/audio/AudioEventCatalog/types';

/**
 * The Event Catalog authors event classes whose generated C++ struct has a
 * SoundCue slot, but the catalog had no sound column. These cases pin the pure
 * binding edge: confident suggestions only, ties never auto-picked, a kind guard
 * per category, and coverage that says UNKNOWN when the library is unreadable.
 */

function opt(over: Partial<EventSoundOption> & Pick<EventSoundOption, 'id' | 'name'>): EventSoundOption {
  return { kind: 'sfx', clipCount: 3, cuePath: null, ...over };
}

const events = (): AudioEvent[] => structuredClone(DEFAULT_EVENTS);

describe('suggestEventSounds', () => {
  it('suggests only the confident name-token + kind-compatible match', () => {
    const r = suggestEventSounds(DEFAULT_EVENTS, [
      { id: 's1', name: 'footstep-stone', kind: 'sfx', clipCount: 3, cuePath: null },
    ]);
    expect(r).toEqual({ suggested: { 'evt-5': 's1' }, ambiguous: {} });
  });

  it('never silently picks between two equally good sets', () => {
    const r = suggestEventSounds(DEFAULT_EVENTS, [
      opt({ id: 'a', name: 'footstep-stone' }),
      opt({ id: 'b', name: 'footstep-grass' }),
    ]);
    expect(r.suggested['evt-5']).toBeUndefined();
    expect([...r.ambiguous['evt-5']].sort()).toEqual(['a', 'b']);
  });

  it('guards kind per category, and never suggests a tts set', () => {
    const r = suggestEventSounds(DEFAULT_EVENTS, [
      opt({ id: 'hit', name: 'combat-hit', kind: 'sfx' }),
      opt({ id: 'boss', name: 'boss-theme', kind: 'music' }),
      opt({ id: 'vo', name: 'player-death', kind: 'tts' }),
    ]);
    // 'Combat Layer' is a music event tagged 'combat' — an sfx set is not its sound.
    expect(r.suggested['evt-11']).toBeUndefined();
    expect(r.ambiguous['evt-11']).toBeUndefined();
    expect(r.suggested['evt-13']).toBe('boss');
    // No tts provider exists: a tts set is never a suggestion anywhere.
    const all = [...Object.values(r.suggested), ...Object.values(r.ambiguous).flat()];
    expect(all).not.toContain('vo');
  });
});

describe('eventSoundCoverage', () => {
  const lib: EventSoundOption[] = [
    opt({ id: 'imp', name: 'footstep-stone', cuePath: '/Game/Audio/footstep-stone/SC_footstep-stone' }),
    opt({ id: 'fresh', name: 'door-creak', cuePath: null }),
  ];
  const bound = () => {
    const evs = events();
    evs[4].assetSetId = 'imp'; // Footstep
    evs[5].assetSetId = 'fresh'; // Door Open
    evs[0].assetSetId = 'gone'; // Melee Hit -> id not in the library
    return evs;
  };

  it('counts imported / not imported / set missing / unbound', () => {
    expect(eventSoundCoverage(bound(), lib)).toMatchObject({
      state: 'known', imported: 1, notImported: 1, setMissing: 1, unbound: 10,
    });
  });

  it('reads UNKNOWN when the library could not be read — never "13 unbound"', () => {
    const c = eventSoundCoverage(bound(), null);
    expect(c.state).toBe('unknown');
    expect(c.unbound).not.toBe(13);
    expect(c).not.toHaveProperty('imported');
  });
});

describe('eventCueLine', () => {
  it('ships the real imported path, or a labelled placeholder', () => {
    const evs = events();
    evs[4].assetSetId = 's1';
    const bindings = { s1: { setName: 'footstep-stone', cuePath: '/Game/Audio/footstep-stone/SC_footstep-stone' } };
    expect(eventCueLine(evs[4], bindings)).toContain('SoundCue: /Game/Audio/footstep-stone/SC_footstep-stone');
    const unbound = eventCueLine(evs[0], bindings);
    expect(unbound).toContain('SoundCue: NONE');
    expect(unbound).toContain('PLACEHOLDER');
    expect(unbound).not.toContain('/Game/');
  });
});
