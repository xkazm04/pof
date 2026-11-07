import { describe, it, expect } from 'vitest';
import { parseBlueprintJson } from '@/lib/blueprint-parser';
import { deriveCppSurface } from '@/lib/blueprint-cpp-surface';
import { generateCppFromBlueprint } from '@/lib/blueprint-cpp-codegen';

// A Blueprint variable with "Instance Editable" unticked — the default — is
// exported as CPF_Edit + CPF_DisableEditOnInstance. The parser collapsed every
// CPF_Edit into one boolean and the surface always emitted EditAnywhere, so the
// C++ widened every such property to per-instance editing. The glossary's own
// CPF_Edit entry says it maps to EditAnywhere / EditDefaultsOnly.

function specifiersFor(flags: string[]): string[] {
  const asset = parseBlueprintJson({ ClassName: 'BP_T', Variables: [{ VarName: 'Speed', VarType: 'float', PropertyFlags: flags }] });
  return deriveCppSurface(asset).properties[0].specifiers;
}

describe('UPROPERTY edit scope from CPF flags', () => {
  it('CPF_Edit + CPF_DisableEditOnInstance -> EditDefaultsOnly', () => {
    const s = specifiersFor(['CPF_Edit', 'CPF_DisableEditOnInstance']);
    expect(s).toContain('EditDefaultsOnly');
    expect(s).not.toContain('EditAnywhere');
  });

  it('CPF_Edit + CPF_DisableEditOnTemplate -> EditInstanceOnly', () => {
    expect(specifiersFor(['CPF_Edit', 'CPF_DisableEditOnTemplate'])).toContain('EditInstanceOnly');
  });

  it('CPF_Edit alone stays EditAnywhere; no CPF_Edit stays unexposed', () => {
    expect(specifiersFor(['CPF_Edit'])).toContain('EditAnywhere');
    expect(specifiersFor([]).some((x) => x.startsWith('Edit'))).toBe(false);
  });

  it('the header carries the narrowed specifier', () => {
    const asset = parseBlueprintJson({ ClassName: 'BP_T', Variables: [{ VarName: 'Speed', VarType: 'float', PropertyFlags: ['CPF_Edit', 'CPF_DisableEditOnInstance'] }] });
    expect(generateCppFromBlueprint(asset, 'Game').headerCode).toContain('UPROPERTY(EditDefaultsOnly, BlueprintReadWrite)');
  });
});
