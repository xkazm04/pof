# Backlog — Phase A

`status: open | done | decision | descoped`. New defects found while working are ADDED here with
evidence; the list is allowed to grow.

Generation 1's backlog is lost ([Findings](Findings.md) F-G2-1). It is not reconstructed from memory — the
loop rebuilds forward, and a defect that still exists will be re-found by the wave that touches it.

## open

- **B-G2-1 — the loop's memory has no redundancy.** `Adjustments.md`, `Path/` and `Backlog.md`
  are the loop's product and live only in this vault, outside version control, on one disk.
  *Evidence:* [Findings](Findings.md) F-G2-1 — the whole of W00–W107's state was lost to one machine reset
  while every file in the repo survived. *Fix shape:* a decision, not a patch — see D-G2-1.
- ~~**B-G2-2 — the reference pin survived only by accident.**~~ **done 2026-10-22.** `State.md` was its designated home
  (`SKILL.md` line 28: "pinned (see State.md)"); it was recoverable only because it is also
  embedded in `src/lib/catalog/canon/profiles/diablo1.ts` `refs:` strings. *Fix shape:* name the
  pin in the repo deliberately — a constant beside `DIABLO1` in `reference/sources.ts`, asserted
  against the clone's HEAD by the mapping test, so a drifted clone fails loudly instead of
  re-projecting silently.
- **B-G2-3 — a cold store is unexercised by the test suite.** F-G2-2 was a crash on the empty
  path of the one tool a human reads before every wave, and nothing caught it for 107 waves
  because the store was never empty again after W00. *Fix shape:* the handler-pool contract now
  has a test; the `ingest → status` pair on an empty throwaway DB does not.

## decided at W108's gate (2026-10-22)

- **D-G2-1 → (b).** The loop's product is repo state: `Adjustments.md`, `Backlog.md`, `Path/` and
  `Findings.md` live here, in `docs/research/diablo/`, and are committed with each wave; `State.md`
  and `Waves/` stay in the vault as working notes. (`Findings.md` was not named in the decision —
  moved on the overseer's judgment, since leaving the analysis of the lost memory in the one place
  that had already been lost would defeat the decision's purpose. Reversible: it is one file.)
  B-G2-2 landed with it — `DIABLO1_PIN` / `DIABLO1_OBTAIN` in `src/lib/catalog/ingest/diablo1.ts`,
  `pin:` set on `DIABLO1`, asserted by `diablo1-mapping.test.ts`, mirroring what `BOTW` already did.
- **D-G2-2 → (a).** Re-promote nothing. Each wave promotes the slice it is actually reviewing, as
  the "promote selectively" law intends. `Path/Data - Promotion` stays ready, not blocked.
- **D-G2-3 → UE first, on this device if it can be made to work.** The operator wants the UE
  environment installed and running here, and the ARM64 question answered: overcome it, or split
  UE onto a second device. That is wave W109 and it outranks every Phase B content wave.

## decision (never decided by the loop — collected for the gate)

- ~~**D-G2-1 — where the loop's memory lives.**~~ *(decided — see above)* Options: (a) keep the vault as-is and accept that a
  reset ends the loop; (b) move `Adjustments.md` / `Path/` / `Backlog.md` into the repo under
  `docs/research/diablo/` (they contain no reference VALUES, only PoF's own findings, so the
  values-never-enter-the-repo law does not forbid it) and leave `Waves/` and `State.md` in the
  vault; (c) keep the vault and have the loop commit a generated digest of it into the repo each
  gate. *Recommendation:* (b) — the three files are the loop's product, they are already
  value-free, and the reset proved the repo is the only durable surface on this machine.
- ~~**D-G2-2 — what to re-promote, and whether to.**~~ *(decided — see above)* Generation 1 promoted ~700 entities across 20
  catalogs over 107 waves; none exist now. Options: (a) re-promote nothing and let each new wave
  promote its own slice, as the "promote selectively" law intends; (b) re-promote the slices the
  UE work depended on, once UE is back; (c) bulk re-promote everything the handlers can build, to
  restore the old snapshot. *Recommendation:* (a) — bulk re-promotion would recreate the numbers
  without recreating the reviewing, and a promoted entity nobody is reviewing is exactly what the
  law forbids.
- ~~**D-G2-3 — the UE half.**~~ *(decided — see above: W109)* `~/Documents/Unreal Projects/PoF` is absent, so `schema flows down
  from UE` (canon `proj-sot`) currently has no upstream and `npm run snapshot:ue-schema` refuses a
  missing root by design. Until it is restored, every UE-dependent wave is blocked, not merely
  slower. *Recommendation:* decide whether UE comes back at all before any Phase B wave is picked;
  if it does not, the loop's remaining product is app-side only and should say so.
