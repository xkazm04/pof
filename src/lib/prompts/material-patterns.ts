import { buildProjectContextHeader, getModuleName, type ProjectContext } from '@/lib/prompt-context';
import type { MaterialPattern } from '@/components/modules/content/materials/MaterialPatternCatalog';

export function buildMaterialPatternPrompt(pattern: MaterialPattern, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate all code files directly — do NOT ask for confirmation.',
      'Use UE5 Material system best practices with UPROPERTY-exposed parameters.',
      'Create both C++ helper classes and material setup instructions.',
    ],
  });

  return `${header}

## Task: Generate ${pattern.name} Material System

### Effect Description
${pattern.description}

### Technical Approach
${pattern.approach}

### HLSL Reference
\`\`\`hlsl
${pattern.hlslSnippet}
\`\`\`

### Tags
${pattern.tags.join(', ')}

### Required Files (all under Source/${moduleName}/Materials/)

1. **Material Parameter Collection (MPC)**
   - Create a UMaterialParameterCollection or C++ helper that exposes all dynamic parameters
   - Parameters should match the HLSL reference above (e.g., Time, Intensity, Color values)
   - All parameters UPROPERTY(EditAnywhere, BlueprintReadWrite) for designer tuning

2. **Material Function Library (C++ Helper)**
   - U${pattern.name.replace(/[^a-zA-Z0-9]/g, '')}MaterialHelper (UBlueprintFunctionLibrary)
   - Static functions to create and configure Dynamic Material Instances at runtime
   - SetupMaterial(UMeshComponent*) — creates and assigns the dynamic material instance
   - UpdateParameters(UMaterialInstanceDynamic*, float DeltaTime) — animates time-based params
   - All functions UFUNCTION(BlueprintCallable, Category = "Materials|${pattern.name}")

3. **Material Setup Blueprint Instructions**
   - Step-by-step instructions for creating the material in the UE5 Material Editor
   - Node graph description matching the HLSL reference
   - Which material domain and blend mode to use
   - Texture slot descriptions and recommended texture types

4. **Actor Component (optional but recommended)**
   - U${pattern.name.replace(/[^a-zA-Z0-9]/g, '')}MaterialComponent (UActorComponent)
   - Attach to any actor to auto-apply and animate the material
   - Tick-driven parameter updates for animated effects
   - Exposed UPROPERTY parameters for per-instance customization

### UE5 Best Practices
- Use UMaterialInstanceDynamic for runtime parameter changes
- TSoftObjectPtr<UMaterialInterface> for base material reference (async loading)
- Material Parameter Collections for global parameters shared across instances
- Expose key parameters to Blueprint with sensible defaults
- Include UPROPERTY(Category) grouping for clean Details panel
- Add editor-time preview support where possible`;
}
