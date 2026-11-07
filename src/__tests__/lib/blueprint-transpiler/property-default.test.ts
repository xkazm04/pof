import { describe, it, expect } from 'vitest';
import { generateCppFromBlueprint } from '@/lib/blueprint-cpp-codegen';
import type { BlueprintAsset, BlueprintVariable } from '@/types/blueprint';

// Pin defaults go through renderPinLiteral (typed, quoted, refused when not a
// literal of the pin type). UPROPERTY defaults did not: the raw export string
// was pasted after `=`, so a string default became `FString Greeting = Hello;`
// and a struct blob `FVector Spawn = (X=1,Y=2,Z=3);` — neither compiles.

function asset(variables: BlueprintVariable[]): BlueprintAsset {
  return {
    className: 'BP_Test', parentClass: 'AActor', variables, functions: [],
    eventGraph: { name: 'EventGraph', graphType: 'event', nodes: [] },
  };
}

function v(name: string, type: string, defaultValue: string): BlueprintVariable {
  return { name, type, defaultValue, isExposedToEditor: false, isReplicated: false, isRepNotify: false };
}

describe('UPROPERTY default values', () => {
  it('quotes a string default instead of pasting bare tokens', () => {
    const { headerCode } = generateCppFromBlueprint(asset([v('Greeting', 'string', 'Hello there')]), 'Game');
    expect(headerCode).toContain('FString Greeting = TEXT("Hello there");');
    expect(headerCode).not.toContain('= Hello there;');
  });

  it('omits (and warns about) a default that is not a literal of the property type', () => {
    const result = generateCppFromBlueprint(asset([v('Spawn', 'vector', '(X=1,Y=2,Z=3)')]), 'Game');
    expect(result.headerCode).toContain('FVector Spawn;');
    expect(result.headerCode).not.toContain('(X=1');
    expect(result.warnings.some((w) => w.message.includes('Spawn') && w.severity === 'warning')).toBe(true);
  });

  it('keeps numeric and bool literals as they are', () => {
    const { headerCode } = generateCppFromBlueprint(
      asset([v('Health', 'float', '100.0'), v('bDead', 'bool', 'false'), v('Ammo', 'int', '30')]),
      'Game',
    );
    expect(headerCode).toContain('float Health = 100.0;');
    expect(headerCode).toContain('bool bDead = false;');
    expect(headerCode).toContain('int32 Ammo = 30;');
  });

  it('does not initialise an FText from TEXT() (no such conversion)', () => {
    const { headerCode } = generateCppFromBlueprint(asset([v('Title', 'text', 'Hi')]), 'Game');
    expect(headerCode).toContain('FText Title;');
  });
});
