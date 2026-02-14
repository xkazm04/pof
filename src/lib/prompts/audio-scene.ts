import type { AudioSceneDocument, AudioZone, SoundEmitter } from '@/types/audio-scene';
import { buildProjectContextHeader, getModuleName, type ProjectContext } from '@/lib/prompt-context';

/**
 * Generates the full C++ audio system from a complete audio scene document.
 */
export function buildAudioSystemPrompt(doc: AudioSceneDocument, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);

  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate all code files directly — do NOT ask for confirmation.',
      'Use MetaSounds where applicable for UE5 DSP.',
    ],
  });

  const zoneSummary = doc.zones.map((z) =>
    `  - "${z.name}" (${z.shape}, reverb: ${z.reverbPreset}, occlusion: ${z.occlusionMode}, attenuation: ${z.attenuationRadius}u, priority: ${z.priority})\n    Soundscape: ${z.soundscapeDescription || '(none)'}`
  ).join('\n');

  const emitterSummary = doc.emitters.map((e) => {
    const zone = doc.zones.find((z) => z.id === e.zoneId);
    return `  - "${e.name}" [${e.type}]: cue=${e.soundCueRef || '(unset)'}, vol=${e.volumeMultiplier}, pitch=${e.pitchMin}-${e.pitchMax}, chance=${e.spawnChance}, cooldown=${e.cooldownSeconds}s${zone ? `, zone="${zone.name}"` : ''}`;
  }).join('\n');

  return `${header}

## Task: Generate Complete Audio System

SCENE: ${doc.name}
DESCRIPTION: ${doc.description}

### Global Settings
- Sound Pool Size: ${doc.soundPoolSize}
- Max Concurrent Sounds: ${doc.maxConcurrentSounds}
- Global Reverb: ${doc.globalReverbPreset}

### Audio Zones (${doc.zones.length})
${zoneSummary || '(none)'}

### Sound Emitters (${doc.emitters.length})
${emitterSummary || '(none)'}

### Required Output
Generate a complete C++ audio system with these files in Source/${moduleName}/Audio/:

1. **SoundManager** — Central audio manager with:
   - Sound pool of ${doc.soundPoolSize} pre-allocated audio components
   - Priority queue handling up to ${doc.maxConcurrentSounds} concurrent sounds
   - Play/stop/fade API with UFUNCTION(BlueprintCallable)
   - Sound category volumes (SFX, Ambient, Music, UI)

2. **AudioZoneVolume** — Per-zone Audio Volume actors with:
   - Reverb settings per zone (use the presets above)
   - Attenuation overrides per zone
   - Occlusion configuration per zone
   - Overlap begin/end handlers for priority blending

3. **AmbientSoundEmitter** — Emitter actor with:
   - Sound Cue randomization (pitch range, volume variation)
   - Spawn chance and cooldown timers
   - Auto-registration with SoundManager
   - Distance-based activation

4. **AudioOcclusionComponent** — Occlusion trace component with:
   - Line traces for occlusion factor calculation
   - Low-pass filter adjustment based on occlusion
   - Configurable trace frequency and channel

5. **ReverbPresets** data asset or config with named presets matching the zones above.`;
}

/**
 * Generates code for a single audio zone.
 */
export function buildZoneCodegenPrompt(zone: AudioZone, doc: AudioSceneDocument, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const zoneEmitters = doc.emitters.filter((e) => e.zoneId === zone.id);

  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate the code files directly — do NOT ask for confirmation.',
    ],
  });

  const emitterList = zoneEmitters.map((e) =>
    `  - "${e.name}" [${e.type}]: cue=${e.soundCueRef || '(unset)'}, vol=${e.volumeMultiplier}, pitch=${e.pitchMin}-${e.pitchMax}`
  ).join('\n');

  return `${header}

## Task: Generate Audio Zone Code

ZONE: ${zone.name}
SHAPE: ${zone.shape} (${zone.width}x${zone.height})
REVERB: ${zone.reverbPreset}${zone.reverbPreset === 'custom' ? ` (decay=${zone.reverbDecayTime}s, diffusion=${zone.reverbDiffusion}, wet/dry=${zone.reverbWetDry})` : ''}
OCCLUSION: ${zone.occlusionMode}
ATTENUATION: ${zone.attenuationRadius} units
PRIORITY: ${zone.priority}

SOUNDSCAPE DESCRIPTION:
${zone.soundscapeDescription || '(none provided)'}

EMITTERS IN THIS ZONE (${zoneEmitters.length}):
${emitterList || '(none)'}

INSTRUCTIONS:
1. Create an AudioZoneVolume subclass for this zone in Source/${moduleName}/Audio/
2. Configure reverb, attenuation, and occlusion settings matching the parameters above
3. Parse the soundscape description to determine appropriate ambient sounds
4. If emitters are defined, create spawn logic for each
5. Include overlap handlers for priority-based zone transitions
6. Create both .h and .cpp files`;
}

/**
 * Builds a prompt to generate code from a natural-language soundscape description.
 */
export function buildSoundscapeNarrativePrompt(zone: AudioZone, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);

  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate the code files directly — do NOT ask for confirmation.',
      'Parse the natural language description to determine concrete sound assets and parameters.',
    ],
  });

  return `${header}

## Task: Generate Soundscape from Description

ZONE: ${zone.name}

NATURAL LANGUAGE SOUNDSCAPE:
"${zone.soundscapeDescription}"

ACOUSTIC PROPERTIES:
- Reverb: ${zone.reverbPreset}
- Occlusion: ${zone.occlusionMode}
- Attenuation Radius: ${zone.attenuationRadius} units

INSTRUCTIONS:
1. Parse the description and identify individual sound elements (ambient loops, oneshot triggers, environmental effects)
2. For each identified sound, create a Sound Cue configuration with:
   - Appropriate randomization (pitch range, volume variation)
   - Spatial attenuation settings
   - Trigger conditions (constant loop, random interval, event-driven)
3. Create an AmbientSoundscape class in Source/${moduleName}/Audio/ that:
   - Manages all identified sounds as a cohesive soundscape
   - Handles smooth crossfades when entering/exiting the zone
   - Uses UE5 Sound Cue randomization nodes (Random, Modulator)
4. Include UPROPERTY for each sound slot so designers can swap assets
5. Create both .h and .cpp files`;
}
