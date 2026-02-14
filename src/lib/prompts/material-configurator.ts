import { buildProjectContextHeader, getModuleName, type ProjectContext } from '@/lib/prompt-context';
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
  metal: 'Default Lit',
  cloth: 'Cloth (if available) or Subsurface',
  skin: 'Subsurface Profile',
  glass: 'Default Lit (Translucent blend mode)',
  water: 'Default Lit (Translucent blend mode)',
  emissive: 'Unlit or Default Lit with Emissive-only',
  foliage: 'Two Sided Foliage or Subsurface',
  stone: 'Default Lit',
};

const FEATURE_DETAILS: Record<RenderFeature, string> = {
  subsurface: 'Enable Subsurface Scattering: use a Subsurface Profile asset, set subsurface color and radius. Use Subsurface Profile shading model.',
  parallax: 'Enable Parallax Occlusion Mapping: use a heightmap texture, implement POM via Custom node or BumpOffset. Set min/max samples for quality vs performance.',
  emissive: 'Enable Emissive output: connect emissive color with intensity multiplier. Consider using a mask texture to control which regions glow.',
  refraction: 'Enable Refraction: set Blend Mode to Translucent, use Refraction input with IOR value. Consider using SceneColor for behind-surface sampling.',
  tessellation: 'Enable Tessellation/Displacement: For UE5.4+ use Nanite displacement. For older versions use World Displacement + tessellation multiplier.',
  worldPositionOffset: 'Enable World Position Offset: add vertex animation for wind, waves, or breathing effects. Use Time + sine/cosine for organic motion.',
};

export function buildMaterialConfiguratorPrompt(config: MaterialConfiguratorConfig, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate all code files directly — do NOT ask for confirmation.',
      'Use UE5 Material system best practices.',
      'All parameters must be UPROPERTY(EditAnywhere, BlueprintReadWrite) for designer tuning.',
      config.outputType === 'instance'
        ? 'Generate a Material Instance Dynamic (MID) helper — NOT a full master material shader.'
        : 'Generate a full Master Material with static switches and parameterized inputs.',
    ],
  });

  const paramLines = Object.values(config.params)
    .map((p) => `  - ${p.name}: default=${p.defaultValue}, range=[${p.min} – ${p.max}], step=${p.step}`)
    .join('\n');

  const featureLines = config.features.length > 0
    ? config.features.map((f) => `- ${FEATURE_DETAILS[f]}`).join('\n')
    : '- No additional rendering features selected (standard PBR only).';

  const isMaster = config.outputType === 'master';

  return `${header}

## Task: Create ${isMaster ? 'Master Material' : 'Material Instance'} — ${SURFACE_LABELS[config.surfaceType]}

### Surface Configuration
- Surface type: **${SURFACE_LABELS[config.surfaceType]}**
- Shading model: **${SURFACE_SHADING_MODEL[config.surfaceType]}**
- Output type: **${isMaster ? 'Master Material (full shader)' : 'Material Instance (parameter-driven)'}**

### Parameter Defaults
${paramLines}

### Rendering Features
${featureLines}

### Required Files (all under Source/${moduleName}/Materials/)

${isMaster ? `1. **M_${capitalize(config.surfaceType)}_Master** — Material setup instructions
   - Node graph description for the UE5 Material Editor
   - All parameters exposed as ScalarParameter / VectorParameter / StaticSwitchParameter
   - Texture inputs: BaseColor, Normal, Roughness map, and any surface-specific maps
   - Static switches for optional features (${config.features.map((f) => f).join(', ') || 'none'})
   - Proper material domain and blend mode for ${config.surfaceType}

2. **U${capitalize(config.surfaceType)}MaterialSetup** (UBlueprintFunctionLibrary)
   - Static helper to create and configure Dynamic Material Instances from the master
   - \`static UMaterialInstanceDynamic* Create${capitalize(config.surfaceType)}Material(UMeshComponent* Mesh)\`
   - Apply all default parameter values from the configuration above
   - UFUNCTION(BlueprintCallable, Category = "Materials|${capitalize(config.surfaceType)}")

3. **U${capitalize(config.surfaceType)}MaterialComponent** (UActorComponent)
   - Attach to any actor to auto-apply this material
   - UPROPERTY for each parameter (Roughness, Metallic, etc.) with defaults matching above
   - OnParameterChanged — updates the MID when properties change in editor or at runtime
   - Tick-driven animation if WorldPositionOffset or emissive flicker is enabled` :

`1. **MI_${capitalize(config.surfaceType)}_Instance** — Material Instance setup
   - Instructions for creating a Material Instance from an existing master material
   - Override parameter values matching the configuration above
   - Document which master material features to enable via static switches

2. **U${capitalize(config.surfaceType)}InstanceHelper** (UBlueprintFunctionLibrary)
   - \`static UMaterialInstanceDynamic* Create${capitalize(config.surfaceType)}Instance(UMeshComponent* Mesh, UMaterialInterface* Parent)\`
   - Sets all parameter overrides from the config
   - Blueprint-callable for runtime creation
   - UFUNCTION(BlueprintCallable, Category = "Materials|${capitalize(config.surfaceType)}")

3. **U${capitalize(config.surfaceType)}MaterialComponent** (UActorComponent)
   - Simplified component that creates an instance on BeginPlay
   - UPROPERTY for tunable parameters only (skip switches)
   - TSoftObjectPtr<UMaterialInterface> for the parent master material (async load)`}

### UE5 Best Practices
- Use UMaterialInstanceDynamic for ALL runtime parameter changes
- TSoftObjectPtr<UMaterialInterface> for base material references
- Material Parameter Collections for global shared parameters (time of day, weather)
- ${config.outputType === 'instance' ? 'Material Instances are preferred for per-object variation — they share the compiled shader' : 'Master Materials should use static switches to compile out unused features'}
- Group UPROPERTYs by category: "Material|Surface", "Material|Features"
- Include UPROPERTY metadata: ClampMin, ClampMax, UIMin, UIMax matching the parameter ranges above`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
