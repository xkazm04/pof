/**
 * Blueprint transpiler glossary — the single source of plain-English hover text
 * for the engine jargon surfaced in the Blueprint → C++ transpiler view.
 *
 * The base UE5 dictionary (UPROPERTY specifiers, core macros, K2Node types,
 * conflict levels) already lives in `blueprint-jargon.ts`. This module layers in
 * the *raw* engine tokens that show up verbatim in Blueprint JSON exports and in
 * the diff/warning UI but aren't in the base dictionary:
 *
 *   - `CPF_*`   property-flag enum names (e.g. `CPF_Edit`)
 *   - `EGPD_*`  pin-direction enum names (e.g. `EGPD_Output`)
 *   - three-letter diff change codes shown on diff cards (ADD/DEL/MOD/MOV/REN)
 *   - diff scope tokens (variable/function/event/logic/binding)
 *
 * Consumers (TermChip, the diff change cards, the warnings list, and any future
 * docs) should look terms up through {@link lookupTerm} so they all share one
 * source of truth.
 */

import {
  type JargonEntry,
  CHANGE_TYPE_META,
  lookupJargon,
} from './blueprint-jargon';

export type { JargonEntry };

// ─── CPF_* property flags ────────────────────────────────────────────────────
// Raw FProperty flag names as they appear in a Blueprint's `PropertyFlags` array.

const CPF_FLAGS: Record<string, JargonEntry> = {
  CPF_Edit: {
    term: 'CPF_Edit',
    plain: 'Editable in the Details panel — designers can change it in the editor.',
    whyItMatters: 'Maps to the EditAnywhere/EditDefaultsOnly specifiers on the generated UPROPERTY.',
  },
  CPF_BlueprintVisible: {
    term: 'CPF_BlueprintVisible',
    plain: 'Visible to Blueprint graphs — they can read this value.',
  },
  CPF_BlueprintReadOnly: {
    term: 'CPF_BlueprintReadOnly',
    plain: 'Blueprints can read this value but cannot change it.',
  },
  CPF_DisableEditOnInstance: {
    term: 'CPF_DisableEditOnInstance',
    plain: 'Editable only on the class default — locked on placed instances.',
  },
  CPF_DisableEditOnTemplate: {
    term: 'CPF_DisableEditOnTemplate',
    plain: 'Editable only on placed instances — locked on the class default.',
  },
  CPF_Net: {
    term: 'CPF_Net',
    plain: 'Replicated — the server keeps this value in sync on every client.',
    whyItMatters: 'Without it, multiplayer clients would see a stale value.',
  },
  CPF_RepNotify: {
    term: 'CPF_RepNotify',
    plain: 'Replicated AND calls an OnRep_ handler whenever the value changes.',
    whyItMatters: 'Use it to react to network updates (e.g. play a hit effect on a health change).',
  },
  CPF_Transient: {
    term: 'CPF_Transient',
    plain: 'Never saved to disk — runtime-only state.',
  },
  CPF_SaveGame: {
    term: 'CPF_SaveGame',
    plain: 'Included in save-game serialization — persists across sessions.',
  },
  CPF_EditConst: {
    term: 'CPF_EditConst',
    plain: 'Shown in the Details panel as read-only — useful for debug inspection.',
  },
  CPF_Config: {
    term: 'CPF_Config',
    plain: 'Backed by an .ini config file — its default is read from project settings.',
  },
  CPF_InstancedReference: {
    term: 'CPF_InstancedReference',
    plain: 'Holds its own sub-object instance rather than a shared reference.',
  },
};

// ─── EGPD_* pin directions ───────────────────────────────────────────────────
// Raw EEdGraphPinDirection enum names from a node's pin list.

const PIN_DIRECTIONS: Record<string, JargonEntry> = {
  EGPD_Input: {
    term: 'EGPD_Input',
    plain: 'An input pin — data or execution flows INTO the node here.',
  },
  EGPD_Output: {
    term: 'EGPD_Output',
    plain: 'An output pin — data or execution flows OUT of the node here.',
  },
};

// ─── Diff change codes ───────────────────────────────────────────────────────
// The three-letter badges shown on each diff change card, keyed by the display
// code so a chip rendered as "MOD" can be decoded directly. Derived from the
// authoritative CHANGE_TYPE_META table (blueprint-jargon.ts): the hover text
// leads with the plain-English label ("Modified — …") so the bare code decodes.

const CHANGE_CODES: Record<string, JargonEntry> = Object.fromEntries(
  Object.values(CHANGE_TYPE_META).map((meta) => [
    meta.code,
    {
      term: meta.code,
      plain: `${meta.label} — ${meta.plain}`,
      ...(meta.why ? { whyItMatters: meta.why } : {}),
    } satisfies JargonEntry,
  ]),
);

// ─── Diff scopes ─────────────────────────────────────────────────────────────
// What kind of thing a change applies to (the `scope` field on a SemanticChange).

const SCOPES: Record<string, JargonEntry> = {
  variable: {
    term: 'variable',
    plain: 'A stored value (field) on the class — e.g. Health or MoveSpeed.',
  },
  function: {
    term: 'function',
    plain: 'A reusable piece of logic callable from both C++ and Blueprint.',
  },
  event: {
    term: 'event',
    plain: 'A hook that runs when something happens — e.g. BeginPlay or Tick.',
  },
  logic: {
    term: 'logic',
    plain: 'Runtime node logic wired inside a graph.',
  },
  binding: {
    term: 'binding',
    plain: 'A UPROPERTY/UFUNCTION wiring that exposes C++ to Blueprint.',
  },
};

/** Raw transpiler tokens layered on top of the base UE5 jargon dictionary. */
const TRANSPILER_TERMS: Record<string, JargonEntry> = {
  ...CPF_FLAGS,
  ...PIN_DIRECTIONS,
  ...CHANGE_CODES,
  ...SCOPES,
};

/**
 * Look up the plain-language entry for a term. Checks the transpiler-specific
 * tokens first, then falls back to the base UE5 jargon dictionary. Returns
 * `undefined` when the term is unknown (callers should fail soft and show the
 * raw term unchanged). Matching is case-sensitive — engine tokens are.
 */
export function lookupTerm(term: string): JargonEntry | undefined {
  return TRANSPILER_TERMS[term] ?? lookupJargon(term);
}

/**
 * The full hover string for an entry: the plain description, plus the optional
 * "why it matters" hook when present.
 */
export function termTooltip(entry: JargonEntry): string {
  return entry.whyItMatters ? `${entry.plain} — ${entry.whyItMatters}` : entry.plain;
}

/**
 * Does this token look like a raw engine identifier (vs. an everyday English
 * word)? Used to decide which tokens to auto-decorate inside free-text warnings,
 * so common scope words like "function" or "event" aren't underlined mid-sentence
 * while `K2Node_Timeline`, `CPF_Edit`, or `UPROPERTY` are.
 */
export function isRawEngineToken(term: string): boolean {
  // Contains an underscore (CPF_Edit, EGPD_Output, K2Node_CallFunction,
  // GENERATED_BODY) or is an ALL-CAPS macro of length >= 3 (UPROPERTY, UFUNCTION,
  // UCLASS, DOREPLIFETIME).
  return /_/.test(term) || (/^[A-Z]{3,}$/.test(term) && term === term.toUpperCase());
}
