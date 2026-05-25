/**
 * Plain-language dictionary for UE5 / Blueprint jargon.
 *
 * Used by the Blueprint Transpiler view to translate raw engine terms
 * (UPROPERTY specifiers, K2Node types, conflict levels, replication macros)
 * into one-line explanations that non-engineers can read.
 *
 * Keep entries terse — a single sentence. The UI surfaces these as tooltips
 * and inline annotations under generated code.
 */

export interface JargonEntry {
  /** The raw term as it appears in code or labels (e.g. "EditAnywhere"). */
  term: string;
  /** One-line, jargon-free description of what the term does. */
  plain: string;
  /** Optional one-line "why it matters" hook for the Explain panel. */
  whyItMatters?: string;
}

// ─── UPROPERTY / UFUNCTION specifiers ───────────────────────────────────────

export const UPROPERTY_SPECIFIERS: Record<string, JargonEntry> = {
  EditAnywhere: {
    term: 'EditAnywhere',
    plain: 'Designers can tweak this value in the editor on every instance.',
    whyItMatters: 'Lets non-coders tune values without touching C++.',
  },
  EditDefaultsOnly: {
    term: 'EditDefaultsOnly',
    plain: 'Editable on the class default, but locked on placed instances.',
  },
  EditInstanceOnly: {
    term: 'EditInstanceOnly',
    plain: 'Editable on placed instances, but locked on the class default.',
  },
  VisibleAnywhere: {
    term: 'VisibleAnywhere',
    plain: 'Visible in the editor as read-only — useful for debug inspection.',
  },
  BlueprintReadWrite: {
    term: 'BlueprintReadWrite',
    plain: 'Blueprints can read AND write this value at runtime.',
    whyItMatters: 'Bridges C++ data into visual scripting without a wrapper.',
  },
  BlueprintReadOnly: {
    term: 'BlueprintReadOnly',
    plain: 'Blueprints can read this value but cannot change it.',
  },
  Replicated: {
    term: 'Replicated',
    plain: 'Keeps this value in sync from the server to every connected client.',
    whyItMatters: 'Without it, multiplayer clients see stale values.',
  },
  ReplicatedUsing: {
    term: 'ReplicatedUsing',
    plain: 'Replicates the value AND calls a function whenever it changes.',
    whyItMatters: 'Use this to react to network updates (e.g. play a hit effect).',
  },
  SaveGame: {
    term: 'SaveGame',
    plain: 'Marked for inclusion in save-game serialization.',
  },
  Transient: {
    term: 'Transient',
    plain: 'Never saved to disk — runtime-only state.',
  },
  Category: {
    term: 'Category',
    plain: 'Groups this property under a named section in the editor details panel.',
  },
  BlueprintCallable: {
    term: 'BlueprintCallable',
    plain: 'Blueprints can call this C++ function from their graphs.',
    whyItMatters: 'Designers can use this logic without rewriting it in Blueprint.',
  },
  BlueprintPure: {
    term: 'BlueprintPure',
    plain: 'A Blueprint-callable function with no side effects (returns a value).',
  },
  BlueprintImplementableEvent: {
    term: 'BlueprintImplementableEvent',
    plain: 'C++ declares it; Blueprint subclasses provide the body.',
  },
  BlueprintNativeEvent: {
    term: 'BlueprintNativeEvent',
    plain: 'C++ gives a default body; Blueprint can override it.',
  },
  Server: {
    term: 'Server',
    plain: 'This function only runs on the server (client calls are forwarded).',
  },
  Client: {
    term: 'Client',
    plain: 'This function only runs on the owning client.',
  },
  NetMulticast: {
    term: 'NetMulticast',
    plain: 'Server triggers this on the server AND every connected client.',
  },
  Reliable: {
    term: 'Reliable',
    plain: 'Network delivery is guaranteed — important calls (e.g. damage).',
  },
  Unreliable: {
    term: 'Unreliable',
    plain: 'Network delivery may drop — fine for cosmetic effects.',
  },
};

// ─── Macros / core declarations ─────────────────────────────────────────────

export const CORE_MACROS: Record<string, JargonEntry> = {
  UCLASS: {
    term: 'UCLASS',
    plain: 'Registers this C++ class with Unreal so editor, Blueprint, and reflection can see it.',
  },
  USTRUCT: {
    term: 'USTRUCT',
    plain: 'Registers this struct so it shows up in editor pickers and Blueprint pins.',
  },
  UENUM: {
    term: 'UENUM',
    plain: 'Registers this enum so it appears in dropdowns and Blueprint Switch nodes.',
  },
  UPROPERTY: {
    term: 'UPROPERTY',
    plain: 'Tags this variable for Unreal — controls editor visibility, Blueprint access, and replication.',
  },
  UFUNCTION: {
    term: 'UFUNCTION',
    plain: 'Tags this function for Unreal — controls Blueprint exposure and networking.',
  },
  GENERATED_BODY: {
    term: 'GENERATED_BODY',
    plain: 'Placeholder Unreal Header Tool fills in with boilerplate (constructors, reflection).',
  },
  DOREPLIFETIME: {
    term: 'DOREPLIFETIME',
    plain: 'Registers a property for network replication inside GetLifetimeReplicatedProps.',
    whyItMatters: 'A Replicated UPROPERTY does nothing until you also list it here.',
  },
  generated_h: {
    term: '.generated.h',
    plain: 'Auto-generated reflection header — must be the LAST include in the .h file.',
  },
};

// ─── K2Node types ───────────────────────────────────────────────────────────

export const K2NODE_LABELS: Record<string, JargonEntry> = {
  K2Node_Event: {
    term: 'K2Node_Event',
    plain: 'A Blueprint event — fires when something happens (e.g. BeginPlay, Tick).',
  },
  K2Node_CallFunction: {
    term: 'K2Node_CallFunction',
    plain: 'A function call node — invokes a C++ or Blueprint function.',
  },
  K2Node_VariableGet: {
    term: 'K2Node_VariableGet',
    plain: 'Reads the current value of a variable.',
  },
  K2Node_VariableSet: {
    term: 'K2Node_VariableSet',
    plain: 'Writes a new value into a variable.',
  },
  K2Node_IfThenElse: {
    term: 'K2Node_IfThenElse',
    plain: 'A Branch node — runs one path if a condition is true, another if false.',
  },
  K2Node_FunctionEntry: {
    term: 'K2Node_FunctionEntry',
    plain: 'The starting node of a Blueprint function (defines its inputs).',
  },
  K2Node_FunctionResult: {
    term: 'K2Node_FunctionResult',
    plain: 'The return node of a Blueprint function (defines its outputs).',
  },
  K2Node_SpawnActorFromClass: {
    term: 'K2Node_SpawnActorFromClass',
    plain: 'Spawns an actor of a chosen class into the world at runtime.',
  },
  K2Node_DynamicCast: {
    term: 'K2Node_DynamicCast',
    plain: 'A Cast node — checks if a reference is a specific subtype and casts it.',
  },
  K2Node_SwitchEnum: {
    term: 'K2Node_SwitchEnum',
    plain: 'Picks one execution path based on an enum value.',
  },
  K2Node_MacroInstance: {
    term: 'K2Node_MacroInstance',
    plain: 'Inserts a reusable graph fragment (a Blueprint macro).',
  },
  K2Node_Timeline: {
    term: 'K2Node_Timeline',
    plain: 'A Blueprint timeline — drives values over time (animation curves, fades).',
  },
  K2Node_MakeArray: {
    term: 'K2Node_MakeArray',
    plain: 'Builds an array literal from a list of pins.',
  },
  K2Node_Composite: {
    term: 'K2Node_Composite',
    plain: 'A collapsed sub-graph used to keep the parent graph tidy.',
  },
  K2Node_MathExpression: {
    term: 'K2Node_MathExpression',
    plain: 'Evaluates a math expression typed as text.',
  },
  K2Node_CommutativeAssociativeBinaryOperator: {
    term: 'K2Node_CommutativeAssociativeBinaryOperator',
    plain: 'A math operator node (e.g. +, *) that accepts multiple inputs.',
  },
  K2Node_Self: {
    term: 'K2Node_Self',
    plain: 'A reference to the actor or object owning this Blueprint.',
  },
  K2Node_Select: {
    term: 'K2Node_Select',
    plain: 'Picks one of several values based on an index or condition.',
  },
};

// ─── Conflict levels (for SemanticDiff) ─────────────────────────────────────

export const CONFLICT_LEVEL_LABELS: Record<string, JargonEntry> = {
  none: {
    term: 'No Conflicts',
    plain: 'The Blueprint and the C++ class are in sync — nothing to fix.',
  },
  compatible: {
    term: 'Compatible Changes',
    plain: 'There are differences, but they merge cleanly — no manual decision needed.',
    whyItMatters: 'Safe to apply automatically; the C++ side just needs new code generated.',
  },
  conflict: {
    term: 'Conflicts Detected',
    plain: 'The Blueprint and the C++ disagree on the SAME thing — you have to pick a winner.',
    whyItMatters: 'Auto-applying would silently break either gameplay logic or save data.',
  },
};

// ─── Change types ───────────────────────────────────────────────────────────

export const CHANGE_TYPE_LABELS: Record<string, JargonEntry> = {
  add: {
    term: 'Added',
    plain: 'Exists in the Blueprint but is missing on the C++ side.',
  },
  remove: {
    term: 'Removed',
    plain: 'Exists in the C++ but is missing on the Blueprint side.',
  },
  modify: {
    term: 'Modified',
    plain: 'Exists on both sides but the definitions disagree.',
  },
  move: {
    term: 'Moved',
    plain: 'Same definition, different location.',
  },
  rename: {
    term: 'Renamed',
    plain: 'Same definition, different name on one side.',
  },
};

// ─── Aggregate lookup ───────────────────────────────────────────────────────

const ALL_JARGON: Record<string, JargonEntry> = {
  ...UPROPERTY_SPECIFIERS,
  ...CORE_MACROS,
  ...K2NODE_LABELS,
  ...CONFLICT_LEVEL_LABELS,
  ...CHANGE_TYPE_LABELS,
};

/**
 * Return the plain-language entry for a UE5 jargon term, or undefined if
 * we don't have a translation. Match is case-sensitive (UPROPERTY specifiers
 * are case-sensitive in real code).
 */
export function lookupJargon(term: string): JargonEntry | undefined {
  return ALL_JARGON[term];
}

/**
 * Return all jargon terms found inside a text blob. Used to power inline
 * tooltips: scan a generated header line for known specifiers and wrap each
 * occurrence with a tooltip.
 */
export function findJargonInText(text: string): JargonEntry[] {
  const hits: JargonEntry[] = [];
  const seen = new Set<string>();
  for (const term of Object.keys(ALL_JARGON)) {
    if (text.includes(term) && !seen.has(term)) {
      hits.push(ALL_JARGON[term]);
      seen.add(term);
    }
  }
  return hits;
}
