# Lessons — perfect

## 1.0 — 2026-08-17 — pof

- **A per-project skill copy can be silently shadowed by the workspace library copy, and nothing warns
  you.** `pof/.claude/skills/perfect/SKILL.md` existed, was well-formed, and was *not* what the harness
  registered — `~/.claude/skills/perfect/SKILL.md` was. The tell is the description string in the
  available-skills listing: it read "walks the repo's context map" (library wording) where the project
  copy said "walks context-map.json". Consequence: `/perfect` in a Next.js repo was running a method whose
  builder brief ordered `npm run check`, `cargo test export_bindings`, 13-locale translation and
  `src-tauri/src/lib.rs` Class C handling — none of which exist there. **Add to Phase 0: compare a
  distinctive phrase from the project copy's `description:` against the registered listing before trusting
  that your edits to the project copy govern anything.**

  ### Redesign proposal
  The root cause is that this skill mixes an application-agnostic *method* (roles, vault schema, the P/B/W
  state machine, the disjoint-lot wave shape) with a per-repo *overlay* (gates, repo law, Class B/C file
  lists, vault path, dev port). That mixture is why a library copy and a project copy must both exist and
  therefore why one can shadow the other, and it is why the reflection contract's "copy to
  `~/.claude/skills/<name>/`" sync step is actively unsafe here — publishing PoF's copy would impose PoF's
  conventions on every sibling. **Split SKILL.md into `SKILL.md` (method, publishable to the library) and a
  repo-resolved overlay (`config.md` in the vault, or `OVERLAY.md` beside the skill) that the method reads
  at Phase 0.** Not applied in this bump: it changes the file layout for every project already running the
  skill, so it wants its own coordinated change. Guarded against in the meantime by a second exception on
  the sync ritual forbidding step (b) for this file.

- **The filename case is load-bearing and `core.ignorecase=true` hides it.** Git tracked this skill as
  `skill.md` while every sibling skill in the same repo was `SKILL.md`; on Windows both resolve, so the
  defect survived indefinitely. It would break skill discovery on the first case-sensitive clone (CI, a
  Linux peer). Worth a one-line check in any skill-authoring pass: `git ls-files .claude/skills/` and
  confirm the casing matches its siblings, since the working-tree `ls` will not show you the mismatch.

- **A user's go-ahead is scoped to the facts it was given, and concurrent-session facts expire in
  minutes.** The operator approved a 206-commit sync of a sibling repo on the stated basis that no dirty
  file was touched by an incoming commit — true when measured, false 14 minutes later, because the live
  session in that tree had moved on to `Cargo.toml`/`Cargo.lock`/`lib.rs`, all of which the incoming
  commits also touch. **Re-measure a concurrency precondition immediately before the mutating command, not
  at the moment you ask about it** — an approval is not a lease on the other session's tree.
