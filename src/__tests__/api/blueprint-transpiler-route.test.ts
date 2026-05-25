import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/blueprint-transpiler/route';
import type { TranspileResult } from '@/types/blueprint';

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/blueprint-transpiler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const REPLICATED_BP = JSON.stringify({
  ClassName: 'BP_NetActor',
  ParentClass: 'AActor',
  Variables: [
    { VarName: 'Health', VarType: 'float', PropertyFlags: ['CPF_Net'], DefaultValue: '100.0' },
    { VarName: 'AmmoCount', VarType: 'int', PropertyFlags: ['CPF_RepNotify'] },
    { VarName: 'LocalCache', VarType: 'float', PropertyFlags: [] },
  ],
  Graphs: [{ GraphName: 'EventGraph', GraphType: 'event', Nodes: [] }],
});

const NON_REPLICATED_BP = JSON.stringify({
  ClassName: 'BP_PlainActor',
  ParentClass: 'AActor',
  Variables: [{ VarName: 'LocalOnly', VarType: 'float', PropertyFlags: ['CPF_Edit'] }],
  Graphs: [{ GraphName: 'EventGraph', GraphType: 'event', Nodes: [] }],
});

async function transpile(blueprintJson: string): Promise<TranspileResult> {
  const res = await POST(makePost({ action: 'transpile', blueprintJson, projectName: 'PoF' }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  return body.data as TranspileResult;
}

describe('POST /api/blueprint-transpiler — replication scaffolding', () => {
  it('emits GetLifetimeReplicatedProps, the UnrealNetwork include, and DOREPLIFETIME per replicated field', async () => {
    const result = await transpile(REPLICATED_BP);

    // Header declares the override.
    expect(result.headerCode).toContain(
      'virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;',
    );
    // Source includes the mandatory header + defines the body.
    expect(result.sourceCode).toContain('#include "Net/UnrealNetwork.h"');
    expect(result.sourceCode).toContain('Super::GetLifetimeReplicatedProps(OutLifetimeProps);');
    expect(result.sourceCode).toContain('DOREPLIFETIME(ANetActor, Health);');
    expect(result.sourceCode).toContain('DOREPLIFETIME(ANetActor, AmmoCount);');
    // Non-replicated property is not in the lifetime props.
    expect(result.sourceCode).not.toContain('DOREPLIFETIME(ANetActor, LocalCache);');
  });

  it('uses ReplicatedUsing + an OnRep handler for RepNotify fields, plain Replicated otherwise', async () => {
    const result = await transpile(REPLICATED_BP);

    expect(result.headerCode).toContain('ReplicatedUsing = OnRep_AmmoCount');
    expect(result.headerCode).toContain('void OnRep_AmmoCount();');
    expect(result.sourceCode).toContain('void ANetActor::OnRep_AmmoCount()');

    // Health is plain Replicated (no OnRep handler).
    expect(result.headerCode).toMatch(/UPROPERTY\([^)]*\bReplicated\b[^)]*\)\s*\n\s*float Health/);
    expect(result.headerCode).not.toContain('OnRep_Health');
  });

  it('exposes replication metadata listing each field and its RepNotify status', async () => {
    const result = await transpile(REPLICATED_BP);

    expect(result.replication.hasReplication).toBe(true);
    expect(result.replication.properties).toHaveLength(2);
    const ammo = result.replication.properties.find((p) => p.name === 'AmmoCount');
    const health = result.replication.properties.find((p) => p.name === 'Health');
    expect(ammo?.repNotify).toBe(true);
    expect(ammo?.onRepHandler).toBe('OnRep_AmmoCount');
    expect(health?.repNotify).toBe(false);
  });

  it('omits all replication boilerplate for classes with no replicated properties', async () => {
    const result = await transpile(NON_REPLICATED_BP);

    expect(result.replication.hasReplication).toBe(false);
    expect(result.headerCode).not.toContain('GetLifetimeReplicatedProps');
    expect(result.sourceCode).not.toContain('Net/UnrealNetwork.h');
    expect(result.sourceCode).not.toContain('DOREPLIFETIME');
  });
});
