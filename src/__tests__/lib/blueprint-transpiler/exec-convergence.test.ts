import { describe, it, expect } from 'vitest';
import { generateNodeLogic } from '@/lib/blueprint-cpp-codegen';
import type { BlueprintNode, BlueprintPin, TranspileWarning } from '@/types/blueprint';

// A Branch whose Then and Else paths re-join at one node is the most common
// Blueprint shape there is ("do A or B, then C"). The walker used ONE visited
// set for the whole walk, so C was emitted under Then and silently skipped
// under Else: the generated C++ never ran C on the false path.

function pin(p: Partial<BlueprintPin> & { name: string; direction: 'input' | 'output' }): BlueprintPin {
  return { type: 'exec', ...p };
}

function setNode(id: string, member: string, value: string, next?: string): BlueprintNode {
  return {
    id, type: 'K2Node_VariableSet', name: `Set ${member}`, memberName: member, posX: 0, posY: 0,
    pins: [
      pin({ name: 'execute', direction: 'input' }),
      pin({ name: member, type: 'int', direction: 'input', defaultValue: value }),
      pin({ name: 'then', direction: 'output', linkedTo: next ? [next] : undefined }),
    ],
  };
}

function diamond(): { nodes: BlueprintNode[]; start: BlueprintNode } {
  const start: BlueprintNode = {
    id: 'ev', type: 'K2Node_Event', name: 'BeginPlay', memberName: 'BeginPlay', posX: 0, posY: 0,
    pins: [pin({ name: 'then', direction: 'output', linkedTo: ['br'] })],
  };
  const branch: BlueprintNode = {
    id: 'br', type: 'K2Node_IfThenElse', name: 'Branch', posX: 0, posY: 0,
    pins: [
      pin({ name: 'execute', direction: 'input' }),
      pin({ name: 'Condition', type: 'bool', direction: 'input', defaultValue: 'true' }),
      pin({ name: 'Then', direction: 'output', linkedTo: ['a'] }),
      pin({ name: 'Else', direction: 'output', linkedTo: ['b'] }),
    ],
  };
  const nodes = [start, branch, setNode('a', 'A', '1', 'c'), setNode('b', 'B', '2', 'c'), setNode('c', 'C', '3')];
  return { nodes, start };
}

function elseBlock(code: string): string {
  const lines = code.split('\n');
  const at = lines.findIndex((l) => l.trim() === 'else');
  expect(at, 'an else block is emitted').toBeGreaterThan(-1);
  const out: string[] = [];
  let depth = 0;
  for (const l of lines.slice(at + 1)) {
    if (l.trim() === '{') { depth++; if (depth === 1) continue; }
    if (l.trim() === '}') { depth--; if (depth === 0) break; }
    out.push(l);
  }
  return out.join('\n');
}

describe('generateNodeLogic — exec paths that converge after a Branch', () => {
  it('emits the shared tail on BOTH paths, not only under Then', () => {
    const { nodes, start } = diamond();
    const warnings: TranspileWarning[] = [];
    const code = generateNodeLogic({ nodes }, start, 'ATest', warnings);
    const elseCode = elseBlock(code);
    expect(elseCode).toContain('B = 2;');
    expect(elseCode).toContain('C = 3;');
    expect(code.split('\n').filter((l) => l.trim() === 'C = 3;')).toHaveLength(2);
  });

  it('still terminates on an exec cycle (a node already on the current path is not re-entered)', () => {
    const loopA = setNode('a', 'A', '1', 'b');
    const loopB = setNode('b', 'B', '2', 'a');
    const code = generateNodeLogic({ nodes: [loopA, loopB] }, loopA, 'ATest', []);
    expect(code.split('\n').filter((l) => l.trim() === 'A = 1;')).toHaveLength(1);
  });

  it('warns once per refused node even when its subtree is re-emitted on both paths', () => {
    const { nodes, start } = diamond();
    nodes[4] = { ...nodes[4], type: 'K2Node_Timeline', name: 'Fade' };
    const warnings: TranspileWarning[] = [];
    generateNodeLogic({ nodes }, start, 'ATest', warnings);
    expect(warnings.filter((w) => w.nodeId === 'c')).toHaveLength(1);
  });
});
