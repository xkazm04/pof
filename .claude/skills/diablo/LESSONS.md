# Lessons — diablo

## 1.0 — 2026-09-22 — pof
- **The registry consult changed the design and caught a defect, and it came AFTER the build.** The wrapper store was designed and implemented first; reading `import-normalization` then exposed that promotion bypassed the code-seed refusal (one validation door), and `reference-parity-gating` reshaped decision D3 (a reference-seeded step must not self-grade `pass`). Applied as a Law in v1.1: consult before a design decision.
- **Before calling a field a "design gap", grep the UE project for it.** Four of the dry run's gaps (slots, resistances, affixes, difficulty scaling) already existed in UE `Source/`; they were app-payload-vs-UE gaps, a different decision. Already a Law ("Schema flows down from UE").
- **Check whether a pipeline STEP already owns the field before mapping it onto the entity payload.** Bestiary's `Resistances` and `Monster Rarity` steps were the right home for two "gap" columns — which reframed the whole of Phase B as populating step artifacts (D3).
