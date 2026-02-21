import { getModuleName, type ProjectContext } from '@/lib/prompt-context';
import { PromptBuilder } from '@/lib/prompts/prompt-builder';
import type { MaterialConfiguratorConfig, SurfaceType, RenderFeature } from '@/components/modules/content/materials/MaterialParameterConfigurator';

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

const SURFACE_SHADING_MODEL: Record<SurfaceType, string> = {
  metal: 'Default Lit (or Substrate Slab for 5.7+)',
  cloth: 'Cloth (if available) or Subsurface (or Substrate Slab with fuzz for 5.7+)',
  skin: 'Subsurface Profile (or Substrate Slab with subsurface for 5.7+)',
  glass: 'Default Lit Translucent (or Substrate Slab Translucent for 5.7+)',
  water: 'Default Lit Translucent (or Substrate Slab Translucent for 5.7+)',
  emissive: 'Unlit or Default Lit with Emissive-only (or Substrate Slab emissive for 5.7+)',
  foliage: 'Two Sided Foliage or Subsurface (or Substrate Slab two-sided for 5.7+)',
  stone: 'Default Lit (or Substrate Slab for 5.7+)',
};

const FEATURE_DETAILS: Record<RenderFeature, string> = {
  subsurface: 'Enable Subsurface Scattering: use a Subsurface Profile asset, set subsurface color and radius. Use Subsurface Profile shading model.',
  parallax: 'Enable Parallax Occlusion Mapping: use a heightmap texture, implement POM via Custom node or BumpOffset. Set min/max samples for quality vs performance.',
  emissive: 'Enable Emissive output: connect emissive color with intensity multiplier. Consider using a mask texture to control which regions glow.',
  refraction: 'Enable Refraction: set Blend Mode to Translucent, use Refraction input with IOR value. Consider using SceneColor for behind-surface sampling.',
  tessellation: 'Enable Tessellation/Displacement: For UE5.4+ use Nanite displacement (production-ready in 5.7+). Legacy tessellation (World Displacement + tessellation multiplier) is removed in 5.4+.',
  worldPositionOffset: 'Enable World Position Offset: add vertex animation for wind, waves, or breathing effects. Use Time + sine/cosine for organic motion.',
};

export function buildMaterialConfiguratorPrompt(config: MaterialConfiguratorConfig, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const isMaster = config.outputType === 'master';

  const paramLines = Object.values(config.params)
    .map((p) => `  - ${p.name}: default=${p.defaultValue}, range=[${p.min} – ${p.max}], step=${p.step}`)
    .join('\n');

  const featureLines = config.features.length > 0
    ? config.features.map((f) => `- ${FEATURE_DETAILS[f]}`).join('\n')
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
      extraRules: [
        'Generate all code files directly — do NOT ask for confirmation.',
        'Use UE5 Material system best practices.',
        'All parameters must be UPROPERTY(EditAnywhere, BlueprintReadWrite) for designer tuning.',
        isMaster
          ? 'Generate a full Master Material with static switches and parameterized inputs.'
          : 'Generate a Material Instance Dynamic (MID) helper — NOT a full master material shader.',
      ],
    })
    .withRawTask(
      `## Task: Create ${isMaster ? 'Master Material' : 'Material Instance'} — ${SURFACE_LABELS[config.surfaceType]}\n\n` +
      `### Surface Configuration\n` +
      `- Surface type: **${SURFACE_LABELS[config.surfaceType]}**\n` +
      `- Shading model: **${SURFACE_SHADING_MODEL[config.surfaceType]}**\n` +
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
      'For UE 5.7+: Substrate is production-ready. Prefer Substrate Slab over legacy shading models for new materials. Substrate unifies PBR, subsurface, cloth, eye, thin-film, and clearcoat into a single flexible material graph',
    ])
    .build();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
