import { describe, it, expect } from 'vitest';
import { computeSemanticDiff } from '@/lib/blueprint-semantic-diff';
import type { BlueprintAsset, BlueprintGraph, BlueprintVariable } from '@/types/blueprint';

function variable(partial: Partial<BlueprintVariable> & { name: string }): BlueprintVariable {
  return {
    type: 'float',
    isExposedToEditor: false,
    isReplicated: false,
    isRepNotify: false,
    ...partial,
  };
}

function fnGraph(name: string, nodeCount = 0): BlueprintGraph {
  return {
    name,
    graphType: 'function',
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `n${i}`,
      type: 'K2Node_CallFunction',
      name: `n${i}`,
      pins: [],
      posX: 0,
      posY: 0,
    })),
  };
}

function asset(partial: Partial<BlueprintAsset> = {}): BlueprintAsset {
  return {
    className: 'BP_Player',
    parentClass: 'ACharacter',
    variables: [],
    functions: [],
    eventGraph: { name: 'EventGraph', graphType: 'event', nodes: [] },
    ...partial,
  };
}

describe('computeSemanticDiff', () => {
  // A realistic UE5 header — `parseHeader` needs the UCLASS/body wrapper to
  // brace-match the class and scope member/function extraction.
  const existingCpp = [
    'UCLASS()',
    'class MYGAME_API ABP_Player : public ACharacter',
    '{',
    '  GENERATED_BODY()',
    '',
    '  UPROPERTY(EditAnywhere)',
    '  int32 Health;',
    '',
    '  UPROPERTY()',
    '  FString CppOnly;',
    '',
    '  UFUNCTION(BlueprintCallable)',
    '  void DoStuff();',
    '};',
  ].join('\n');

  it('flags a type mismatch as a conflict-level modify change', () => {
    const result = computeSemanticDiff(
      asset({ variables: [variable({ name: 'Health', type: 'float' })] }),
      existingCpp,
      'P',
    );
    const change = result.changes.find((c) => c.name === 'Health');
    expect(change?.type).toBe('modify');
    expect(change?.conflictLevel).toBe('conflict');
    expect(change?.description).toContain('Blueprint uses float but C++ has int32');
    expect(result.overallConflict).toBe('conflict');
  });

  it('reports a Blueprint-only variable as a compatible add', () => {
    const result = computeSemanticDiff(
      asset({ variables: [variable({ name: 'Mana', type: 'int' })] }),
      'void DoStuff();',
      'P',
    );
    const change = result.changes.find((c) => c.name === 'Mana');
    expect(change?.type).toBe('add');
    expect(change?.scope).toBe('variable');
    expect(change?.conflictLevel).toBe('compatible');
    expect(change?.resolution).toContain('Add UPROPERTY int32 Mana');
  });

  it('reports a C++-only variable as a compatible remove', () => {
    const result = computeSemanticDiff(asset(), existingCpp, 'P');
    const change = result.changes.find((c) => c.name === 'CppOnly');
    expect(change?.type).toBe('remove');
    expect(change?.scope).toBe('variable');
    expect(change?.conflictLevel).toBe('compatible');
  });

  it('reports a Blueprint function missing from C++ as a compatible add', () => {
    const result = computeSemanticDiff(
      asset({ functions: [fnGraph('New Func', 3)] }),
      'void DoStuff();',
      'P',
    );
    const change = result.changes.find((c) => c.name === 'NewFunc');
    expect(change?.type).toBe('add');
    expect(change?.scope).toBe('function');
    // whitespace stripped, node count surfaced
    expect(change?.blueprintSide).toContain('NewFunc() — 3 nodes');
  });

  it('produces no changes and a none overall conflict for a matching pair', () => {
    const result = computeSemanticDiff(
      asset({ variables: [variable({ name: 'Health', type: 'int' })], functions: [fnGraph('DoStuff')] }),
      existingCpp,
      'P',
    );
    // Health is int32 in C++ and int (→ int32) in BP: no mismatch.
    // DoStuff exists on both sides. CppOnly remains as the only delta.
    expect(result.changes.every((c) => c.name === 'CppOnly')).toBe(true);
    expect(result.overallConflict).toBe('compatible');
  });

  it('summarises both sides and the detected counts', () => {
    const result = computeSemanticDiff(
      asset({ variables: [variable({ name: 'Health' })], functions: [fnGraph('A'), fnGraph('B')] }),
      existingCpp,
      'P',
    );
    expect(result.blueprintSummary).toBe('BP_Player: 1 variables, 2 functions, 0 event nodes');
    expect(result.cppSummary).toBe('1 functions, 2 properties detected');
  });

  it('uses the injected clock for the timestamp', () => {
    const result = computeSemanticDiff(asset(), '', 'P', 1234567890);
    expect(result.timestamp).toBe(1234567890);
  });

  // ── Accuracy improvements from reusing parseHeader ────────────────────────

  it('detects pointer- and template-typed UPROPERTY members the old regex missed', () => {
    const cpp = [
      'UCLASS()',
      'class MYGAME_API AThing : public AActor',
      '{',
      '  GENERATED_BODY()',
      '  UPROPERTY(VisibleAnywhere)',
      '  UStaticMeshComponent* Mesh;',
      '  UPROPERTY()',
      '  TArray<int32> Scores;',
      '};',
    ].join('\n');
    // Blueprint has neither, so each C++-only member surfaces as a remove.
    const result = computeSemanticDiff(asset(), cpp, 'P');
    const names = result.changes.filter((c) => c.type === 'remove').map((c) => c.name);
    expect(names).toContain('Mesh');
    expect(names).toContain('Scores');
    expect(result.cppSummary).toBe('0 functions, 2 properties detected');
  });

  it('ignores function signatures that appear only in comments (no phantom match)', () => {
    const cpp = [
      'UCLASS()',
      'class MYGAME_API APawnX : public APawn',
      '{',
      '  GENERATED_BODY()',
      '  // FVector GetLocation() is computed elsewhere — not a real declaration',
      '};',
    ].join('\n');
    // Comment-stripping means GetLocation is NOT seen as an existing C++ function,
    // so a Blueprint GetLocation is correctly flagged as a missing add.
    const result = computeSemanticDiff(
      asset({ functions: [fnGraph('GetLocation', 2)] }),
      cpp,
      'P',
    );
    const change = result.changes.find((c) => c.name === 'GetLocation');
    expect(change?.type).toBe('add');
    expect(change?.scope).toBe('function');
    expect(result.cppSummary).toBe('0 functions, 0 properties detected');
  });
});
