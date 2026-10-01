import { getModuleName, type ProjectContext } from '@/lib/prompt-context';
import { getEngineFacts, type EngineFacts } from '@/lib/engine-facts';
import { PromptBuilder } from '@/lib/prompts/prompt-builder';
import { GENERATE_ALL_DIRECTLY, USE_MATERIAL_BEST_PRACTICES, MATERIAL_UPROPERTY_TUNING } from '@/lib/prompts/_shared';
import type { MaterialConfiguratorConfig } from '@/components/modules/content/materials/MaterialParameterConfigurator';
import type { ParentMaterialRef, ParentScalar } from '@/components/modules/content/materials/MaterialParameterConfigurator/types';
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

const list = (names: string[]): string => (names.length > 0 ? names.join(', ') : 'none');

function parentScalar(s: ParentScalar): string {
  return s.defaultValue === null
    ? `${s.name} (no numeric default in the manifest)`
    : `${s.name} (parent default ${s.defaultValue}, range [${s.min} – ${s.max}])`;
}

/**
 * The instance's Required Files when it targets a live UE master (bridge
 * manifest): the parent is named and its EXACT parameter set is the only thing
 * the instance may override — the engine-side material is the authority.
 */
function parentInstanceFiles(p: ParentMaterialRef, moduleName: string, surface: string): string {
  const scalars = p.scalars.length > 0 ? p.scalars.map(parentScalar).join(', ') : 'none';
  return `### Required Files (all under Source/${moduleName}/Materials/)\n\n` +
    `1. **MI_${surface}_Instance** — Material Instance of \`${p.path}\`\n` +
    `   - Parent: \`${p.path}\` — a live master in this project (read from the UE bridge manifest); create a MaterialInstanceConstant of exactly this asset\n` +
    `   - Override only the parameters this parent exposes:\n` +
    `     - Scalars: ${scalars}\n` +
    `     - Vectors: ${list(p.vectors)}\n` +
    `     - Textures: ${list(p.textures)}\n` +
    `     - Static switches: ${list(p.switches)}\n` +
    `   - Never add, rename or invent a parameter the parent does not expose; anything not set under Parameter Defaults keeps the parent's value\n\n` +
    `2. **U${surface}InstanceHelper** (UBlueprintFunctionLibrary)\n` +
    `   - \`static UMaterialInstanceDynamic* Create${surface}Instance(UMeshComponent* Mesh, UMaterialInterface* Parent)\`\n` +
    `   - Sets only the overrides above, by these exact parameter names\n` +
    `   - Blueprint-callable for runtime creation\n` +
    `   - UFUNCTION(BlueprintCallable, Category = "Materials|${surface}")\n\n` +
    `3. **U${surface}MaterialComponent** (UActorComponent)\n` +
    `   - Simplified component that creates an instance on BeginPlay\n` +
    `   - UPROPERTY for tunable parameters only (skip switches)\n` +
    `   - TSoftObjectPtr<UMaterialInterface> for the parent, defaulting to \`${p.path}\` (async load)`;
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
  // A live parent applies to an instance only; absent, the prompt is byte-identical to before.
  const parent = isMaster ? undefined : config.parentMaterial;

  const paramLines = Object.values(config.params)
    .map((p) => `  - ${p.name}: default=${p.defaultValue}, range=[${p.min} – ${p.max}], step=${p.step}`)
    .join('\n');

  const featureLines = config.features.length > 0
    ? config.features.map((f) => `- ${featureText[f]}`).join('\n')
    : '- No additional rendering features selected (standard PBR only).';

  const filesSection = parent
    ? parentInstanceFiles(parent, moduleName, capitalize(config.surfaceType))
    : isMaster
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
      parent
        ? `Emit a MaterialInstanceConstant of the live master ${parent.path} over authoring a new one-off Material or parenting to any other master. Instances share the compiled shader and keep the project consolidated.`
        : 'Prefer emitting a MaterialInstanceConstant of the shared master M_ARPG_Surface_Master over authoring a new one-off Material. Instances share the compiled shader, keep the project consolidated, and expose Albedo/Normal/Roughness texture params + BaseColorTint + TilingScale + EmissiveStrength.',
    ])
    .build();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
