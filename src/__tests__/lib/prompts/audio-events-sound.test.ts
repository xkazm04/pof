import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildAudioEventPrompt } from '@/lib/prompts/audio-events';
import { DEFAULT_EVENTS } from '@/components/modules/content/audio/AudioEventCatalog/constants';
import type { AudioEvent } from '@/components/modules/content/audio/AudioEventCatalog/types';
import type { ProjectContext } from '@/lib/prompt-context';
import { STANDALONE_BUILDERS } from './builder-fixtures';

/**
 * The manager prompt demands `FAudioEventDefinition.SoundCue` per event. With
 * bindings supplied, each event line now carries the REAL imported cue path or a
 * labelled PLACEHOLDER — the CLI is no longer asked to invent a path. Without a
 * `bindings` key the prompt stays byte-identical to the recorded golden.
 */

const CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.8.0' };

/** The markdown block of one event: its `- **Name**` line up to the next event/heading. */
function eventBlock(prompt: string, name: string): string {
  const start = prompt.indexOf(`- **${name}**`);
  expect(start).toBeGreaterThan(-1);
  const rest = prompt.slice(start + 1);
  const next = rest.search(/\n\s*(- \*\*|###? )/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('buildAudioEventPrompt — per-event sound binding', () => {
  it('ships the imported cue path for a bound event and a labelled placeholder otherwise', () => {
    const events: AudioEvent[] = structuredClone(DEFAULT_EVENTS);
    events[4].assetSetId = 's1'; // Footstep
    const prompt = buildAudioEventPrompt({
      events,
      bindings: { s1: { setName: 'footstep-stone', cuePath: '/Game/Audio/footstep-stone/SC_footstep-stone' } },
    }, CTX);

    expect(eventBlock(prompt, 'Footstep')).toContain('SoundCue: /Game/Audio/footstep-stone/SC_footstep-stone');
    const melee = eventBlock(prompt, 'Melee Hit');
    expect(melee).toContain('SoundCue: NONE');
    expect(melee).toContain('PLACEHOLDER');
    expect(prompt).not.toContain('/Game/Audio/SC_');
  });

  it('[guard] with no bindings key the prompt is byte-identical to the golden', () => {
    const builder = STANDALONE_BUILDERS.find((b) => b.name === 'audio-events');
    expect(builder).toBeDefined();
    const golden = fs.readFileSync(
      path.join(process.cwd(), 'src', '__tests__', 'lib', 'prompts', '__golden__', 'builder-audio-events.md'),
      'utf8',
    ).replace(/\r\n/g, '\n');
    const actual = builder!.build(CTX).replace(/cb-\d+-\d+/g, 'cb-TEST').replace(/\r\n/g, '\n');
    expect(actual).toBe(golden);
    expect(actual).not.toContain('SoundCue: NONE');
  });
});
