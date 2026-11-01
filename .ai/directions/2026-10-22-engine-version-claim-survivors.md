---
subject: game-production/engine-version-claims (which 5.7 mentions stay after the 5.8 standardization)
project: pof
raised_by: App Master charter accepted-idea-delivery, 2026-10-22 (headless builder, branch autopilot/accepted-idea-delivery-29476864)
source: docs/ue58-mcp-convergence-plan.md (milestone 3 goal 4); .ai/directions/2026-10-22-ue-engine-path-resolution.md
stage: prompt and canon surfaces (canon seed, animation checklist, CLI skills, setup wizard, engine-facts)
size: comments, one canon literal, two wizard notes, one test (S)
status: proposed
---

# Engine version claims: keep-or-gate rule

## 1. How to read this

- Status is `proposed` until the operator accepts it. Nothing was verified on a 5.8 editor: none is available to this session.
- Engine PATH literals were already on UE_5.8 (`614536f8`); this record covers the version CLAIMS only.

## 2. The rule

1. A live product claim injected into prompts is changed to 5.8 (`canon-seed.ts` `game-genre` now says UE5.8; the version was kept in the body because the canon is the single place a judged entity learns the engine).
2. A "5.7+" marker is an availability floor and stays; one comment atop the skill block in `skills.ts` says so.
3. A fact verified on 5.7.3 stays, marked "not re-verified on 5.8, 2026-10-22" (animation checklist `constants.ts`). The AnimBP state-machine claim cites `2026-10-22-anim-blueprint-retire-blocker.md` instead of restating it.
4. A deliberate version branch stays and says so (`FACTS_5_7` in `engine-facts.ts`; the header did not say it plainly, so a two-line comment was added).
5. The setup wizard keeps all four version pills; notes are now 5.7 "supported", 5.8 "latest · tooling default".

## 3. Guard

`src/__tests__/lib/engine-version-claims.test.ts` fails on any `UE_5.7` literal in non-test files under `src/`, `scripts/`, `e2e/`, and on a 5.7 claim in the genre canon. Test fixtures under `src/__tests__/` deliberately name old installs and are excluded.

## 4. Open

- Re-verifying the 5.7.3 commandlet facts on 5.8 needs an editor; until then they stay dated.
