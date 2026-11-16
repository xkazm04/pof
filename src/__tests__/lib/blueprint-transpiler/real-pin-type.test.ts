import { describe, it, expect } from 'vitest';
import { blueprintTypeToCpp, parseBlueprintJson } from '@/lib/blueprint-parser';
import { generateCppFromBlueprint } from '@/lib/blueprint-cpp-codegen';

// Since UE 5.0 a Blueprint "Float" is PinCategory `real` (PinSubCategory
// `float` | `double`). The type map had no `real` entry, so it fell through to
// the pass-through fallback and the header declared `real Speed;` — a type
// that does not exist in C++. The codegen's own literal check already knew
// `real` is numeric; the type map did not.

describe('UE5 `real` pin category', () => {
  it('maps `real` to a C++ floating type', () => {
    expect(blueprintTypeToCpp('real')).toBe('double');
    expect(blueprintTypeToCpp('Array<real>')).toBe('TArray<double>');
  });

  it('keeps the export PinSubCategory precision for a real pin', () => {
    const asset = parseBlueprintJson({
      ClassName: 'BP_Mover',
      Graphs: [{
        GraphName: 'Move', GraphType: 'Function',
        Nodes: [{
          NodeGuid: 'e', NodeClass: 'K2Node_FunctionEntry',
          Pins: [{ PinName: 'Speed', PinType: { PinCategory: 'real', PinSubCategory: 'float' }, Direction: 'EGPD_Output' }],
        }],
      }],
    });
    expect(asset.functions[0].nodes[0].pins[0].type).toBe('float');
  });

  it('never declares a `real` member or parameter in the generated header', () => {
    const asset = parseBlueprintJson({
      ClassName: 'BP_Mover',
      Variables: [{ VarName: 'Speed', VarType: { PinCategory: 'real' } }],
      Graphs: [{
        GraphName: 'Move', GraphType: 'Function',
        Nodes: [{
          NodeGuid: 'e', NodeClass: 'K2Node_FunctionEntry',
          Pins: [{ PinName: 'Delta', PinType: { PinCategory: 'real' }, Direction: 'EGPD_Output' }],
        }],
      }],
    });
    const { headerCode } = generateCppFromBlueprint(asset, 'Game');
    expect(headerCode).not.toMatch(/\breal\b/);
    expect(headerCode).toContain('double Speed;');
    expect(headerCode).toContain('void Move(double Delta);');
  });
});
