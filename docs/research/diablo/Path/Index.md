# Path — the dependency graph

One note per node. A dependency is written down only with evidence (a failing step, a missing
field, a prompt with nothing to cite). "Feels like it comes first" is not evidence.

Generation 1's graph is lost ([Findings](../Findings.md) F-G2-1); its chronology survives only as the repo's
fleet-memory lines. Generation 2's graph starts from what the restart itself proved.

## Ready frontier (2026-10-22)

- [Data - Promotion](Data%20-%20Promotion.md) — `requires:` [Data - Ingest Foundation](Data%20-%20Ingest%20Foundation.md) (done). Ready, but gated on
  D-G2-2: the loop may not decide for itself what to re-promote.

## Nodes

- [Data - Ingest Foundation](Data%20-%20Ingest%20Foundation.md) — done
- [Data - Promotion](Data%20-%20Promotion.md) — ready (gated on D-G2-2)
- [Capability - Memory Durability](Capability%20-%20Memory%20Durability.md) — open (B-G2-1 / D-G2-1)
- [Capability - UE Upstream](Capability%20-%20UE%20Upstream.md) — in-progress (W109). Splits in two:
  schema-down parity is NOT blocked (the snapshot reads headers as text and its output is
  committed), producing-and-verifying needs a UE runtime on reachable hardware.

## Chronology

- 2026-10-22 · [Data - Ingest Foundation](Data%20-%20Ingest%20Foundation.md) · re-established from the repo's mappings at the
  recovered pin `4138a82`: 1983 wrappers, idempotent, rawChanged 0. Generation 2 needed the
  reference source and a working GATE snapshot before anything else — and discovered, in that
  order, that the pin lived in the wrong place (B-G2-2) and that the snapshot could not describe
  an empty store (F-G2-2).
- 2026-10-22 · W109 established what the UE dependency actually is: Epic does not support the
  Editor on ARM64 at all (game targets only, Experimental), so this device can host the editor
  only under x64 emulation — while the half of the UE dependency PoF leans on hardest,
  schema-down parity, turns out to need no engine whatsoever. The cheap half was blocked for
  three days by being bundled with the expensive one.
