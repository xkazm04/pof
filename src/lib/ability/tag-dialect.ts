/**
 * Gameplay-tag dialect — ONE mapper between the two spellings of the same tag.
 *
 * UE5 declares each gameplay tag twice in `UE_DEFINE_GAMEPLAY_TAG_COMMENT`:
 * a **C++ identifier** (`Ability_Melee_LightAttack`) and the **tag string**
 * (`Ability.Melee.LightAttack`). `ue5-source-parser.ts` records both sides of
 * that pair on every `ParsedTag`, so when parsed source is at hand the parsed
 * declaration table is authoritative.
 *
 * At the forge→spec adopt boundary there is no parsed table: the model emits
 * C++ identifiers (`Ability_<Name>` / `State_<…>`, per the forge OUTPUT_SCHEMA)
 * while specs, spellbook data and the tag audit all speak dotted tag strings.
 * Adopted rows therefore could never match the audit. These helpers apply the
 * same underscore↔dot convention the engine uses, so the app has exactly one
 * dialect — dotted — everywhere a tag is compared.
 *
 * Pure: no I/O, no React, safe on both sides of the source-parse seam.
 */

/**
 * C++ identifier → dotted tag string (`Ability_Fireball` → `Ability.Fireball`).
 * A tag that already contains a dot is assumed to be in the dotted dialect and
 * is returned trimmed but otherwise untouched — the conversion is idempotent,
 * so it is safe to run over mixed-dialect input.
 */
export function toDottedTag(tag: string): string {
  // Strip a C++ scope qualifier (`ARPGGameplayTags::State_Dashing`): the forge's
  // few-shot code spells tags that way, and the qualifier is engine syntax, not
  // part of the tag. Without this the `::` survives into the "dotted" tag and
  // the row matches nothing in the audit.
  const t = (tag ?? '').trim().replace(/^.*::/, '').trim();
  if (!t) return t;
  // Edge separators carry no segment: `State_Dead_` must not become `State.Dead.`
  // (an empty trailing segment is not a legal tag and never matches a declaration).
  if (t.includes('.')) return t.replace(/^[._]+|[._]+$/g, '');
  return t.replace(/^_+|_+$/g, '').replace(/_+/g, '.');
}

/** Normalize a list to the dotted dialect, dropping empties and de-duping (order kept). */
export function toDottedTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const tag = toDottedTag(raw);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}
