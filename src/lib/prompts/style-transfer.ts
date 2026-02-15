import { buildProjectContextHeader, getModuleName, type ProjectContext } from '@/lib/prompt-context';
import type { StyleTransferConfig, AnalyzedProperties } from '@/components/modules/content/materials/MaterialStyleTransfer';

const SURFACE_SHADING: Record<string, string> = {
  metal: 'Default Lit (PBR metal workflow)',
  cloth: 'Cloth or Subsurface',
  skin: 'Subsurface Profile',
  glass: 'Default Lit (Translucent blend mode)',
  water: 'Default Lit (Translucent blend mode)',
  emissive: 'Unlit or Default Lit with Emissive',
  foliage: 'Two Sided Foliage or Subsurface',
  stone: 'Default Lit',
};

function formatAnalysis(a: AnalyzedProperties): string {
  const lines = [
    `- Detected surface type: **${a.surfaceType}** (${(a.surfaceConfidence * 100).toFixed(0)}% confidence)`,
    `- Shading model: **${SURFACE_SHADING[a.surfaceType] ?? 'Default Lit'}**`,
    `- Description: ${a.description}`,
    '',
    '### Extracted Material Properties',
    `- Roughness: ${a.roughness.toFixed(2)} (range 0-1)`,
    `- Metallic: ${a.metallic.toFixed(2)} (range 0-1)`,
    `- Emissive Intensity: ${a.emissiveIntensity.toFixed(1)} (range 0-20)`,
    `- Subsurface Presence: ${a.subsurfacePresence.toFixed(2)} (0=none, 1=strong)`,
    `- Parallax Depth: ${a.parallaxDepth.toFixed(3)} (range 0-0.2)`,
    `- Opacity: ${a.opacity.toFixed(2)} (range 0-1)`,
  ];

  if (a.features.length > 0) {
    lines.push(`- Rendering features: ${a.features.join(', ')}`);
  }

  if (a.colorPalette.length > 0) {
    lines.push(`- Color palette: ${a.colorPalette.join(', ')}`);
  }

  return lines.join('\n');
}

export function buildStyleTransferPrompt(config: StyleTransferConfig, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate all code files directly — do NOT ask for confirmation.',
      'Use UE5 Material system best practices.',
      'All parameters must be UPROPERTY(EditAnywhere, BlueprintReadWrite) for designer tuning.',
      'This is a style-transfer task: replicate the visual look as closely as possible.',
      'Generate a full Master Material with parameterized inputs matching the analyzed properties.',
    ],
  });

  const analysis = config.analysis;
  const analysisSection = analysis
    ? formatAnalysis(analysis)
    : `- No automated analysis available. Use the description below to infer material properties.`;

  const descSection = config.referenceDescription
    ? `\n### User Description\n${config.referenceDescription}`
    : '';

  const imageNote = config.imageDataUrl
    ? '\n**Note:** A reference image was provided and analyzed. The properties above were extracted from it.'
    : '\n**Note:** No reference image was provided. Properties were inferred from the text description.';

  const surfaceType = analysis?.surfaceType ?? 'stone';
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return `${header}

## Task: Create Material from Style Reference — ${capitalize(surfaceType)} Surface

Create a UE5 material that replicates the visual look described below. The material properties were extracted from a reference screenshot and/or user description.

### Analyzed Visual Properties
${analysisSection}${imageNote}${descSection}

### Required Files (all under Source/${moduleName}/Materials/)

1. **M_StyleTransfer_${capitalize(surfaceType)}_Master** — Material setup instructions
   - Complete node graph for the UE5 Material Editor
   - All analyzed parameters exposed as ScalarParameter / VectorParameter
   - Color palette implemented via a tint parameter or LUT
   - Texture inputs: BaseColor, Normal, Roughness map, and surface-specific maps
   - Static switches for optional features (${analysis?.features.join(', ') || 'none'})
   - Proper material domain and blend mode for ${surfaceType}

2. **U${capitalize(surfaceType)}StyleMaterialSetup** (UBlueprintFunctionLibrary)
   - Static helper to create and configure Dynamic Material Instances
   - \`static UMaterialInstanceDynamic* CreateStyleMaterial(UMeshComponent* Mesh)\`
   - Apply all parameter values from the analysis above as defaults
   - UFUNCTION(BlueprintCallable, Category = "Materials|StyleTransfer")

3. **U${capitalize(surfaceType)}StyleMaterialComponent** (UActorComponent)
   - Attach to any actor to auto-apply this material
   - UPROPERTY for each analyzed parameter with defaults matching analysis
   - OnParameterChanged — updates the MID when properties change
   - Runtime tweaking support for iterative refinement

### Color Palette Implementation
Use the extracted colors to set up:
- Base color tint from the dominant color
- Emissive color from the brightest/most saturated color (if emissive)
- Subsurface color from warm tones (if subsurface present)
- Create a MaterialParameterCollection with these colors for global access

### UE5 Best Practices
- Match the reference visual as closely as possible with standard PBR inputs
- Use Material Parameter Collections for colors that may be shared across materials
- UMaterialInstanceDynamic for ALL runtime parameter changes
- TSoftObjectPtr<UMaterialInterface> for base material references
- If the reference has animated elements (scrolling, flickering), implement via Custom HLSL node with Time input
- Group UPROPERTYs: "Material|Surface", "Material|Color", "Material|Features"
- Include UPROPERTY metadata: ClampMin, ClampMax matching the parameter ranges`;
}
