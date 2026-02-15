/**
 * Audio Scene → UE5 C++ Code Generator
 *
 * Transforms AudioSceneDocument data into production-ready C++ source files:
 * - USoundAttenuation assets with distance curves
 * - UReverbEffect presets with decay/diffusion params
 * - AAudioVolume placement code with occlusion settings
 * - AmbientSound actor spawners from emitter definitions
 * - MetaSounds integration for procedural ambient layers
 */

import type {
  AudioSceneDocument,
  AudioZone,
  SoundEmitter,
  ReverbPreset,
  OcclusionMode,
  EmitterType,
} from '@/types/audio-scene';

// ─── Generated file structure ─────────────────────────────────────────────────

export interface GeneratedFile {
  filename: string;
  language: 'cpp' | 'h';
  category: 'attenuation' | 'reverb' | 'volume' | 'emitter' | 'metasound' | 'manager';
  content: string;
  lineCount: number;
}

export interface CodeGenResult {
  files: GeneratedFile[];
  stats: {
    totalFiles: number;
    totalLines: number;
    zonesProcessed: number;
    emittersProcessed: number;
    reverbPresetsUsed: string[];
    occlusionModesUsed: string[];
  };
}

// ─── Reverb parameter mapping ─────────────────────────────────────────────────

const REVERB_PARAMS: Record<ReverbPreset, { decayTime: number; diffusion: number; density: number; wetDry: number; earlyDelay: number; lateDelay: number }> = {
  'none':             { decayTime: 0.0, diffusion: 0.0, density: 0.0, wetDry: 0.0, earlyDelay: 0.0, lateDelay: 0.0 },
  'small-room':       { decayTime: 0.8, diffusion: 0.7, density: 0.8, wetDry: 0.3, earlyDelay: 0.005, lateDelay: 0.012 },
  'large-hall':       { decayTime: 2.5, diffusion: 0.9, density: 0.6, wetDry: 0.5, earlyDelay: 0.02, lateDelay: 0.04 },
  'cave':             { decayTime: 3.5, diffusion: 0.5, density: 0.9, wetDry: 0.6, earlyDelay: 0.03, lateDelay: 0.06 },
  'outdoor':          { decayTime: 0.3, diffusion: 1.0, density: 0.2, wetDry: 0.15, earlyDelay: 0.001, lateDelay: 0.005 },
  'underwater':       { decayTime: 4.0, diffusion: 0.3, density: 1.0, wetDry: 0.8, earlyDelay: 0.04, lateDelay: 0.08 },
  'metal-corridor':   { decayTime: 1.8, diffusion: 0.4, density: 0.7, wetDry: 0.45, earlyDelay: 0.008, lateDelay: 0.02 },
  'stone-chamber':    { decayTime: 2.2, diffusion: 0.6, density: 0.85, wetDry: 0.5, earlyDelay: 0.015, lateDelay: 0.035 },
  'forest':           { decayTime: 0.6, diffusion: 0.95, density: 0.3, wetDry: 0.2, earlyDelay: 0.002, lateDelay: 0.008 },
  'custom':           { decayTime: 1.0, diffusion: 0.5, density: 0.5, wetDry: 0.3, earlyDelay: 0.01, lateDelay: 0.02 },
};

// ─── Occlusion mapping ────────────────────────────────────────────────────────

const OCCLUSION_VALUES: Record<OcclusionMode, { volume: number; lpf: number }> = {
  'none':   { volume: 1.0, lpf: 20000.0 },
  'low':    { volume: 0.85, lpf: 12000.0 },
  'medium': { volume: 0.6, lpf: 5000.0 },
  'high':   { volume: 0.35, lpf: 2000.0 },
  'full':   { volume: 0.1, lpf: 500.0 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

function pascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function makeFile(filename: string, language: 'cpp' | 'h', category: GeneratedFile['category'], content: string): GeneratedFile {
  return { filename, language, category, content, lineCount: content.split('\n').length };
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateAudioCode(doc: AudioSceneDocument, moduleName: string, apiMacro: string): CodeGenResult {
  const files: GeneratedFile[] = [];
  const reverbPresetsUsed = new Set<string>();
  const occlusionModesUsed = new Set<string>();

  // 1. Reverb presets data asset
  const usedPresets = new Set<ReverbPreset>();
  usedPresets.add(doc.globalReverbPreset);
  for (const zone of doc.zones) {
    usedPresets.add(zone.reverbPreset);
    reverbPresetsUsed.add(zone.reverbPreset);
    occlusionModesUsed.add(zone.occlusionMode);
  }
  files.push(generateReverbPresetsHeader(usedPresets, apiMacro));
  files.push(generateReverbPresetsCpp(usedPresets, moduleName));

  // 2. Sound attenuation settings per zone
  files.push(generateAttenuationHeader(doc.zones, apiMacro));
  files.push(generateAttenuationCpp(doc.zones, moduleName));

  // 3. Audio volume placement code
  files.push(generateAudioVolumeHeader(doc, apiMacro));
  files.push(generateAudioVolumeCpp(doc, moduleName));

  // 4. Ambient sound spawner from emitters
  if (doc.emitters.length > 0) {
    files.push(generateEmitterSpawnerHeader(doc, apiMacro));
    files.push(generateEmitterSpawnerCpp(doc, moduleName));
  }

  // 5. MetaSounds integration for procedural ambient
  const proceduralZones = doc.zones.filter(z => z.soundscapeDescription.trim().length > 0);
  if (proceduralZones.length > 0) {
    files.push(generateMetaSoundHeader(proceduralZones, apiMacro));
    files.push(generateMetaSoundCpp(proceduralZones, moduleName));
  }

  // 6. Scene manager that ties it all together
  files.push(generateSceneManagerHeader(doc, apiMacro));
  files.push(generateSceneManagerCpp(doc, moduleName));

  return {
    files,
    stats: {
      totalFiles: files.length,
      totalLines: files.reduce((sum, f) => sum + f.lineCount, 0),
      zonesProcessed: doc.zones.length,
      emittersProcessed: doc.emitters.length,
      reverbPresetsUsed: [...reverbPresetsUsed],
      occlusionModesUsed: [...occlusionModesUsed],
    },
  };
}

// ─── 1. Reverb Presets ────────────────────────────────────────────────────────

function generateReverbPresetsHeader(presets: Set<ReverbPreset>, apiMacro: string): GeneratedFile {
  const enumValues = [...presets].filter(p => p !== 'none').map(p => `\t${safeName(p).replace(/-/g, '_')} UMETA(DisplayName = "${p}")`).join(',\n');

  const content = `// Auto-generated from POF Audio Scene Editor
#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Sound/ReverbEffect.h"
#include "AudioReverbPresets.generated.h"

UENUM(BlueprintType)
enum class EAudioReverbPreset : uint8
{
	None UMETA(DisplayName = "None"),
${enumValues}
};

USTRUCT(BlueprintType)
struct FAudioReverbConfig
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	EAudioReverbPreset Preset = EAudioReverbPreset::None;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="0.0", ClampMax="10.0"))
	float DecayTime = 1.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="0.0", ClampMax="1.0"))
	float Diffusion = 0.5f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="0.0", ClampMax="1.0"))
	float Density = 0.5f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="0.0", ClampMax="1.0"))
	float WetDryMix = 0.3f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	float EarlyDelay = 0.01f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	float LateDelay = 0.02f;
};

UCLASS(BlueprintType)
class ${apiMacro} UAudioReverbPresets : public UDataAsset
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reverb")
	TMap<EAudioReverbPreset, FAudioReverbConfig> Presets;

	UFUNCTION(BlueprintCallable, Category = "Reverb")
	FAudioReverbConfig GetPresetConfig(EAudioReverbPreset Preset) const;

	static void InitializeDefaults(UAudioReverbPresets* Asset);
};
`;
  return makeFile('AudioReverbPresets.h', 'h', 'reverb', content);
}

function generateReverbPresetsCpp(presets: Set<ReverbPreset>, moduleName: string): GeneratedFile {
  const initEntries = [...presets].filter(p => p !== 'none').map(p => {
    const params = p === 'custom' ? REVERB_PARAMS['custom'] : REVERB_PARAMS[p];
    const enumName = safeName(p).replace(/-/g, '_');
    return `\t{
\t\tFAudioReverbConfig Config;
\t\tConfig.Preset = EAudioReverbPreset::${enumName};
\t\tConfig.DecayTime = ${params.decayTime}f;
\t\tConfig.Diffusion = ${params.diffusion}f;
\t\tConfig.Density = ${params.density}f;
\t\tConfig.WetDryMix = ${params.wetDry}f;
\t\tConfig.EarlyDelay = ${params.earlyDelay}f;
\t\tConfig.LateDelay = ${params.lateDelay}f;
\t\tAsset->Presets.Add(EAudioReverbPreset::${enumName}, Config);
\t}`;
  }).join('\n');

  const content = `// Auto-generated from POF Audio Scene Editor
#include "AudioReverbPresets.h"

FAudioReverbConfig UAudioReverbPresets::GetPresetConfig(EAudioReverbPreset Preset) const
{
\tif (const FAudioReverbConfig* Found = Presets.Find(Preset))
\t{
\t\treturn *Found;
\t}
\treturn FAudioReverbConfig();
}

void UAudioReverbPresets::InitializeDefaults(UAudioReverbPresets* Asset)
{
\tif (!Asset) return;
\tAsset->Presets.Empty();

${initEntries}
}
`;
  return makeFile('AudioReverbPresets.cpp', 'cpp', 'reverb', content);
}

// ─── 2. Sound Attenuation ─────────────────────────────────────────────────────

function generateAttenuationHeader(zones: AudioZone[], apiMacro: string): GeneratedFile {
  const content = `// Auto-generated from POF Audio Scene Editor
#pragma once

#include "CoreMinimal.h"
#include "Sound/SoundAttenuation.h"
#include "AudioZoneAttenuation.generated.h"

UCLASS(BlueprintType)
class ${apiMacro} UAudioZoneAttenuation : public UDataAsset
{
\tGENERATED_BODY()

public:
\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Attenuation")
\tTMap<FName, USoundAttenuation*> ZoneAttenuations;

\tUFUNCTION(BlueprintCallable, Category = "Attenuation")
\tUSoundAttenuation* GetAttenuationForZone(FName ZoneName) const;

\tstatic USoundAttenuation* CreateAttenuationAsset(UObject* Outer, FName ZoneName, float InnerRadius, float FalloffDistance);
};
`;
  return makeFile('AudioZoneAttenuation.h', 'h', 'attenuation', content);
}

function generateAttenuationCpp(zones: AudioZone[], moduleName: string): GeneratedFile {
  const zoneInits = zones.map(zone => {
    const name = safeName(zone.name);
    const inner = Math.max(zone.attenuationRadius * 0.3, 50);
    return `\t// Zone: ${zone.name} (${zone.reverbPreset}, radius: ${zone.attenuationRadius}uu)
\t{
\t\tUSoundAttenuation* Att = CreateAttenuationAsset(this, FName(TEXT("${name}")), ${inner.toFixed(0)}.f, ${zone.attenuationRadius.toFixed(0)}.f);
\t\tZoneAttenuations.Add(FName(TEXT("${name}")), Att);
\t}`;
  }).join('\n');

  const content = `// Auto-generated from POF Audio Scene Editor
#include "AudioZoneAttenuation.h"

USoundAttenuation* UAudioZoneAttenuation::GetAttenuationForZone(FName ZoneName) const
{
\tif (USoundAttenuation* const* Found = ZoneAttenuations.Find(ZoneName))
\t{
\t\treturn *Found;
\t}
\treturn nullptr;
}

USoundAttenuation* UAudioZoneAttenuation::CreateAttenuationAsset(UObject* Outer, FName ZoneName, float InnerRadius, float FalloffDistance)
{
\tUSoundAttenuation* Attenuation = NewObject<USoundAttenuation>(Outer, ZoneName);
\tFSoundAttenuationSettings& Settings = Attenuation->Attenuation;

\tSettings.bAttenuate = true;
\tSettings.bSpatialize = true;
\tSettings.bAttenuateWithLPF = true;

\t// Natural logarithmic falloff curve
\tSettings.AttenuationShape = EAttenuationShape::Sphere;
\tSettings.FalloffMode = ENaturalSoundFalloffMode::Logarithmic;
\tSettings.AttenuationShapeExtents = FVector(InnerRadius, 0.f, 0.f);
\tSettings.ConeOffset = 0.f;
\tSettings.FalloffDistance = FalloffDistance;

\t// Low-pass filter for distance
\tSettings.LPFRadiusMin = InnerRadius;
\tSettings.LPFRadiusMax = FalloffDistance;
\tSettings.LPFFrequencyAtMin = 20000.f;
\tSettings.LPFFrequencyAtMax = 2000.f;

\treturn Attenuation;
}
`;
  return makeFile('AudioZoneAttenuation.cpp', 'cpp', 'attenuation', content);
}

// ─── 3. Audio Volume Placement ────────────────────────────────────────────────

function generateAudioVolumeHeader(doc: AudioSceneDocument, apiMacro: string): GeneratedFile {
  const content = `// Auto-generated from POF Audio Scene Editor
#pragma once

#include "CoreMinimal.h"
#include "Sound/AudioVolume.h"
#include "AudioReverbPresets.h"
#include "SceneAudioVolume.generated.h"

UCLASS(BlueprintType)
class ${apiMacro} ASceneAudioVolume : public AAudioVolume
{
\tGENERATED_BODY()

public:
\tASceneAudioVolume();

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio Zone")
\tFName ZoneName;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio Zone")
\tEAudioReverbPreset ReverbPreset = EAudioReverbPreset::None;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio Zone", meta=(ClampMin="0", ClampMax="10"))
\tint32 ZonePriority = 5;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio Zone", meta=(ClampMin="0.0", ClampMax="1.0"))
\tfloat OcclusionVolumeMultiplier = 1.0f;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio Zone")
\tfloat OcclusionLPFCutoff = 20000.0f;

\tUFUNCTION(BlueprintCallable, Category = "Audio Zone")
\tvoid ApplyReverbSettings(const UAudioReverbPresets* PresetAsset);

protected:
\tvirtual void BeginPlay() override;
};
`;
  return makeFile('SceneAudioVolume.h', 'h', 'volume', content);
}

function generateAudioVolumeCpp(doc: AudioSceneDocument, moduleName: string): GeneratedFile {
  // Generate a spawn helper comment block for each zone
  const zoneSpawnBlocks = doc.zones.map(zone => {
    const name = safeName(zone.name);
    const preset = safeName(zone.reverbPreset).replace(/-/g, '_');
    const occ = OCCLUSION_VALUES[zone.occlusionMode];
    return `/*
 * Zone: ${zone.name}
 * Shape: ${zone.shape}, Reverb: ${zone.reverbPreset}, Occlusion: ${zone.occlusionMode}
 * Position: (${zone.x}, ${zone.y}), Attenuation: ${zone.attenuationRadius}uu, Priority: ${zone.priority}
 *
 * Spawn in level blueprint or construction script:
 *   ASceneAudioVolume* Vol_${name} = GetWorld()->SpawnActor<ASceneAudioVolume>(...);
 *   Vol_${name}->ZoneName = FName(TEXT("${name}"));
 *   Vol_${name}->ReverbPreset = EAudioReverbPreset::${zone.reverbPreset === 'none' ? 'None' : preset};
 *   Vol_${name}->ZonePriority = ${zone.priority};
 *   Vol_${name}->OcclusionVolumeMultiplier = ${occ.volume}f;
 *   Vol_${name}->OcclusionLPFCutoff = ${occ.lpf}f;
 */`;
  }).join('\n\n');

  const content = `// Auto-generated from POF Audio Scene Editor
#include "SceneAudioVolume.h"
#include "Components/AudioComponent.h"

ASceneAudioVolume::ASceneAudioVolume()
{
\tPrimaryActorTick.bCanEverTick = false;
}

void ASceneAudioVolume::BeginPlay()
{
\tSuper::BeginPlay();

\t// Apply reverb priority from zone settings
\tGetRootComponent()->SetMobility(EComponentMobility::Static);

\tFReverbSettings& Reverb = GetReverbSettings();
\tReverb.bApplyReverb = (ReverbPreset != EAudioReverbPreset::None);
\tReverb.Volume = 1.0f;

\t// Apply zone priority
\tSetPriority(ZonePriority);
}

void ASceneAudioVolume::ApplyReverbSettings(const UAudioReverbPresets* PresetAsset)
{
\tif (!PresetAsset) return;

\tFAudioReverbConfig Config = PresetAsset->GetPresetConfig(ReverbPreset);
\tFReverbSettings& Reverb = GetReverbSettings();

\tReverb.bApplyReverb = true;
\tReverb.Volume = Config.WetDryMix;

\t// Apply reverb effect parameters
\tif (UReverbEffect* Effect = NewObject<UReverbEffect>(this))
\t{
\t\tEffect->Density = Config.Density;
\t\tEffect->Diffusion = Config.Diffusion;
\t\tEffect->DecayTime = Config.DecayTime;
\t\tEffect->LateDelay = Config.LateDelay;
\t\tReverb.ReverbEffect = Effect;
\t}
}

// ─── Zone Spawn Reference ─────────────────────────────────────────────────────
// Copy these blocks to your level blueprint or construction script.

${zoneSpawnBlocks}
`;
  return makeFile('SceneAudioVolume.cpp', 'cpp', 'volume', content);
}

// ─── 4. Emitter Spawner ───────────────────────────────────────────────────────

function generateEmitterSpawnerHeader(doc: AudioSceneDocument, apiMacro: string): GeneratedFile {
  const content = `// Auto-generated from POF Audio Scene Editor
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Components/AudioComponent.h"
#include "Sound/SoundCue.h"
#include "SceneEmitterSpawner.generated.h"

USTRUCT(BlueprintType)
struct FEmitterDefinition
{
\tGENERATED_BODY()

\tUPROPERTY(EditAnywhere, BlueprintReadWrite)
\tFName EmitterName;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite)
\tTSoftObjectPtr<USoundCue> SoundCue;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite)
\tFVector WorldPosition = FVector::ZeroVector;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="0.0", ClampMax="2.0"))
\tfloat VolumeMultiplier = 1.0f;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="0.5", ClampMax="2.0"))
\tfloat PitchMin = 0.95f;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="0.5", ClampMax="2.0"))
\tfloat PitchMax = 1.05f;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="0.0", ClampMax="1.0"))
\tfloat SpawnChance = 1.0f;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="0.0"))
\tfloat CooldownSeconds = 0.0f;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite)
\tfloat AttenuationRadius = 500.0f;
};

UCLASS(BlueprintType)
class ${apiMacro} ASceneEmitterSpawner : public AActor
{
\tGENERATED_BODY()

public:
\tASceneEmitterSpawner();

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Emitters")
\tTArray<FEmitterDefinition> EmitterDefinitions;

\tUFUNCTION(BlueprintCallable, Category = "Emitters")
\tvoid SpawnAllEmitters();

\tUFUNCTION(BlueprintCallable, Category = "Emitters")
\tvoid StopAllEmitters();

protected:
\tvirtual void BeginPlay() override;

private:
\tTArray<UAudioComponent*> ActiveComponents;
\tTMap<FName, float> LastPlayTime;

\tvoid SpawnEmitter(const FEmitterDefinition& Def);
\tbool CheckCooldown(const FEmitterDefinition& Def) const;
};
`;
  return makeFile('SceneEmitterSpawner.h', 'h', 'emitter', content);
}

function generateEmitterSpawnerCpp(doc: AudioSceneDocument, moduleName: string): GeneratedFile {
  const EMITTER_SCALE = 50; // Canvas units → UE world units
  const emitterDefs = doc.emitters.map(em => {
    const name = safeName(em.name);
    const cueRef = em.soundCueRef || `/Game/Audio/SC_${pascalCase(em.name)}`;
    return `\t{
\t\tFEmitterDefinition Def;
\t\tDef.EmitterName = FName(TEXT("${name}"));
\t\tDef.SoundCue = TSoftObjectPtr<USoundCue>(FSoftObjectPath(TEXT("${cueRef}")));
\t\tDef.WorldPosition = FVector(${(em.x * EMITTER_SCALE).toFixed(0)}.f, ${(em.y * EMITTER_SCALE).toFixed(0)}.f, 0.f);
\t\tDef.VolumeMultiplier = ${em.volumeMultiplier.toFixed(2)}f;
\t\tDef.PitchMin = ${em.pitchMin.toFixed(2)}f;
\t\tDef.PitchMax = ${em.pitchMax.toFixed(2)}f;
\t\tDef.SpawnChance = ${em.spawnChance.toFixed(2)}f;
\t\tDef.CooldownSeconds = ${em.cooldownSeconds.toFixed(1)}f;
\t\tDef.AttenuationRadius = ${em.attenuationRadius.toFixed(0)}.f;
\t\tEmitterDefinitions.Add(Def);
\t}`;
  }).join('\n');

  const content = `// Auto-generated from POF Audio Scene Editor
#include "SceneEmitterSpawner.h"

ASceneEmitterSpawner::ASceneEmitterSpawner()
{
\tPrimaryActorTick.bCanEverTick = false;
\tRootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

void ASceneEmitterSpawner::BeginPlay()
{
\tSuper::BeginPlay();

\t// Populate emitter definitions from scene data
${emitterDefs}

\tSpawnAllEmitters();
}

void ASceneEmitterSpawner::SpawnAllEmitters()
{
\tfor (const FEmitterDefinition& Def : EmitterDefinitions)
\t{
\t\tif (FMath::FRand() <= Def.SpawnChance)
\t\t{
\t\t\tSpawnEmitter(Def);
\t\t}
\t}
}

void ASceneEmitterSpawner::StopAllEmitters()
{
\tfor (UAudioComponent* Comp : ActiveComponents)
\t{
\t\tif (Comp && Comp->IsPlaying())
\t\t{
\t\t\tComp->FadeOut(0.5f, 0.f);
\t\t}
\t}
\tActiveComponents.Empty();
}

void ASceneEmitterSpawner::SpawnEmitter(const FEmitterDefinition& Def)
{
\tif (!CheckCooldown(Def)) return;

\tUSoundCue* Cue = Def.SoundCue.LoadSynchronous();
\tif (!Cue) return;

\tUAudioComponent* AudioComp = NewObject<UAudioComponent>(this);
\tAudioComp->SetupAttachment(RootComponent);
\tAudioComp->SetRelativeLocation(Def.WorldPosition);
\tAudioComp->SetSound(Cue);
\tAudioComp->VolumeMultiplier = Def.VolumeMultiplier;
\tAudioComp->PitchMultiplier = FMath::RandRange(Def.PitchMin, Def.PitchMax);
\tAudioComp->bAutoActivate = true;
\tAudioComp->bAutoDestroy = false;
\tAudioComp->RegisterComponent();
\tAudioComp->Play();

\tActiveComponents.Add(AudioComp);
\tLastPlayTime.Add(Def.EmitterName, GetWorld()->GetTimeSeconds());
}

bool ASceneEmitterSpawner::CheckCooldown(const FEmitterDefinition& Def) const
{
\tif (Def.CooldownSeconds <= 0.f) return true;
\tif (const float* LastTime = LastPlayTime.Find(Def.EmitterName))
\t{
\t\treturn (GetWorld()->GetTimeSeconds() - *LastTime) >= Def.CooldownSeconds;
\t}
\treturn true;
}
`;
  return makeFile('SceneEmitterSpawner.cpp', 'cpp', 'emitter', content);
}

// ─── 5. MetaSounds Integration ────────────────────────────────────────────────

function generateMetaSoundHeader(zones: AudioZone[], apiMacro: string): GeneratedFile {
  const content = `// Auto-generated from POF Audio Scene Editor
// MetaSounds integration for procedural ambient layers
#pragma once

#include "CoreMinimal.h"
#include "MetasoundSource.h"
#include "Components/AudioComponent.h"
#include "ProceduralAmbientLayer.generated.h"

USTRUCT(BlueprintType)
struct FAmbientLayerConfig
{
\tGENERATED_BODY()

\tUPROPERTY(EditAnywhere, BlueprintReadWrite)
\tFName ZoneName;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite)
\tFString SoundscapeDescription;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite)
\tTSoftObjectPtr<UMetaSoundSource> MetaSoundSource;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="0.0", ClampMax="1.0"))
\tfloat CrossfadeDuration = 1.5f;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="0.0", ClampMax="1.0"))
\tfloat WetMix = 0.3f;
};

UCLASS(BlueprintType)
class ${apiMacro} UProceduralAmbientManager : public UActorComponent
{
\tGENERATED_BODY()

public:
\tUProceduralAmbientManager();

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ambient Layers")
\tTArray<FAmbientLayerConfig> LayerConfigs;

\tUFUNCTION(BlueprintCallable, Category = "Ambient Layers")
\tvoid ActivateLayer(FName ZoneName);

\tUFUNCTION(BlueprintCallable, Category = "Ambient Layers")
\tvoid DeactivateLayer(FName ZoneName, float FadeOutDuration = 1.0f);

\tUFUNCTION(BlueprintCallable, Category = "Ambient Layers")
\tvoid CrossfadeToLayer(FName FromZone, FName ToZone);

private:
\tTMap<FName, UAudioComponent*> ActiveLayers;
};
`;
  return makeFile('ProceduralAmbientLayer.h', 'h', 'metasound', content);
}

function generateMetaSoundCpp(zones: AudioZone[], moduleName: string): GeneratedFile {
  const layerConfigs = zones.map(zone => {
    const name = safeName(zone.name);
    return `\t{
\t\tFAmbientLayerConfig Config;
\t\tConfig.ZoneName = FName(TEXT("${name}"));
\t\tConfig.SoundscapeDescription = TEXT("${zone.soundscapeDescription.replace(/"/g, '\\"').replace(/\n/g, ' ')}");
\t\tConfig.CrossfadeDuration = ${(zone.reverbDecayTime * 0.5).toFixed(1)}f;
\t\tConfig.WetMix = ${zone.reverbWetDry.toFixed(2)}f;
\t\tLayerConfigs.Add(Config);
\t}`;
  }).join('\n');

  const content = `// Auto-generated from POF Audio Scene Editor
// MetaSounds procedural ambient layers
#include "ProceduralAmbientLayer.h"

UProceduralAmbientManager::UProceduralAmbientManager()
{
\tPrimaryComponentTick.bCanEverTick = false;

\t// Initialize layer configs from scene data
${layerConfigs}
}

void UProceduralAmbientManager::ActivateLayer(FName ZoneName)
{
\tif (ActiveLayers.Contains(ZoneName)) return;

\tconst FAmbientLayerConfig* Config = LayerConfigs.FindByPredicate(
\t\t[ZoneName](const FAmbientLayerConfig& C) { return C.ZoneName == ZoneName; });
\tif (!Config) return;

\tUMetaSoundSource* Source = Config->MetaSoundSource.LoadSynchronous();
\tif (!Source) return;

\tAActor* Owner = GetOwner();
\tif (!Owner) return;

\tUAudioComponent* AudioComp = NewObject<UAudioComponent>(Owner);
\tAudioComp->SetupAttachment(Owner->GetRootComponent());
\tAudioComp->SetSound(Source);
\tAudioComp->VolumeMultiplier = 0.f;
\tAudioComp->RegisterComponent();
\tAudioComp->Play();

\t// Fade in
\tAudioComp->AdjustVolume(Config->CrossfadeDuration, Config->WetMix);

\tActiveLayers.Add(ZoneName, AudioComp);
}

void UProceduralAmbientManager::DeactivateLayer(FName ZoneName, float FadeOutDuration)
{
\tif (UAudioComponent** Found = ActiveLayers.Find(ZoneName))
\t{
\t\tif (*Found)
\t\t{
\t\t\t(*Found)->FadeOut(FadeOutDuration, 0.f);
\t\t}
\t\tActiveLayers.Remove(ZoneName);
\t}
}

void UProceduralAmbientManager::CrossfadeToLayer(FName FromZone, FName ToZone)
{
\tconst FAmbientLayerConfig* ToConfig = LayerConfigs.FindByPredicate(
\t\t[ToZone](const FAmbientLayerConfig& C) { return C.ZoneName == ToZone; });
\tfloat Duration = ToConfig ? ToConfig->CrossfadeDuration : 1.0f;

\tDeactivateLayer(FromZone, Duration);
\tActivateLayer(ToZone);
}
`;
  return makeFile('ProceduralAmbientLayer.cpp', 'cpp', 'metasound', content);
}

// ─── 6. Scene Manager ─────────────────────────────────────────────────────────

function generateSceneManagerHeader(doc: AudioSceneDocument, apiMacro: string): GeneratedFile {
  const content = `// Auto-generated from POF Audio Scene Editor — Scene: ${doc.name}
#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "AudioReverbPresets.h"
#include "AudioSceneManager.generated.h"

UCLASS()
class ${apiMacro} UAudioSceneManager : public UGameInstanceSubsystem
{
\tGENERATED_BODY()

public:
\tvirtual void Initialize(FSubsystemCollectionBase& Collection) override;

\tUPROPERTY()
\tTObjectPtr<UAudioReverbPresets> ReverbPresets;

\tUFUNCTION(BlueprintCallable, Category = "Audio Scene")
\tvoid EnterZone(FName ZoneName);

\tUFUNCTION(BlueprintCallable, Category = "Audio Scene")
\tvoid ExitZone(FName ZoneName);

\tUFUNCTION(BlueprintCallable, Category = "Audio Scene")
\tint32 GetSoundPoolSize() const { return SoundPoolSize; }

\tUFUNCTION(BlueprintCallable, Category = "Audio Scene")
\tint32 GetMaxConcurrentSounds() const { return MaxConcurrentSounds; }

private:
\tint32 SoundPoolSize = ${doc.soundPoolSize};
\tint32 MaxConcurrentSounds = ${doc.maxConcurrentSounds};
\tFName CurrentZone = NAME_None;
};
`;
  return makeFile('AudioSceneManager.h', 'h', 'manager', content);
}

function generateSceneManagerCpp(doc: AudioSceneDocument, moduleName: string): GeneratedFile {
  const content = `// Auto-generated from POF Audio Scene Editor — Scene: ${doc.name}
#include "AudioSceneManager.h"

void UAudioSceneManager::Initialize(FSubsystemCollectionBase& Collection)
{
\tSuper::Initialize(Collection);

\t// Load reverb presets data asset
\tReverbPresets = NewObject<UAudioReverbPresets>(this);
\tUAudioReverbPresets::InitializeDefaults(ReverbPresets);

\tUE_LOG(LogTemp, Log, TEXT("AudioSceneManager initialized: pool=%d, maxConcurrent=%d"),
\t\tSoundPoolSize, MaxConcurrentSounds);
}

void UAudioSceneManager::EnterZone(FName ZoneName)
{
\tif (CurrentZone == ZoneName) return;

\tUE_LOG(LogTemp, Log, TEXT("Entering audio zone: %s"), *ZoneName.ToString());
\tCurrentZone = ZoneName;

\t// TODO: Trigger MetaSounds crossfade and reverb transition
\t// ProceduralAmbientManager->CrossfadeToLayer(PreviousZone, ZoneName);
}

void UAudioSceneManager::ExitZone(FName ZoneName)
{
\tif (CurrentZone != ZoneName) return;

\tUE_LOG(LogTemp, Log, TEXT("Exiting audio zone: %s"), *ZoneName.ToString());
\tCurrentZone = NAME_None;
}
`;
  return makeFile('AudioSceneManager.cpp', 'cpp', 'manager', content);
}
