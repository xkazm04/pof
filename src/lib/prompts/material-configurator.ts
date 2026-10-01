import { getModuleName, type ProjectContext } from '@/lib/prompt-context';
import { getEngineFacts, type EngineFacts } from '@/lib/engine-facts';
import { PromptBuilder } from '@/lib/prompts/prompt-builder';
import { GENERATE_ALL_DIRECTLY, USE_MATERIAL_BEST_PRACTICES, MATERIAL_UPROPERTY_TUNING } from '@/lib/prompts/_shared';
import type { MaterialConfiguratorConfig } from '@/components/modules/content/materials/MaterialParameterConfigurator';
import { moduleKnowledge } from '@/lib/prompts/module-knowledge';
import {
  SURFACE_SPEC, resolveShadingModel, shadingModelLabel, substrateQualifier, type RenderFeature,
} from '@/lib/materials/surface-spec';
import { estimateMaterialBudget, SAMPLER_HARD_LIMIT } from '@/lib/material-cost-estimator';

/**
 * The dispatched shading model — the SAME `resolveShadingModel` the Shader Budget
 * bar reports (surface + features, `lib/materials/surface-spec.ts`). The Substrate
 * half comes from the project's engine facts (`engine-facts.ts`) — never a
 * hard-coded "5.7+".
 */
function shadingModelLine(config: MaterialConfiguratorConfig, f: EngineFacts): string {
  const model = resolveShadingModel(config.surfaceType, config.features);
  const q = substrateQualifier(model);
  return `${shadingModelLabel(model)} (${f.substrateSlabHint}${q ? `, ${q}` : ''})`;
}

/**
 * The cost the designer tuned against in the Shader Budget bar, carried into the
 * prompt (as post-process carries its GPU budget) so the generated material is
 * held to it.
 */
function formatShaderBudget(config: MaterialConfiguratorConfig): string {
  const r = estimateMaterialBudget({ surfaceType: config.surfaceType, features: config.features });
  const { mapNotes } = SURFACE_SPEC[config.surfaceType].base;
  const sources = r.samplerBreakdown
    .map((b, i) => (i === 0 ? `${b.source} ${b.count} (${mapNotes})` : `${b.source} ${b.count}`))
    .join(', ');
  const warnings = r.warnings.length > 0
    ? r.warnings
      .map((w) => `- ${w.severity === 'error' ? 'Error' : 'Warning'}: ${w.message}${w.suggestion ? ` Cheaper: ${w.suggestion}` : ''}`)
      .join('\n')
    : '- No budget warnings.';
  return `### Shader Budget\n\n` +
    `**Samplers: ${r.samplers} of ${SAMPLER_HARD_LIMIT} · Instructions: ${r.instructionScore.toFixed(2)}× metal base**\n` +
    `- Sampler sources: ${sources}\n` +
    `${warnings}\n` +
    '- Keep the generated material within this budget: pack maps (ORM) instead of adding samplers, and compile optional features out behind static switches.';
}

function featureDetails(f: EngineFacts): Record<RenderFeature, string> {
  return {
    subsurface: 'Enable Subsurface Scattering: use a Subsurface Profile asset, set subsurface color and radius. Use the shading model named in Surface Configuration above.',
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
  const surfaceLabel = SURFACE_SPEC[config.surfaceType].promptLabel;
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
      `## Task: Create ${isMaster ? 'Master Material' : 'Material Instance'} — ${surfaceLabel}\n\n` +
      `### Surface Configuration\n` +
      `- Surface type: **${surfaceLabel}**\n` +
      `- Shading model: **${shadingModelLine(config, facts)}**\n` +
      `- Output type: **${isMaster ? 'Master Material (full shader)' : 'Material Instance (parameter-driven)'}**\n\n` +
      `### Parameter Defaults\n${paramLines}\n\n` +
      `### Rendering Features\n${featureLines}\n\n` +
      `${formatShaderBudget(config)}\n\n` +
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
