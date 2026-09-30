import type { AudioSceneDocument, AudioZone } from '@/types/audio-scene';
import { buildProjectContextHeader, getModuleName, type ProjectContext } from '@/lib/prompt-context';
import { GENERATE_ALL_DIRECTLY, GENERATE_THE_DIRECTLY } from '@/lib/prompts/_shared';
import { moduleKnowledge } from '@/lib/prompts/module-knowledge';
import { AUDIO_RUNTIME, runtimeContractBlock } from '@/lib/audio-runtime-contract';

/**
 * Generates the full C++ audio system from a complete audio scene document.
 */
export function buildAudioSystemPrompt(doc: AudioSceneDocument, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const m = AUDIO_RUNTIME.manager;

  const header = buildProjectContextHeader(ctx, {
    ...moduleKnowledge('audio'),
    extraRules: [
      GENERATE_ALL_DIRECTLY,
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

${runtimeContractBlock(doc, moduleName)}

### Required Output
Generate the complete C++ audio system in Source/${moduleName}/Audio/ under the contract names above. A contract class whose header already exists is PoF codegen output: keep it and build on it; create only the missing ones.

1. **${m.className}** — the one audio subsystem: sound pool of ${doc.soundPoolSize}, voice limit of ${doc.maxConcurrentSounds}, EnterZone/ExitZone, and the ${AUDIO_RUNTIME.reverbPresets.className} it loads.

2. **${AUDIO_RUNTIME.eventRouter.className}** — playback on the manager's budget (not a subsystem):
   - Pooled audio components, priority queue up to ${doc.maxConcurrentSounds} concurrent sounds
   - Play/stop/fade API with UFUNCTION(BlueprintCallable)
   - Sound category volumes (SFX, Ambient, Music, UI)

3. **${AUDIO_RUNTIME.zoneVolume.className}** — one volume per zone above:
   - Reverb settings per zone (use the presets above)
   - Attenuation overrides per zone (${AUDIO_RUNTIME.attenuation.className})
   - Occlusion configuration per zone
   - Overlap begin/end handlers calling ${m.className}::EnterZone/ExitZone for priority blending

4. **${AUDIO_RUNTIME.emitterSpawner.className}** — spawns the emitters above:
   - Sound Cue randomization (pitch range, volume variation)
   - Spawn chance and cooldown timers
   - No private audio component pool: its voices count against ${m.className}'s voice limit
   - Distance-based activation

5. **${AUDIO_RUNTIME.ambientLayer.className}** — one ambient layer per zone soundscape above, with crossfades on zone change.

6. **AudioOcclusionComponent** — Occlusion trace component with:
   - Line traces for occlusion factor calculation
   - Low-pass filter adjustment based on occlusion
   - Configurable trace frequency and channel

7. **${AUDIO_RUNTIME.reverbPresets.className}** data asset with named presets matching the zones above.`;
}

/**
 * Generates code for a single audio zone.
 */
export function buildZoneCodegenPrompt(zone: AudioZone, doc: AudioSceneDocument, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const zoneEmitters = doc.emitters.filter((e) => e.zoneId === zone.id);

  const header = buildProjectContextHeader(ctx, {
    ...moduleKnowledge('audio'),
    extraRules: [
      GENERATE_THE_DIRECTLY,
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

${runtimeContractBlock(doc, moduleName)}

INSTRUCTIONS:
1. Configure the zone as an ${AUDIO_RUNTIME.zoneVolume.className} entry (ZoneName "${zone.name}") placed from a setup helper in Source/${moduleName}/Audio/ — no per-zone subclass
2. Configure reverb, attenuation, and occlusion settings matching the parameters above
3. Parse the soundscape description to determine appropriate ambient sounds (as ${AUDIO_RUNTIME.ambientLayer.className} layer config)
4. If emitters are defined, add each as an ${AUDIO_RUNTIME.emitterSpawner.className} entry
5. Route overlap transitions through ${AUDIO_RUNTIME.manager.className}::EnterZone/ExitZone (zone priority decides)
6. Create both .h and .cpp files for the setup helper only`;
}

/**
 * Builds a prompt to generate code from a natural-language soundscape description.
 */
export function buildSoundscapeNarrativePrompt(zone: AudioZone, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);

  const header = buildProjectContextHeader(ctx, {
    ...moduleKnowledge('audio'),
    extraRules: [
      GENERATE_THE_DIRECTLY,
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

${runtimeContractBlock(null, moduleName)}

INSTRUCTIONS:
1. Parse the description and identify individual sound elements (ambient loops, oneshot triggers, environmental effects)
2. For each identified sound, create a Sound Cue configuration with:
   - Appropriate randomization (pitch range, volume variation)
   - Spatial attenuation settings
   - Trigger conditions (constant loop, random interval, event-driven)
3. Add this zone as a ${AUDIO_RUNTIME.ambientLayer.className} layer (an FAmbientLayerConfig entry for ZoneName "${zone.name}", registered from a setup helper in Source/${moduleName}/Audio/) — no new soundscape class. The layer:
   - Manages all identified sounds as a cohesive soundscape
   - Crossfades through ${AUDIO_RUNTIME.ambientLayer.className}::CrossfadeToLayer when entering/exiting the zone
   - Uses UE5 Sound Cue randomization nodes (Random, Modulator)
4. Include UPROPERTY for each sound slot so designers can swap assets
5. Create both .h and .cpp files for the setup helper only`;
}
