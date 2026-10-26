# Asset needs: `asset-needs/1`

POF reads a game project's own files and writes what that project still needs from an asset maker to the tracked file
`asset-needs/<project>.json`. Gravitone's scout night reads it (spark scout-vision S4): a game-asset brief for a
project must name one of its needs and takes the need's budget. POF owns the standard and the scorer; each game gets an
adapter. No POF server, no DB, no media model.

```bash
npx tsx scripts/asset-needs.ts bp     # BP_ROOT, else the sibling ../bp; bp is only read
```

Exit 0 written, 1 refused (a source is unreadable, or the contract refuses the result; the old file stays), 2 unknown
project. Only `bp` is onboarded; `pof` is refused because its UE project is gone (fleet-memory, 2026-10-22).

## Code

| File | Role |
|---|---|
| `src/lib/asset-needs/schema.ts` | The contract: zod validator (`validateAssetNeeds`), types, `ASSET_NEEDS_SCHEMA`, `serializeAssetNeeds` (contract key order, 2-space JSON, trailing newline) |
| `src/lib/asset-needs/score.ts` | Markdown readers: pipe tables with source lines, a 0-3 scorecard table, a `Pass:` rule line, a paragraph by its first words |
| `src/lib/asset-needs/bp.ts` | The bp adapter, pure over file text: inventory, joins, needs, rules notes |
| `scripts/asset-needs.ts` | Reads bp's files and both HEADs, runs the adapter, validates, writes `asset-needs/bp.json` |
| `src/__tests__/scripts/assetNeeds.test.ts` | The adapter over fixture texts, and the validator's refusals |

## The contract

```jsonc
{
  "schema": "asset-needs/1",
  "project": "bp",
  "generatedAt": "<ISO>",
  "source": { "repo": "bp", "commit": "<bp HEAD>", "pofCommit": "<pof HEAD>" },
  "rules": { "budgets"?: { "<class>": tris }, "notes": ["<a rule a new asset must follow (its source)>"] },
  "inventory": [{ "id", "name", "class", "gravitoneClass"?, "tris"?, "budgetTris"?, "gates": { "<gate>": bool },
                  "score"?: { "value", "of": 3, "source" } }],
  "needs": [{ "id": "need-<kebab>", "kind": "missing" | "scored-low", "subject", "class", "gravitoneClass"?, "why",
              "evidence": "<file:line>", "budgetTris"?, "priority": 1 | 2 | 3, "assetId"? }]
}
```

Absent values are omitted, never `null` (the validator refuses a null). `gravitoneClass` (`character` | `weapon` |
`prop`) absent means not briefable by gravitone: materials, backdrops, hand captures, shaders, data-built elements. An
`assetId` must name an inventory row; a `missing` need never carries one.

## The bp adapter

| Field | Source in bp |
|---|---|
| inventory | every `apps/vr/ArtSource/*/manifest.json`: `class`, `tris` (summed, the largest mesh when `budget_note` says per mesh, as `scripts/check-art.mjs` (c)), `budget_tris`, `gates.<g>.pass` |
| gravitoneClass | `character-prop` -> character; `prop-hero`, `prop-instanced`, `prop-instanced-kit`, `studio-kit`, `set-dressing` -> prop; `material`, `backdrop-matte`, `capture-hands` -> none; an unknown class -> none plus a rules note |
| score | the newest dated note in `docs/concepts/vr-light-table/runs/`: its element table's `Now` of 3, joined to a folder only where the element names it (`BP_ELEMENT_FOLDERS` in `bp.ts`) |
| scored-low | an element with `Now` below the floor of `art-breakdown.md`'s `Pass:` line; priority 1 when that line requires the element at 3, else 2; `why` is the scorecard's own words |
| missing | an `art-breakdown.md` element whose `Built as` names `generated` (the only kind handed off as an ArtSource folder) with no folder; priority 2 |
| budgetTris | the joined manifest's `budget_tris`, else the `plan.md` P4 per-asset guide row for the element; omitted when bp states none |
| rules | `rules.budgets` is omitted (bp budgets per asset, not per class); notes quote the pass rule, the poly-budget rule, the gates, the P4 chain and scene budget, prop-sheet input gating, the style block and the ORM texture convention, each with its file |

The adapter refuses (exit 1) rather than guesses when the scorecard table, the pass rule or the breakdown table is
missing.
