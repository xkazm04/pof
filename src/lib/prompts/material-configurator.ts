import { getModuleName, type ProjectContext } from '@/lib/prompt-context';
import { getEngineFacts, type EngineFacts } from '@/lib/engine-facts';
import { PromptBuilder } from '@/lib/prompts/prompt-builder';
import { GENERATE_ALL_DIRECTLY, USE_MATERIAL_BEST_PRACTICES, MATERIAL_UPROPERTY_TUNING } from '@/lib/prompts/_shared';
import type { MaterialConfiguratorConfig, SurfaceType, RenderFeature } from '@/components/modules/content/materials/MaterialParameterConfigurator';
import { moduleKnowledge } from '@/lib/prompts/module-knowledge';

const SURFACE_LABELS: Record<SurfaceType, string> = {
  metal: 'Metallic (PBR metal workflow)',
  cloth: 'Cloth / Fabric (fuzz, anisotropy)',
  skin: 'Skin (subsurface scattering profile)',
  glass: 'Glass (translucent, refractive)',
  water: 'Water (animated, depth-based)',
  emissive: 'Emissive (self-illuminated)',
  foliage: 'Foliage (two-sided, subsurface)',
  stone: 'Stone / Rock (parallax detail)',
};

/**
 * Shading-model guidance per surface. The Substrate half of each line comes from
 * the project's engine facts (`engine-facts.ts`) — never a hard-coded "5.7+".
 */
function surfaceShadingModel(f: EngineFacts): Record<SurfaceType, string> {
  const slab = f.substrateSlabHint;
  return {
    metal: `Default Lit (${slab})`,
    cloth: `Cloth (if available) or Subsurface (${slab}, with fuzz)`,
    skin: `Subsurface Profile (${slab}, with subsurface)`,
    glass: `Default Lit Translucent (${slab}, translucent)`,
    water: `Default Lit Translucent (${slab}, translucent)`,
    emissive: `Unlit or Default Lit with Emissive-only (${slab}, emissive)`,
    foliage: `Two Sided Foliage or Subsurface (${slab}, two-sided)`,
    stone: `Default Lit (${slab})`,
  };
}

function featureDetails(f: EngineFacts): Record<RenderFeature, string> {
  return {
    subsurface: 'Enable Subsurface Scattering: use a Subsurface Profile asset, set subsurface color and radius. Use Subsurface Profile shading model.',
    parallax: 'Enable Parallax Occlusion Mapping: use a heightmap texture, implement POM via Custom node or BumpOffset. Set min/max samples for quality vs performance.',
    emissive: 'Enable Emissive output: connect emissive color with intensity multiplier. Consider using a mask texture to control which regions glow.',
    refraction: 'Enable Refraction: set Blend Mode to Translucent, use Refraction input with IOR value. Consider using SceneColor for behind-surface sampling.',
    tessellation: f.naniteDisplacement,
    worldPositionOffset: 'Enable World Position Offset: add vertex animation for wind, waves, or breathing effects. Use Time + sine/cosine for organic motion.',
  };
}

export function buildMaterialConfiguratorPrompt(config: MaterialConfiguratorConfig, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const isMaster = config.outputType === 'master';
  const facts = getEngineFacts(ctx.ueVersion);
  const shadingModels = surfaceShadingModel(facts);
  const featureText = featureDetails(facts);

  const paramLines = Object.values(config.params)
    .map((p) => `  - ${p.name}: default=${p.defaultValue}, range=[${p.min} – ${p.max}], step=${p.step}`)
    .join('\n');

  const featureLines = config.features.length > 0
    ? config.features.map((f) => `- ${featureText[f]}`).join('\n')
    : '- No additional rendering features selected (standard PBR only).';

  const filesSection = isMaster
    ? `### Required Files (all under Source/${moduleName}/Materials/)\n\n` +
      `1. **M_${capitalize(config.surfaceType)}_Master** — Material setup instructions\n` +
      `   - Node graph description for the UE5 Material Editor\n` +
      `   - All parameters exposed as ScalarParameter / VectorParameter / StaticSwitchParameter\n` +
      `   - Texture inputs: BaseColor, Normal, Roughness map, and any surface-specific maps\n` +
      `   - Static switches for optional features (${config.features.map((f) => f).join(', ') || 'none'})\n` +
      `   - Proper material domain and blend mode for ${config.surfaceType}\n\n` +
      `2. **U${capitalize(config.surfaceType)}MaterialSetup** (UBlueprintFunctionLibrary)\n` +
      `   - Static helper to create and configure Dynamic Material Instances from the master\n` +
      `   - \`static UMaterialInstanceDynamic* Create${capitalize(config.surfaceType)}Material(UMeshComponent* Mesh)\`\n` +
      `   - Apply all default parameter values from the configuration above\n` +
      `   - UFUNCTION(BlueprintCallable, Category = "Materials|${capitalize(config.surfaceType)}")\n\n` +
      `3. **U${capitalize(config.surfaceType)}MaterialComponent** (UActorComponent)\n` +
      `   - Attach to any actor to auto-apply this material\n` +
      `   - UPROPERTY for each parameter (Roughness, Metallic, etc.) with defaults matching above\n` +
      `   - OnParameterChanged — updates the MID when properties change in editor or at runtime\n` +
      `   - Tick-driven animation if WorldPositionOffset or emissive flicker is enabled`
    : `### Required Files (all under Source/${moduleName}/Materials/)\n\n` +
      `1. **MI_${capitalize(config.surfaceType)}_Instance** — Material Instance setup\n` +
      `   - Instructions for creating a Material Instance from an existing master material\n` +
      `   - Override parameter values matching the configuration above\n` +
      `   - Document which master material features to enable via static switches\n\n` +
      `2. **U${capitalize(config.surfaceType)}InstanceHelper** (UBlueprintFunctionLibrary)\n` +
      `   - \`static UMaterialInstanceDynamic* Create${capitalize(config.surfaceType)}Instance(UMeshComponent* Mesh, UMaterialInterface* Parent)\`\n` +
      `   - Sets all parameter overrides from the config\n` +
      `   - Blueprint-callable for runtime creation\n` +
      `   - UFUNCTION(BlueprintCallable, Category = "Materials|${capitalize(config.surfaceType)}")\n\n` +
      `3. **U${capitalize(config.surfaceType)}MaterialComponent** (UActorComponent)\n` +
      `   - Simplified component that creates an instance on BeginPlay\n` +
      `   - UPROPERTY for tunable parameters only (skip switches)\n` +
      `   - TSoftObjectPtr<UMaterialInterface> for the parent master material (async load)`;

  return new PromptBuilder()
    .withProjectContext(ctx, {
      ...moduleKnowledge('materials'),
      extraRules: [
        GENERATE_ALL_DIRECTLY,
        USE_MATERIAL_BEST_PRACTICES,
        MATERIAL_UPROPERTY_TUNING,
        isMaster
          ? 'Generate a full Master Material with static switches and parameterized inputs.'
          : 'Generate a Material Instance Dynamic (MID) helper — NOT a full master material shader.',
      ],
    })
    .withRawTask(
      `## Task: Create ${isMaster ? 'Master Material' : 'Material Instance'} — ${SURFACE_LABELS[config.surfaceType]}\n\n` +
      `### Surface Configuration\n` +
      `- Surface type: **${SURFACE_LABELS[config.surfaceType]}**\n` +
      `- Shading model: **${shadingModels[config.surfaceType]}**\n` +
      `- Output type: **${isMaster ? 'Master Material (full shader)' : 'Material Instance (parameter-driven)'}**\n\n` +
      `### Parameter Defaults\n${paramLines}\n\n` +
      `### Rendering Features\n${featureLines}\n\n` +
      filesSection,
    )
    .withBestPractices([
      'Use UMaterialInstanceDynamic for ALL runtime parameter changes',
      'TSoftObjectPtr<UMaterialInterface> for base material references',
      'Material Parameter Collections for global shared parameters (time of day, weather)',
      isMaster
        ? 'Master Materials should use static switches to compile out unused features'
        : 'Material Instances are preferred for per-object variation — they share the compiled shader',
      'Group UPROPERTYs by category: "Material|Surface", "Material|Features"',
      'Include UPROPERTY metadata: ClampMin, ClampMax, UIMin, UIMax matching the parameter ranges above',
      facts.substrate,
      'CRITICAL UE5 authoring gotcha: a Constant3Vector expression\'s color output pin is "" (the empty string), NOT "RGB". connect_material_property(node, "RGB", ...) silently returns false and the material renders black. Use a VectorParameter for tunable colors (its output IS "RGB"), or pass "" when wiring a Constant3Vector.',
      'Prefer emitting a MaterialInstanceConstant of the shared master M_ARPG_Surface_Master over authoring a new one-off Material. Instances share the compiled shader, keep the project consolidated, and expose Albedo/Normal/Roughness texture params + BaseColorTint + TilingScale + EmissiveStrength.',
    ])
    .build();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
