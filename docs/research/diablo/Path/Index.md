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
- [Capability - UE Upstream](Capability%20-%20UE%20Upstream.md) — blocked (D-G2-3)

## Chronology

- 2026-10-22 · [Data - Ingest Foundation](Data%20-%20Ingest%20Foundation.md) · re-established from the repo's mappings at the
  recovered pin `4138a82`: 1983 wrappers, idempotent, rawChanged 0. Generation 2 needed the
  reference source and a working GATE snapshot before anything else — and discovered, in that
  order, that the pin lived in the wrong place (B-G2-2) and that the snapshot could not describe
  an empty store (F-G2-2).
