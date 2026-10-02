import { describe, it, expect } from 'vitest';
import { generateAudioCode } from '@/lib/audio-codegen';
import {
  AUDIO_RUNTIME,
  GENERATED_AUDIO_CLASSES,
  eventBudget,
} from '@/lib/audio-runtime-contract';
import {
  buildAudioSystemPrompt,
  buildZoneCodegenPrompt,
  buildSoundscapeNarrativePrompt,
} from '@/lib/prompts/audio-scene';
import { buildAudioEventPrompt } from '@/lib/prompts/audio-events';
import { DEFAULT_EVENTS } from '@/components/modules/content/audio/AudioEventCatalog/constants';
import type { ProjectContext } from '@/lib/prompt-context';
import type { AudioSceneDocument, AudioZone } from '@/types/audio-scene';

/**
 * Four audio generators write C++ into the same Source/<Module>/Audio/ folder.
 * They used to ask for up to three UGameInstanceSubsystems, each with its own
 * sound pool (codegen's UAudioSceneManager, the scene prompt's SoundManager, the
 * event prompt's UAudioEventManager), and named zone/emitter/reverb/ambient
 * classes twice. `AUDIO_RUNTIME` is the one vocabulary; these cases pin every
 * generator to it and the contract to what the deterministic codegen emits.
 */

const CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.8.0' };

const ZONE: AudioZone = {
  id: 'zone-1', name: 'Flooded Nave', shape: 'rect', x: 0, y: 0, width: 400, height: 300,
  soundscapeDescription: 'Dripping water, distant echoing chants.',
  reverbPreset: 'stone-chamber', reverbDecayTime: 2.4, reverbDiffusion: 0.8, reverbWetDry: 0.5,
  attenuationRadius: 1500, occlusionMode: 'medium', priority: 5, color: 'var(--accent)',
};

const DOC: AudioSceneDocument = {
  id: 1, name: 'Crypt', description: 'Crypt audio.', zones: [ZONE],
  emitters: [{
    id: 'em-1', name: 'Brazier', type: 'loop', x: 40, y: 60, soundCueRef: '/Game/Audio/SC_Brazier',
    attenuationRadius: 600, volumeMultiplier: 0.8, pitchMin: 0.95, pitchMax: 1.05,
    spawnChance: 1, cooldownSeconds: 0, zoneId: 'zone-1',
  }],
  globalReverbPreset: 'cave', soundPoolSize: 32, maxConcurrentSounds: 16,
  lastGeneratedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

/**
 * The extraction rule for "requested as a UGameInstanceSubsystem" (stated, so the
 * count is not self-graded):
 *   - C++:    `class <API> <Name> : public UGameInstanceSubsystem`
 *   - prompt: a bold class name whose line declares it `(UGameInstanceSubsystem…)`
 *             or casts it as the central audio manager (`**X** — Central audio manager`).
 */
function subsystemsRequested(text: string): string[] {
  const names: string[] = [];
  for (const m of text.matchAll(/class\s+\w+\s+(\w+)\s*:\s*public\s+UGameInstanceSubsystem/g)) names.push(m[1]);
  for (const m of text.matchAll(/\*\*(\w+)\*\*[^\n]*?(?:\([^)\n]*UGameInstanceSubsystem[^)\n]*\)|—\s*Central audio manager)/g)) names.push(m[1]);
  return names;
}

describe('AUDIO_RUNTIME — one pool owner, the one codegen emits', () => {
  it('names UAudioSceneManager in AudioSceneManager.h, and codegen declares exactly that subsystem', () => {
    expect(AUDIO_RUNTIME.manager.className).toBe('UAudioSceneManager');
    expect(AUDIO_RUNTIME.manager.header).toBe('AudioSceneManager.h');

    const { files } = generateAudioCode(DOC, 'PoF', 'POF_API');
    const header = files.find((f) => f.filename === AUDIO_RUNTIME.manager.header);
    expect(header).toBeDefined();
    expect(header!.content).toMatch(/class POF_API UAudioSceneManager : public UGameInstanceSubsystem/);
    // The router reads these two getters; the contract depends on them existing.
    expect(header!.content).toContain('GetSoundPoolSize()');
    expect(header!.content).toContain('GetMaxConcurrentSounds()');

    // Drift guard: every class the contract says codegen emits is declared, with
    // its base, in the header the contract names.
    for (const entry of GENERATED_AUDIO_CLASSES) {
      const file = files.find((f) => f.filename === entry.header);
      expect(file, entry.header).toBeDefined();
      expect(file!.content).toMatch(new RegExp(`class POF_API ${entry.className} : public ${entry.base}\\b`));
    }
  });
});

describe('buildAudioSystemPrompt — the contract vocabulary, not a second one', () => {
  it('names every contract class and none of the parallel names', () => {
    const prompt = buildAudioSystemPrompt(DOC, CTX);
    for (const cls of ['UAudioSceneManager', 'UAudioReverbPresets', 'ASceneAudioVolume', 'ASceneEmitterSpawner', 'UProceduralAmbientManager']) {
      expect(prompt, cls).toContain(cls);
    }
    for (const stale of ['**SoundManager**', 'AudioZoneVolume', 'AmbientSoundEmitter', '**ReverbPresets**']) {
      expect(prompt, stale).not.toContain(stale);
    }
  });
});

describe('buildAudioEventPrompt — builds on the manager, never beside it', () => {
  it('names UAudioSceneManager as the pool owner with the scene numbers, AudioSceneManager.h as generated, and no second subsystem', () => {
    const prompt = buildAudioEventPrompt({ events: DEFAULT_EVENTS }, CTX, { soundPoolSize: 24, maxConcurrentSounds: 12 });

    expect(prompt).toMatch(/UAudioSceneManager[^\n]*owner of the sound pool and the priority queue/);
    expect(prompt).toMatch(/pool of 24\b/);
    expect(prompt).toMatch(/voice limit of 12\b/);
    expect(prompt).not.toContain('UAudioEventManager** (UGameInstanceSubsystem)');
    expect(prompt).not.toContain('Pool size configurable via data asset');

    // AudioSceneManager.h is PoF codegen output: named, and marked do-not-edit.
    expect(prompt).toMatch(/AudioSceneManager\.h[^\n]*(generated|codegen)[^\n]*do not edit/i);
    // PlayEvent lives in a NON-subsystem class owned by the manager.
    expect(prompt).toMatch(/\*\*UAudioEventRouter\*\* \(UObject[^)\n]*not a subsystem[^)\n]*\)/i);
    expect(prompt).toContain('GetSoundPoolSize()');
    expect(prompt).toContain('GetMaxConcurrentSounds()');
    expect(subsystemsRequested(prompt)).toEqual(['UAudioSceneManager']);
  });
});

describe('one UGameInstanceSubsystem across every generator', () => {
  it('the set of subsystem classes requested by all five generators has size 1', () => {
    const outputs = [
      buildAudioSystemPrompt(DOC, CTX),
      buildZoneCodegenPrompt(ZONE, DOC, CTX),
      buildSoundscapeNarrativePrompt(ZONE, CTX),
      buildAudioEventPrompt({ events: DEFAULT_EVENTS }, CTX, DOC),
      ...generateAudioCode(DOC, 'PoF', 'POF_API').files.map((f) => f.content),
    ];
    const owners = new Set(outputs.flatMap(subsystemsRequested));
    expect([...owners]).toEqual(['UAudioSceneManager']);
  });
});

describe('eventBudget — the catalog is reconciled against the scene limit', () => {
  it('counts the default catalog at 21 voices against a limit of 16', () => {
    expect(eventBudget(DEFAULT_EVENTS, { maxConcurrentSounds: 16 })).toEqual({ declaredVoices: 21, limit: 16, overBy: 5 });
  });

  it('states the overrun in the event prompt, so priority decides who is stolen', () => {
    const prompt = buildAudioEventPrompt({ events: DEFAULT_EVENTS }, CTX, { soundPoolSize: 32, maxConcurrentSounds: 16 });
    expect(prompt).toMatch(/21 declared voices exceed the scene limit of 16[^\n]*priority decides which voice is stolen/);
  });
});

describe('zone and soundscape prompts configure contract classes instead of inventing new ones', () => {
  it('the zone prompt configures an ASceneAudioVolume entry', () => {
    const prompt = buildZoneCodegenPrompt(ZONE, DOC, CTX);
    expect(prompt).toMatch(/Configure the zone as an ASceneAudioVolume entry/);
    expect(prompt).not.toContain('Create an AudioZoneVolume subclass');
  });

  it('the soundscape prompt asks for a UProceduralAmbientManager layer', () => {
    const prompt = buildSoundscapeNarrativePrompt(ZONE, CTX);
    expect(prompt).toMatch(/UProceduralAmbientManager layer/);
    expect(prompt).not.toContain('AmbientSoundscape class');
  });
});

describe('[guard] the deterministic codegen is not edited', () => {
  it('emits the same file list and categories', () => {
    const { files } = generateAudioCode(DOC, 'PoF', 'POF_API');
    expect(files.map((f) => `${f.filename}:${f.category}`)).toEqual([
      'AudioReverbPresets.h:reverb', 'AudioReverbPresets.cpp:reverb',
      'AudioZoneAttenuation.h:attenuation', 'AudioZoneAttenuation.cpp:attenuation',
      'SceneAudioVolume.h:volume', 'SceneAudioVolume.cpp:volume',
      'SceneEmitterSpawner.h:emitter', 'SceneEmitterSpawner.cpp:emitter',
      'ProceduralAmbientLayer.h:metasound', 'ProceduralAmbientLayer.cpp:metasound',
      'AudioSceneManager.h:manager', 'AudioSceneManager.cpp:manager',
    ]);
  });
});
