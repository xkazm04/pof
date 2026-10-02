/**
 * Transpile residue: every node the transpiler did not turn into code is named,
 * with its reason, and a refused one points at its `// TODO` stub.
 *
 * The fidelity readout used to be derived from the warning list, so anything
 * the walker never reached (a refused Branch's whole subtree, the chain behind
 * an unknown event, orphans, pure drivers) raised nothing and counted as
 * translated: the door below read "7 of 9 nodes translated" with zero
 * statements emitted. The walker now writes a per-node ledger
 * (emitted / consumed / structural / refused / unreached) and the readout,
 * the residue list and the stub locator are all read from it.
 *
 * Standard: ai-registry game-production/visual-script-to-code-transpilation —
 * golden path "leave the residue where it happened", failure mode "reporting
 * coverage as correctness"; structural-round-trip-diff step 3 (stamp a stable
 * node id at emit time) and step 5 (a node not evaluated is "not measured").
 */
import { describe, it, expect } from 'vitest';
import { parseBlueprintJson } from '@/lib/blueprint-parser';
import { describeTranspileFidelity, generateCppFromBlueprint } from '@/lib/blueprint-cpp-codegen';
import { buildResidue, locateStub } from '@/lib/blueprint-transpiler/residue';
import { SAMPLE_BLUEPRINT } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/constants';
import type { BlueprintAsset, TranspileResult } from '@/types/blueprint';

/**
 * BeginPlay -> Branch whose Condition is driven by a math node, Then/Else ->
 * two VariableSets; unknown event ReceiveActorBeginOverlap -> Timeline; a
 * custom event; an orphan CallFunction.
 */
const DOOR_BLUEPRINT = {
  ClassName: 'BP_Door',
  ParentClass: 'AActor',
  Variables: [
    { VarName: 'bOpen', VarType: 'bool', PropertyFlags: ['CPF_Net'] },
    { VarName: 'Hp', VarType: 'float', PropertyFlags: ['CPF_RepNotify'] },
  ],
  Graphs: [{
    GraphName: 'EventGraph',
    GraphType: 'event',
    Nodes: [
      { NodeGuid: 'e1', NodeClass: 'K2Node_Event', MemberName: 'ReceiveBeginPlay', Pins: [{ PinName: 'then', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output', LinkedTo: ['b1'] }] },
      { NodeGuid: 'm1', NodeClass: 'K2Node_CommutativeAssociativeBinaryOperator', Pins: [{ PinName: 'ReturnValue', PinType: { PinCategory: 'bool' }, Direction: 'EGPD_Output', LinkedTo: ['b1'] }] },
      {
        NodeGuid: 'b1',
        NodeClass: 'K2Node_IfThenElse',
        Pins: [
          { PinName: 'execute', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Input' },
          { PinName: 'Condition', PinType: { PinCategory: 'bool' }, Direction: 'EGPD_Input', LinkedTo: ['m1'] },
          { PinName: 'Then', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output', LinkedTo: ['s1'] },
          { PinName: 'Else', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output', LinkedTo: ['s2'] },
        ],
      },
      { NodeGuid: 's1', NodeClass: 'K2Node_VariableSet', MemberName: 'bOpen', Pins: [{ PinName: 'execute', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Input' }, { PinName: 'bOpen', PinType: { PinCategory: 'bool' }, Direction: 'EGPD_Input', DefaultValue: 'true' }] },
      { NodeGuid: 's2', NodeClass: 'K2Node_VariableSet', MemberName: 'bOpen', Pins: [{ PinName: 'execute', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Input' }, { PinName: 'bOpen', PinType: { PinCategory: 'bool' }, Direction: 'EGPD_Input', DefaultValue: 'false' }] },
      { NodeGuid: 'x1', NodeClass: 'K2Node_Event', MemberName: 'ReceiveActorBeginOverlap', Pins: [{ PinName: 'then', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output', LinkedTo: ['t1'] }] },
      { NodeGuid: 't1', NodeClass: 'K2Node_Timeline', Pins: [] },
      { NodeGuid: 'c1', NodeClass: 'K2Node_CustomEvent', Name: 'OpenDoor', MemberName: 'OpenDoor', Pins: [] },
      { NodeGuid: 'o1', NodeClass: 'K2Node_CallFunction', MemberName: 'Orphan', Pins: [] },
    ],
  }],
};

function transpile(json: string | object): TranspileResult {
  return generateCppFromBlueprint(parseBlueprintJson(json), 'PoF');
}

function dispositions(result: TranspileResult): Record<string, string> {
  return Object.fromEntries((result.nodeLedger ?? []).map((e) => [e.nodeId, e.disposition]));
}

describe('the node ledger — every node gets a disposition', () => {
  it('door: counts dispositions, not warnings (0 of 7 translated, 2 refused, 5 never reached)', () => {
    const f = describeTranspileFidelity(transpile(DOOR_BLUEPRINT));
    expect(f).toMatchObject({ total: 7, translated: 0, refused: 2, unreached: 5 });
    expect(f.label).toBe('0 of 7 nodes translated · 2 refused · 5 never reached');
  });

  it('door: structural events, refused branch + unknown event, the rest unreached — no node absent', () => {
    const result = transpile(DOOR_BLUEPRINT);
    expect(dispositions(result)).toEqual({
      e1: 'structural', c1: 'structural',
      b1: 'refused', x1: 'refused',
      m1: 'unreached', s1: 'unreached', s2: 'unreached', t1: 'unreached', o1: 'unreached',
    });
    const byId = new Map((result.nodeLedger ?? []).map((e) => [e.nodeId, e]));
    // The refusal carries the walker's own reason, not a generic one.
    expect(byId.get('b1')?.reason).toContain('branch not emitted');
    expect(byId.get('b1')?.reason).toContain('K2Node_CommutativeAssociativeBinaryOperator');
    expect(byId.get('x1')?.reason).toContain('ReceiveActorBeginOverlap');
  });

  it('shipped sample: n2 emitted, f2 refused, events/entry structural — "1 of 2 nodes translated · 1 refused"', () => {
    const result = transpile(SAMPLE_BLUEPRINT);
    expect(dispositions(result)).toEqual({
      n1: 'structural', n2: 'emitted', n3: 'structural', f1: 'structural', f2: 'refused',
    });
    expect(describeTranspileFidelity(result).label).toBe('1 of 2 nodes translated · 1 refused');
  });

  it('a VariableGet feeding an emitted call is consumed and counts as translated', () => {
    const asset: BlueprintAsset = {
      className: 'BP_T', parentClass: 'AActor', variables: [], functions: [],
      eventGraph: {
        name: 'EventGraph', graphType: 'event',
        nodes: [
          { id: 'ev', type: 'K2Node_Event', name: 'BeginPlay', memberName: 'BeginPlay', posX: 0, posY: 0,
            pins: [{ name: 'then', type: 'exec', direction: 'output', linkedTo: ['call'] }] },
          { id: 'call', type: 'K2Node_CallFunction', name: 'Apply', memberName: 'Apply', posX: 0, posY: 0,
            pins: [
              { name: 'execute', type: 'exec', direction: 'input' },
              { name: 'Amount', type: 'float', direction: 'input', linkedTo: ['get'] },
            ] },
          { id: 'get', type: 'K2Node_VariableGet', name: 'Get Health', memberName: 'Health', posX: 0, posY: 0,
            pins: [{ name: 'Health', type: 'float', direction: 'output', linkedTo: ['call'] }] },
        ],
      },
    };
    const result = generateCppFromBlueprint(asset, 'PoF');
    expect(result.sourceCode).toContain('Apply(Health);');
    expect(dispositions(result)).toEqual({ ev: 'structural', call: 'emitted', get: 'consumed' });
    expect(describeTranspileFidelity(result).label).toBe('2 of 2 nodes translated');
  });
});

describe('locateStub — the stub carries the node id', () => {
  it('finds the 1-based line of a refused node\'s // TODO; an unreached node has no stub', () => {
    const result = transpile(DOOR_BLUEPRINT);
    const line = locateStub(result.sourceCode, 'b1');
    expect(line).not.toBeNull();
    const text = result.sourceCode.split('\n')[(line as number) - 1];
    expect(text).toContain('// TODO: [K2Node_IfThenElse] Branch (node b1)');
    expect(locateStub(result.sourceCode, 's1')).toBeNull();
  });
});

describe('buildResidue — the worklist', () => {
  it('lists refused first, then unreached, each with a label, reason and location', () => {
    const result = transpile(DOOR_BLUEPRINT);
    const residue = buildResidue(result);
    expect(residue.map((r) => r.disposition)).toEqual([
      'refused', 'refused', 'unreached', 'unreached', 'unreached', 'unreached', 'unreached',
    ]);
    const b1 = residue.find((r) => r.nodeId === 'b1');
    expect(b1).toMatchObject({
      nodeId: 'b1', label: '[K2Node_IfThenElse] Branch', disposition: 'refused',
      file: 'source', line: locateStub(result.sourceCode, 'b1'),
    });
    expect(b1?.reason).toContain('branch not emitted');
    // Every refused entry is one click from a stub; unreached entries have none.
    for (const r of residue.filter((x) => x.disposition === 'refused')) expect(r.line).toEqual(expect.any(Number));
    for (const r of residue.filter((x) => x.disposition === 'unreached')) {
      expect(r.line).toBeNull();
      expect(r.reason.length).toBeGreaterThan(0);
    }
    // The unknown event's stub is the override TODO in the header — that line
    // is pinned byte-identical by the member-model guard, so it is located by name.
    const x1 = residue.find((r) => r.nodeId === 'x1');
    expect(x1?.file).toBe('header');
    expect(result.headerCode.split('\n')[(x1?.line as number) - 1]).toContain('// TODO: Override for ReceiveActorBeginOverlap');
  });

  it('[guard] a result with no ledger (older payload) yields an empty worklist', () => {
    const legacy = { ...transpile(DOOR_BLUEPRINT), nodeLedger: undefined };
    expect(buildResidue(legacy)).toEqual([]);
  });
});
