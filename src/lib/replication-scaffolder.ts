/**
 * Replication Scaffolder
 *
 * UE5 replication requires more than the `Replicated` UPROPERTY specifier: every
 * class with replicated properties MUST implement `GetLifetimeReplicatedProps()`
 * with one `DOREPLIFETIME` macro per property and `#include "Net/UnrealNetwork.h"`
 * in the source file — otherwise the code does not compile/replicate. RepNotify
 * properties additionally need a `ReplicatedUsing = OnRep_X` specifier plus a
 * `UFUNCTION()`-decorated `OnRep_X()` handler.
 *
 * This module turns a parsed BlueprintAsset's replicated variables into the
 * boilerplate the transpiler must emit. It is intentionally pure (no React, no
 * I/O) so it can be unit-tested and reused by the API route and the
 * MultiplayerView replication panel.
 */

import { blueprintTypeToCpp } from '@/lib/blueprint-parser';
import type {
  BlueprintAsset,
  ReplicatedPropertyInfo,
  ReplicationInfo,
} from '@/types/blueprint';

/** Header that DOREPLIFETIME / DOREPLIFETIME_CONDITION macros live in. */
export const REPLICATION_INCLUDE = 'Net/UnrealNetwork.h';

/** OnRep handler name for a replicated property, e.g. `Health` → `OnRep_Health`. */
export function onRepHandlerName(propertyName: string): string {
  return `OnRep_${propertyName}`;
}

/**
 * The UPROPERTY specifier a replicated property should use:
 * - RepNotify → `ReplicatedUsing = OnRep_X`
 * - plain replicated → `Replicated`
 */
export function replicationSpecifier(prop: { name: string; repNotify: boolean }): string {
  return prop.repNotify
    ? `ReplicatedUsing = ${onRepHandlerName(prop.name)}`
    : 'Replicated';
}

/**
 * Collect the replicated properties of a Blueprint and resolve each to a C++
 * type + RepNotify status. Returns an empty array for classes with none.
 */
export function getReplicatedProperties(asset: BlueprintAsset): ReplicatedPropertyInfo[] {
  return asset.variables
    .filter((v) => v.isReplicated || v.isRepNotify)
    .map((v) => {
      const repNotify = v.isRepNotify;
      return {
        name: v.name,
        cppType: blueprintTypeToCpp(v.type),
        repNotify,
        ...(repNotify ? { onRepHandler: onRepHandlerName(v.name) } : {}),
      };
    });
}

/** Build the replication metadata block surfaced in the transpile result + UI. */
export function buildReplicationInfo(asset: BlueprintAsset): ReplicationInfo {
  const properties = getReplicatedProperties(asset);
  return {
    hasReplication: properties.length > 0,
    properties,
  };
}

/**
 * The header declaration for the lifetime-props override. Always the same
 * signature regardless of which properties are replicated.
 */
export function lifetimeReplicatedPropsDeclaration(): string {
  return 'virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;';
}

/** `UFUNCTION()` OnRep handler declarations — one per RepNotify property. */
export function onRepDeclarations(props: ReplicatedPropertyInfo[]): string[] {
  const lines: string[] = [];
  for (const p of props) {
    if (!p.repNotify) continue;
    lines.push('UFUNCTION()');
    lines.push(`void ${onRepHandlerName(p.name)}();`);
  }
  return lines;
}

/**
 * The full `GetLifetimeReplicatedProps` definition for the .cpp file, with a
 * `Super::` call and one `DOREPLIFETIME` per replicated property.
 */
export function lifetimeReplicatedPropsDefinition(
  cppClassName: string,
  props: ReplicatedPropertyInfo[],
): string {
  const lines: string[] = [];
  lines.push(`void ${cppClassName}::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const`);
  lines.push('{');
  lines.push('\tSuper::GetLifetimeReplicatedProps(OutLifetimeProps);');
  if (props.length > 0) lines.push('');
  for (const p of props) {
    lines.push(`\tDOREPLIFETIME(${cppClassName}, ${p.name});`);
  }
  lines.push('}');
  return lines.join('\n');
}

/** OnRep handler implementations for the .cpp file — one per RepNotify property. */
export function onRepDefinitions(
  cppClassName: string,
  props: ReplicatedPropertyInfo[],
): string[] {
  const defs: string[] = [];
  for (const p of props) {
    if (!p.repNotify) continue;
    defs.push(
      [
        `void ${cppClassName}::${onRepHandlerName(p.name)}()`,
        '{',
        `\t// TODO: React to replicated ${p.name} change on clients (update UI, play FX, etc.)`,
        '}',
      ].join('\n'),
    );
  }
  return defs;
}
