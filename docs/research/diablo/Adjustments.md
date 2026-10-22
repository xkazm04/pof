# Adjustments — the ledger

One line per adjustment, with the number it moved. An adjustment that moves no measured number
did nothing measurable, and says so.

Generation 1's ledger (W00–W107) is lost ([Findings](Findings.md) F-G2-1). Its outcomes survive only as the
one-line DELIVERED entries in the repo's `.claude/fleet-memory.md` and
`.claude/fleet-memory-archive.md`, which are the authority for anything before 2026-10-22.

## Generation 2

- **A-G2-1 (2026-10-22, W108)** — `status.ts` survives a cold store and never calls unknown
  staleness "none" (`scripts/diablo/catalogs/pool.ts` + `statusPool.test.ts`, 4 tests).
  *Measured:* the snapshot went from a hard crash at `descentSim.ts:771` to a full 20-catalog
  table reading 0/0/0 with `(no ingest runs yet)`. No store numbers moved — this is a
  measurement-tool fix, not a mapping change, and it changes no projection.
- **A-G2-2 (2026-10-22, W108)** — the reference source re-cloned at the recovered pin and the
  wrapper store rebuilt from the surviving mappings. *Measured:* created 1983 · rawChanged 0 ·
  reprojected 0, then idempotent at created 0 · unchanged 1983. Coverage restored to the
  generation-1 figures (items 95.7, dialog-trees 100, vfx 100, progression-curves 100,
  quests 88.9, affixes 66.7, bestiary 60.0, props 58.3, spellbook 40.0, characters 0).
- **A-G2-3 (2026-10-22, W108)** — the Diablo reference source is pinned IN THE REPO:
  `DIABLO1_PIN` + `DIABLO1_OBTAIN` (`src/lib/catalog/ingest/diablo1.ts`), `pin:` set on `DIABLO1`,
  both asserted by `diablo1-mapping.test.ts`; the obtain recipe is the exact command sequence that
  rebuilt the clone, so it is verified by execution, not by review. *Measured:* the source went
  from `pin: undefined` to a 40-char commit, and a re-ingest after the change moved nothing
  (created 0 · rawChanged 0 · reprojected 0 · unchanged 1983) — the pin is provenance, not a
  projection input, which is the correct outcome and is now pinned by a test.
- **A-G2-4 (2026-10-22, W109)** — the UE dependency split into its two real halves after being
  conflated since W10 (`Path/Capability - UE Upstream`). *Measured:* one of the two halves moved
  from "blocked" to "needs a git clone" — `snapshot-ue-schema.ts` reads headers as text and the
  25-type / 187-field snapshot is committed, so schema-down parity never needed an engine. No
  store number moves; this is a graph correction, and the kind the loop exists to find.
