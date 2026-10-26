---
kind: data
status: ready
requires: ["[Data - Ingest Foundation](Data%20-%20Ingest%20Foundation.md)"]
evidence: "nothing is promoted (status.ts: promoted 0 across all 20 catalogs), so every pipeline step and every acceptance verdict is unreachable; promotion is the only edge out of the restart"
---

# Data - Promotion

Gated on D-G2-2 — the loop collects the decision, it does not take it. The "promote selectively"
law means the right next promotion is whatever the next wave is actually reviewing, which is why
this node cannot be closed by a bulk restore.
