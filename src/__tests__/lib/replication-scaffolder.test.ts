import { describe, it, expect } from 'vitest';
import {
  REPLICATION_INCLUDE,
  onRepHandlerName,
  replicationSpecifier,
  getReplicatedProperties,
  buildReplicationInfo,
  lifetimeReplicatedPropsDeclaration,
  lifetimeReplicatedPropsDefinition,
  onRepDeclarations,
  onRepDefinitions,
} from '@/lib/replication-scaffolder';
import { parseBlueprintJson, summarizeBlueprintForPrompt } from '@/lib/blueprint-parser';
import type { BlueprintAsset, BlueprintVariable, ReplicatedPropertyInfo } from '@/types/blueprint';

function makeVar(partial: Partial<BlueprintVariable> & { name: string }): BlueprintVariable {
  return {
    type: 'float',
    isExposedToEditor: false,
    isReplicated: false,
    isRepNotify: false,
    ...partial,
  };
}

function makeAsset(variables: BlueprintVariable[]): BlueprintAsset {
  return {
    className: 'BP_Test',
    parentClass: 'AActor',
    variables,
    functions: [],
    eventGraph: { name: 'EventGraph', graphType: 'event', nodes: [] },
  };
}

describe('replication-scaffolder', () => {
  describe('onRepHandlerName', () => {
    it('prefixes the property name with OnRep_', () => {
      expect(onRepHandlerName('Health')).toBe('OnRep_Health');
    });
  });

  describe('replicationSpecifier', () => {
    it('returns Replicated for plain replicated properties', () => {
      expect(replicationSpecifier({ name: 'Ammo', repNotify: false })).toBe('Replicated');
    });

    it('returns ReplicatedUsing for RepNotify properties', () => {
      expect(replicationSpecifier({ name: 'Health', repNotify: true })).toBe(
        'ReplicatedUsing = OnRep_Health',
      );
    });
  });

  describe('getReplicatedProperties', () => {
    it('returns only replicated properties with resolved C++ types', () => {
      const asset = makeAsset([
        makeVar({ name: 'Health', type: 'float', isReplicated: true }),
        makeVar({ name: 'LocalOnly', type: 'int', isReplicated: false }),
        makeVar({ name: 'Position', type: 'vector', isRepNotify: true, isReplicated: true }),
      ]);
      const props = getReplicatedProperties(asset);
      expect(props.map((p) => p.name)).toEqual(['Health', 'Position']);
      expect(props.find((p) => p.name === 'Health')?.cppType).toBe('float');
      expect(props.find((p) => p.name === 'Position')?.cppType).toBe('FVector');
    });

    it('sets onRepHandler only for RepNotify properties', () => {
      const asset = makeAsset([
        makeVar({ name: 'Health', isReplicated: true }),
        makeVar({ name: 'Position', isRepNotify: true, isReplicated: true }),
      ]);
      const props = getReplicatedProperties(asset);
      expect(props.find((p) => p.name === 'Health')?.onRepHandler).toBeUndefined();
      expect(props.find((p) => p.name === 'Health')?.repNotify).toBe(false);
      expect(props.find((p) => p.name === 'Position')?.onRepHandler).toBe('OnRep_Position');
      expect(props.find((p) => p.name === 'Position')?.repNotify).toBe(true);
    });

    it('returns an empty array when nothing is replicated', () => {
      const asset = makeAsset([makeVar({ name: 'Foo' }), makeVar({ name: 'Bar' })]);
      expect(getReplicatedProperties(asset)).toEqual([]);
    });
  });

  describe('buildReplicationInfo', () => {
    it('flags hasReplication false when there are no replicated properties', () => {
      const info = buildReplicationInfo(makeAsset([makeVar({ name: 'Foo' })]));
      expect(info.hasReplication).toBe(false);
      expect(info.properties).toEqual([]);
    });

    it('flags hasReplication true and lists the properties', () => {
      const info = buildReplicationInfo(
        makeAsset([makeVar({ name: 'Health', isReplicated: true })]),
      );
      expect(info.hasReplication).toBe(true);
      expect(info.properties).toHaveLength(1);
    });
  });

  describe('lifetimeReplicatedPropsDefinition', () => {
    const props: ReplicatedPropertyInfo[] = [
      { name: 'Health', cppType: 'float', repNotify: true, onRepHandler: 'OnRep_Health' },
      { name: 'Ammo', cppType: 'int32', repNotify: false },
    ];

    it('calls Super and emits one DOREPLIFETIME per property', () => {
      const body = lifetimeReplicatedPropsDefinition('AMyActor', props);
      expect(body).toContain(
        'void AMyActor::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const',
      );
      expect(body).toContain('Super::GetLifetimeReplicatedProps(OutLifetimeProps);');
      expect(body).toContain('DOREPLIFETIME(AMyActor, Health);');
      expect(body).toContain('DOREPLIFETIME(AMyActor, Ammo);');
    });

    it('still emits a valid Super-only body when there are no properties', () => {
      const body = lifetimeReplicatedPropsDefinition('AMyActor', []);
      expect(body).toContain('Super::GetLifetimeReplicatedProps(OutLifetimeProps);');
      expect(body).not.toContain('DOREPLIFETIME');
    });
  });

  describe('lifetimeReplicatedPropsDeclaration', () => {
    it('produces the override signature', () => {
      expect(lifetimeReplicatedPropsDeclaration()).toBe(
        'virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;',
      );
    });
  });

  describe('onRep declarations + definitions', () => {
    const props: ReplicatedPropertyInfo[] = [
      { name: 'Health', cppType: 'float', repNotify: true, onRepHandler: 'OnRep_Health' },
      { name: 'Ammo', cppType: 'int32', repNotify: false },
    ];

    it('declares UFUNCTION OnRep handlers only for RepNotify properties', () => {
      const decls = onRepDeclarations(props);
      expect(decls).toContain('UFUNCTION()');
      expect(decls).toContain('void OnRep_Health();');
      expect(decls.join('\n')).not.toContain('OnRep_Ammo');
    });

    it('defines OnRep handler bodies only for RepNotify properties', () => {
      const defs = onRepDefinitions('AMyActor', props);
      expect(defs).toHaveLength(1);
      expect(defs[0]).toContain('void AMyActor::OnRep_Health()');
    });
  });

  describe('REPLICATION_INCLUDE', () => {
    it('points at the UnrealNetwork header', () => {
      expect(REPLICATION_INCLUDE).toBe('Net/UnrealNetwork.h');
    });
  });
});

describe('blueprint-parser replication flags', () => {
  it('detects CPF_RepNotify and marks the property as both replicated and RepNotify', () => {
    const json = JSON.stringify({
      ClassName: 'BP_Player',
      ParentClass: 'ACharacter',
      Variables: [
        { VarName: 'Health', VarType: 'float', PropertyFlags: ['CPF_Net'] },
        { VarName: 'Ammo', VarType: 'int', PropertyFlags: ['CPF_RepNotify'] },
        { VarName: 'Score', VarType: 'int', PropertyFlags: [] },
      ],
    });
    const asset = parseBlueprintJson(json);
    const health = asset.variables.find((v) => v.name === 'Health')!;
    const ammo = asset.variables.find((v) => v.name === 'Ammo')!;
    const score = asset.variables.find((v) => v.name === 'Score')!;

    expect(health.isReplicated).toBe(true);
    expect(health.isRepNotify).toBe(false);

    // RepNotify implies replicated.
    expect(ammo.isReplicated).toBe(true);
    expect(ammo.isRepNotify).toBe(true);

    expect(score.isReplicated).toBe(false);
    expect(score.isRepNotify).toBe(false);
  });

  it('surfaces RepNotify in the prompt summary', () => {
    const json = JSON.stringify({
      ClassName: 'BP_Player',
      ParentClass: 'ACharacter',
      Variables: [{ VarName: 'Ammo', VarType: 'int', PropertyFlags: ['CPF_RepNotify'] }],
    });
    const summary = summarizeBlueprintForPrompt(parseBlueprintJson(json));
    expect(summary).toContain('RepNotify');
  });
});
