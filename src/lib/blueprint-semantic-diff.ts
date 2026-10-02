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
 * template-typed UPROPERTY members of the old ad-hoc `fnRegex`/`varRegex`.
 * The Blueprint side is `deriveCppSurface` (`blueprint-cpp-surface.ts`) — the
 * member record codegen renders from — so diffing the transpiler's own output
 * reports nothing, and a header missing a custom event or OnRep handler the
 * transpiler would emit is reported. Kept
 * pure (no React/I/O) so it can be unit-tested and reused outside the HTTP
 * route, mirroring `replication-scaffolder.ts`.
 */

import { deriveCppSurface, isEditorExposed } from '@/lib/blueprint-cpp-surface';
import { parseHeader, hasSpecifier, type ParsedFunction } from '@/lib/cpp-semantic-parser';
import { onRepHandlerName } from '@/lib/replication-scaffolder';
import type {
  SemanticDiffResult,
  SemanticChange,
  BlueprintAsset,
  BlueprintVariable,
} from '@/types/blueprint';

/**
 * Dimensions this diff inspects, and the ones it does not. Reported on every
 * result so a change-free comparison cannot be read as "the two sides agree" —
 * it only ever means "nothing diverged in what was inspected".
 */
const COMPARED_DIMENSIONS = [
  'Variable names and types',
  'Variable replication flags (Replicated / ReplicatedUsing)',
  'Variable editor exposure (EditAnywhere / EditDefaultsOnly / EditInstanceOnly)',
  'Function names (both directions)',
  'Function parameter arity, parameter types and return type',
  'Custom events and RepNotify handlers (declared or missing)',
];

const NOT_COMPARED = [
  'Event graph node logic — only the node count is summarised, never matched against C++ overrides',
  'Custom event and RepNotify handler parameter lists — only their presence is checked',
  'Function bodies — no C++ statement is parsed, so identical declarations may still behave differently',
  'Default values, categories and tooltips',
  'Whether the C++ compiles at all',
];

/** Compare declared C++ types ignoring spacing, `const` and reference-ness. */
function normalizeType(t: string): string {
  return t.replace(/\bconst\b/g, '').replace(/[\s&]/g, '');
}

/** Render a parsed C++ function back to a one-line declaration for display. */
function renderCppSignature(fn: ParsedFunction): string {
  const params = fn.params.map((p) => `${p.type}${p.name ? ` ${p.name}` : ''}`).join(', ');
  return `${fn.returnType} ${fn.name}(${params})`;
}

/**
 * Which replication specifier a Blueprint variable's flags demand.
 * RepNotify implies replication *and* an OnRep handler, so it needs
 * `ReplicatedUsing`; plain replication accepts either spelling.
 */
function replicationExpectation(v: BlueprintVariable): { required: string[]; label: string } | null {
  if (v.isRepNotify) return { required: ['ReplicatedUsing'], label: 'RepNotify (ReplicatedUsing)' };
  if (v.isReplicated) return { required: ['Replicated', 'ReplicatedUsing'], label: 'Replicated' };
  return null;
}

export function computeSemanticDiff(
  asset: BlueprintAsset,
  existingCpp: string,
  _projectName: string,
  /** Injectable clock so the result timestamp is deterministic under test. */
  now: number = Date.now(),
): SemanticDiffResult {
  const changes: SemanticChange[] = [];
  let changeId = 0;

  // The expected C++ is the member model codegen renders from — the same
  // properties, specifiers and UFUNCTION set — so the transpiler's own output
  // diffs clean by construction and the diff cannot disagree with codegen.
  const surface = deriveCppSurface(asset);

  // Parse the existing C++ with the shared header parser (single source of
  // truth): comments stripped, class bodies brace-matched, UPROPERTY members
  // captured with their types, UFUNCTION signatures by name. Aggregate across
  // every class in the pasted source.
  const parsed = parseHeader(existingCpp);
  const cppProperties = new Map<string, { type: string; specifiers: string[] }>();
  const cppFunctions = new Map<string, ParsedFunction>();
  for (const cls of parsed.classes) {
    for (const prop of cls.properties) {
      if (!cppProperties.has(prop.name)) {
        cppProperties.set(prop.name, { type: prop.type, specifiers: prop.specifiers });
      }
    }
    for (const fn of cls.functionSignatures) {
      if (!cppFunctions.has(fn.name)) cppFunctions.set(fn.name, fn);
    }
  }

  // Check Blueprint variables vs C++ variables
  for (const prop of surface.properties) {
    const v = prop.variable;
    const cppProp = cppProperties.get(v.name);
    if (cppProp !== undefined) {
      const cppType = cppProp.type;
      // Declared flags — a replicated Blueprint variable whose UPROPERTY
      // carries no Replicated specifier will silently never replicate.
      const rep = replicationExpectation(v);
      if (rep && !rep.required.some((s) => hasSpecifier(cppProp.specifiers, s))) {
        changes.push({
          id: `change-${changeId++}`,
          type: 'modify',
          scope: 'variable',
          name: v.name,
          description: `Replication mismatch: Blueprint marks "${v.name}" ${rep.label} but the C++ UPROPERTY declares no ${rep.required.join(' / ')} specifier`,
          blueprintSide: `${v.name}: ${rep.label}`,
          cppSide: `UPROPERTY(${cppProp.specifiers.join(', ')})`,
          conflictLevel: 'conflict',
          resolution: `Add ${rep.required[0]}${v.isRepNotify ? ` = ${onRepHandlerName(v.name)}` : ''} to the UPROPERTY and register it in GetLifetimeReplicatedProps`,
        });
      } else if (!rep && cppProp.specifiers.some((s) => hasSpecifier([s], 'Replicated') || hasSpecifier([s], 'ReplicatedUsing'))) {
        changes.push({
          id: `change-${changeId++}`,
          type: 'modify',
          scope: 'variable',
          name: v.name,
          description: `Replication mismatch: C++ replicates "${v.name}" but the Blueprint variable is not marked replicated`,
          blueprintSide: `${v.name}: not replicated`,
          cppSide: `UPROPERTY(${cppProp.specifiers.join(', ')})`,
          conflictLevel: 'conflict',
          resolution: `Mark ${v.name} replicated in the Blueprint, or drop the C++ specifier`,
        });
      }

      // Editor exposure — a weaker (compatible) divergence than replication.
      // Both sides are read with the same rule: the Edit* family only.
      const bpExposed = isEditorExposed(prop.specifiers);
      const cppExposed = isEditorExposed(cppProp.specifiers);
      if (bpExposed !== cppExposed) {
        changes.push({
          id: `change-${changeId++}`,
          type: 'modify',
          scope: 'variable',
          name: v.name,
          description: `Editor exposure mismatch: Blueprint ${bpExposed ? 'exposes' : 'does not expose'} "${v.name}" but C++ ${cppExposed ? 'does' : 'does not'}`,
          blueprintSide: `${v.name}: ${bpExposed ? 'exposed to editor' : 'not exposed'}`,
          cppSide: `UPROPERTY(${cppProp.specifiers.join(', ')})`,
          conflictLevel: 'compatible',
          resolution: bpExposed
            ? 'Add EditAnywhere (or EditDefaultsOnly / EditInstanceOnly) to the UPROPERTY — BlueprintReadWrite alone does not show it in the Details panel'
            : 'Remove the Edit* specifier, or expose the Blueprint variable',
        });
      }

      // Both sides have it — check for type conflicts using the parsed type.
      const expectedType = prop.cppType;
      if (normalizeType(cppType) !== normalizeType(expectedType)) {
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
        resolution: `Add UPROPERTY ${prop.cppType} ${v.name} to header`,
      });
    }
  }

  // Check for C++ variables not in Blueprint
  for (const cppVar of cppProperties.keys()) {
    if (!surface.properties.some((p) => p.name === cppVar)) {
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

  // Check every UFUNCTION the Blueprint becomes against the C++ — Blueprint
  // functions by name AND signature; custom events and OnRep handlers by
  // presence (codegen emits them parameterless; UE also accepts an OnRep that
  // takes the old value, so their parameter lists are not compared).
  const expectedFnNames = new Set(surface.functions.map((f) => f.name));
  for (const fn of surface.functions) {
    const cppFn = cppFunctions.get(fn.name);

    if (fn.origin === 'custom-event') {
      if (!cppFn) {
        changes.push({
          id: `change-${changeId++}`,
          type: 'add',
          scope: 'event',
          name: fn.name,
          description: `Custom event "${fn.name}" exists in Blueprint but the C++ declares no UFUNCTION for it`,
          blueprintSide: `Custom event ${fn.name}`,
          conflictLevel: 'compatible',
          resolution: `Declare UFUNCTION(BlueprintCallable) void ${fn.name}() so callers of the event still resolve`,
        });
      }
      continue;
    }

    if (fn.origin === 'onrep-handler') {
      if (!cppFn) {
        // UHT rejects a ReplicatedUsing that names an undeclared handler, so
        // when the C++ property already points at it this is a conflict.
        const cppProp = cppProperties.get(fn.property);
        const namedByCpp = cppProp?.specifiers.some(
          (s) => hasSpecifier([s], 'ReplicatedUsing') && s.slice(s.indexOf('=') + 1).trim() === fn.name,
        ) ?? false;
        changes.push({
          id: `change-${changeId++}`,
          type: 'add',
          scope: 'function',
          name: fn.name,
          description: namedByCpp
            ? `RepNotify handler "${fn.name}" is named by the "${fn.property}" UPROPERTY but never declared — UHT rejects the header`
            : `RepNotify handler "${fn.name}" for "${fn.property}" is not declared in C++`,
          blueprintSide: `${fn.property}: RepNotify`,
          ...(cppProp ? { cppSide: `UPROPERTY(${cppProp.specifiers.join(', ')})` } : {}),
          conflictLevel: namedByCpp ? 'conflict' : 'compatible',
          resolution: `Declare UFUNCTION() void ${fn.name}();`,
        });
      }
      continue;
    }

    const { params, returnType } = fn;
    const bpSignature = `${returnType} ${fn.name}(${params.join(', ')})`;

    if (!cppFn) {
      changes.push({
        id: `change-${changeId++}`,
        type: 'add',
        scope: 'function',
        name: fn.name,
        description: `Function "${fn.name}" exists in Blueprint but not in C++`,
        blueprintSide: `${fn.name}() — ${fn.graph.nodes.length} nodes`,
        conflictLevel: 'compatible',
        resolution: `Transpile function ${fn.name} to C++`,
      });
      continue;
    }

    // `params` are rendered "Type Name" by the shared helper — split at the
    // last space so the type survives templates and pointers.
    const bpParams = params.map((p) => {
      const cut = p.lastIndexOf(' ');
      return cut < 0 ? { type: p, name: '' } : { type: p.slice(0, cut), name: p.slice(cut + 1) };
    });

    const reasons: string[] = [];
    if (bpParams.length !== cppFn.params.length) {
      reasons.push(
        `Blueprint declares ${bpParams.length} parameter${bpParams.length === 1 ? '' : 's'} but C++ declares ${cppFn.params.length}`,
      );
    } else {
      for (let i = 0; i < bpParams.length; i++) {
        if (normalizeType(bpParams[i].type) !== normalizeType(cppFn.params[i].type)) {
          reasons.push(
            `parameter ${i + 1} (${bpParams[i].name || cppFn.params[i].name || `#${i + 1}`}): Blueprint ${bpParams[i].type} vs C++ ${cppFn.params[i].type}`,
          );
        }
      }
    }
    if (normalizeType(returnType) !== normalizeType(cppFn.returnType)) {
      reasons.push(`return type: Blueprint ${returnType} vs C++ ${cppFn.returnType}`);
    }

    if (reasons.length > 0) {
      changes.push({
        id: `change-${changeId++}`,
        type: 'modify',
        scope: 'function',
        name: fn.name,
        description: `Signature mismatch on "${fn.name}" — ${reasons.join('; ')}`,
        blueprintSide: bpSignature,
        cppSide: renderCppSignature(cppFn),
        conflictLevel: 'conflict',
        resolution: `Update the C++ declaration to ${bpSignature}`,
      });
    }
  }

  // Check for C++ functions the Blueprint does not become — the mirror of the
  // variable pass. The transpiler's own custom events and OnRep handlers are
  // expected members, so they no longer read as C++-only.
  for (const [name, cppFn] of cppFunctions) {
    if (expectedFnNames.has(name)) continue;
    changes.push({
      id: `change-${changeId++}`,
      type: 'remove',
      scope: 'function',
      name,
      description: `Function "${name}" exists in C++ but not in the Blueprint`,
      cppSide: renderCppSignature(cppFn),
      conflictLevel: 'compatible',
      resolution: 'Keep in C++ (may be a C++-only or event-graph-backed function) or remove if migrated to the Blueprint',
    });
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
    // Declaration-level comparison only: it can show that both sides DECLARE
    // and DEFINE the same members with the same signatures. It cannot show
    // structural or behavioural equivalence, and it never compiles anything.
    fidelityRung: 'declared-and-defined',
    comparedDimensions: COMPARED_DIMENSIONS,
    notCompared: NOT_COMPARED,
  };
}
