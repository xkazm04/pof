/**
 * Blueprint ↔ C++ Semantic Diff
 *
 * Compares a parsed `BlueprintAsset` against existing hand-written/transpiled
 * C++ and reports the structural deltas (variables/functions added, removed, or
 * type-conflicting) that a round-trip would have to reconcile. Backs the `diff`
 * action of `/api/blueprint-transpiler`.
 *
 * The C++ side is parsed with `parseHeader` from `cpp-semantic-parser.ts` — the
 * single source of truth for C++ header parsing. It strips comments, brace-
 * matches class bodies, and extracts typed UPROPERTY members + UFUNCTION
 * signatures, so the diff sees the same structure the semantic verifier does.
 * This avoids the comment / call-site false positives and the missed pointer/
 * template-typed UPROPERTY members of the old ad-hoc `fnRegex`/`varRegex`. Kept
 * pure (no React/I/O) so it can be unit-tested and reused outside the HTTP
 * route, mirroring `replication-scaffolder.ts`.
 */

import { blueprintTypeToCpp } from '@/lib/blueprint-parser';
import { parseHeader } from '@/lib/cpp-semantic-parser';
import type {
  SemanticDiffResult,
  SemanticChange,
  BlueprintAsset,
} from '@/types/blueprint';

export function computeSemanticDiff(
  asset: BlueprintAsset,
  existingCpp: string,
  _projectName: string,
  /** Injectable clock so the result timestamp is deterministic under test. */
  now: number = Date.now(),
): SemanticDiffResult {
  const changes: SemanticChange[] = [];
  let changeId = 0;

  // Parse the existing C++ with the shared header parser (single source of
  // truth): comments stripped, class bodies brace-matched, UPROPERTY members
  // captured with their types, UFUNCTION signatures by name. Aggregate across
  // every class in the pasted source.
  const parsed = parseHeader(existingCpp);
  const cppProperties = new Map<string, string>(); // member name → C++ type
  const cppFunctions = new Set<string>();
  for (const cls of parsed.classes) {
    for (const prop of cls.properties) {
      if (!cppProperties.has(prop.name)) cppProperties.set(prop.name, prop.type);
    }
    for (const fn of cls.functions) cppFunctions.add(fn);
  }

  // Check Blueprint variables vs C++ variables
  for (const v of asset.variables) {
    const cppType = cppProperties.get(v.name);
    if (cppType !== undefined) {
      // Both sides have it — check for type conflicts using the parsed type.
      const expectedType = blueprintTypeToCpp(v.type);
      if (cppType !== expectedType) {
        changes.push({
          id: `change-${changeId++}`,
          type: 'modify',
          scope: 'variable',
          name: v.name,
          description: `Type mismatch: Blueprint uses ${v.type} but C++ has ${cppType}`,
          blueprintSide: `${v.name}: ${v.type}`,
          cppSide: `${cppType} ${v.name}`,
          conflictLevel: 'conflict',
          resolution: `Update C++ type to ${expectedType}`,
        });
      }
    } else {
      changes.push({
        id: `change-${changeId++}`,
        type: 'add',
        scope: 'variable',
        name: v.name,
        description: `Variable "${v.name}" exists in Blueprint but not in C++`,
        blueprintSide: `${v.name}: ${v.type}`,
        conflictLevel: 'compatible',
        resolution: `Add UPROPERTY ${blueprintTypeToCpp(v.type)} ${v.name} to header`,
      });
    }
  }

  // Check for C++ variables not in Blueprint
  for (const cppVar of cppProperties.keys()) {
    if (!asset.variables.some((v) => v.name === cppVar)) {
      changes.push({
        id: `change-${changeId++}`,
        type: 'remove',
        scope: 'variable',
        name: cppVar,
        description: `Variable "${cppVar}" exists in C++ but not in Blueprint`,
        cppSide: cppVar,
        conflictLevel: 'compatible',
        resolution: 'Keep in C++ (may be C++-only property) or remove if migrated to Blueprint',
      });
    }
  }

  // Check Blueprint functions vs C++ functions
  for (const fn of asset.functions) {
    const fnName = fn.name.replace(/\s+/g, '');
    if (!cppFunctions.has(fnName)) {
      changes.push({
        id: `change-${changeId++}`,
        type: 'add',
        scope: 'function',
        name: fnName,
        description: `Function "${fnName}" exists in Blueprint but not in C++`,
        blueprintSide: `${fnName}() — ${fn.nodes.length} nodes`,
        conflictLevel: 'compatible',
        resolution: `Transpile function ${fnName} to C++`,
      });
    }
  }

  // Determine overall conflict level
  const hasConflict = changes.some((c) => c.conflictLevel === 'conflict');
  const hasCompatible = changes.some((c) => c.conflictLevel === 'compatible');

  return {
    changes,
    blueprintSummary: `${asset.className}: ${asset.variables.length} variables, ${asset.functions.length} functions, ${asset.eventGraph.nodes.length} event nodes`,
    cppSummary: `${cppFunctions.size} functions, ${cppProperties.size} properties detected`,
    overallConflict: hasConflict ? 'conflict' : hasCompatible ? 'compatible' : 'none',
    timestamp: now,
  };
}
