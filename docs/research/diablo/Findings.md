# Findings — defects in the source data and in the loop's foundations

Not PoF content defects (those are the backlog's business) — these are facts about the reference
data and about the loop's own machinery.

## F-G2-1 — the loop's memory had a single point of failure (2026-10-22)

The machine was reset around 2026-10-19 (`~/Documents` holds only junctions re-created 15:19 that
day). Gone with it: this vault, the devilutionX clone, `~/.pof/pof.db`, the UE project, the codex
ledger. No backup existed anywhere — C: is the only drive, and nothing was in Desktop/Downloads
or any sync folder.

What survived did so **because it was in the repo**: the mappings, the canon profile, the 34+
catalog scripts, the fleet-memory summary of W00–W107, and — by accident — the reference pin,
embedded in the canon `refs:` strings. Everything the SKILL designated as "memory" was lost;
everything it designated as "engine" survived.

The real finding is about the design, not the disk: a loop whose product is *the adjustments*
kept its ledger of adjustments only outside version control. `Adjustments.md`, `Path/` and
`Backlog.md` were the whole point of the exercise and they were the only part with no redundancy.

## F-G2-2 — `status.ts` could not report a cold store (2026-10-22, fixed)

The GATE snapshot died on an empty store instead of describing it: `descentSim.ts:771` throws
`the supplied wrappers have no d1-class-warrior aggregate`, which the `combat-map` handler's pool
raised through `status.ts`. So the one tool a human reads before every wave was unusable in
precisely the situation that most needs it. Fixed in `scripts/diablo/catalogs/pool.ts`
(`resolveStalenessPool`): a handler pool is built only when something is promoted to compare, a
pool that cannot be built reports its reason, and staleness then prints as UNKNOWN rather than
as "none". See [Adjustments](Adjustments.md) A-G2-1.

## Source-data sentinels still flagged at the restored pin

Unchanged from generation 1, re-confirmed by runs #1/#2 — recorded here so a later wave does not
re-discover them: `monsterPack = None ×29`; `power3/power4.value1/value2 = -1`; `adjMana = -1`;
`spell = Null` on each class row. Unresolved links: 6 (`bestiary:d1-MT_HORKDMN`,
`d1-MT_DEFILER`, `d1-MT_NAKRUL`; `spellbook:Mana`, `spellbook:Search`; `items:LGTFORGE`) — the
three monsters and LGTFORGE are Hellfire-scoped, which generation 1 established.
