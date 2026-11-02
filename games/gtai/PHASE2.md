# Phase 2: Production plan (RTAI: Uprising, internal id `gtai`)

Signed off by the owner in the `/spark gtai-phase-2` design dialog on 2026-11-02. Three waves, 11 questions. The design record lives in the vault: `Spark/ideas/gtai-phase-2.md`.

This file is **how we build the game**: the phases, their exit gates, the way of work, the test strategy, and the first tickets.

- The binding engineering rules are in [`STANDARDS.md`](STANDARDS.md); rule IDs such as `GIT-02` point there.
- Design truth is in [`pitch.md`](pitch.md).
- Where we are is in [`STATE.md`](STATE.md).

The governing standard is the registry's `production-work-prioritization/vertical-slice-as-the-first-milestone`. Its rule:

> **One complete path, every layer real, narrow only in breadth.**

Automated planners drift towards building many systems side by side. That drift is the failure this plan is shaped against.

---

## 1. Decisions this plan rests on (owner, 2026-11-02)

| Topic | Decision | Rejected |
|---|---|---|
| **Shape** | **Foundation, then the vertical slice.** After that come Act 1, the campaign and ship. | City tech first (nothing playable for weeks); breadth on the prototype |
| **Repo** | **A fresh repo**, `C:\Users\kazda\kiro\gtai`, built by STANDARDS §22. Prototype systems are ported **one at a time with tests**. The `gtai-spike` trees are frozen reference. | Refactoring evolve in place; the game inside the PoF repo |
| **Hosting** | A **private GitHub repo with LFS**. Expect the $5/50 GB data pack once art waves land. Masters stay off git, on local disk plus a backup. | Local-only; another host |
| **PoF for Godot** | Four capabilities, all in Phase 2: **the evidence adapter, the Godot harness gates, a build-health page, and the GTAI story map in `/story`** | — |
| **Cadence** | A **day handshake plus night agent lanes**. Codex makes the images. Every night ends on gated evidence, and the owner reviews it in the morning. | Daytime-only; fully continuous |
| **Slice content** | The **Clock-Out tutorial, the first contract, and Gearbox** (car hijack). Contract and character choices are made with the owner via `/gta --quest`. **King leaves the slice** for a later act. | A King contract; Hauler; two souls |
| **Slice art** | The slice is **built in D4 Ink and Hatch (hybrid)**. If D4 fails its gates, the fallback is **D3 Clear Line**. D2 is out. | D1 with a D4 trial alongside; D4 after the slice |
| **Public title** | **RTAI: Uprising**, where RTAI is "Robot Theft A.I.". This avoids the GTA trademark proximity. The internal id `gtai` stays in code and paths. | Counsel clearing "GTAI" |
| **Steam app** | Created **at slice end**. Until then, the `Platform` NullBackend and its local mirror stand in (app 480 is used only for API smoke tests). | During Foundation |
| **Timeline** | **No calendar until the slice exits.** Next Fest and the release window are chosen then. | June 2027 Next Fest; February 2027 Next Fest |
| **Steam Deck** | **Bought near release.** Until then the slice is measured on the CPU-throttle proxy. The risk is accepted (§7). | Buying during Foundation; buying before Act 1 |

---

## 2. Phases and exit gates

Phases are **milestones, not dates**. A phase exits only when every gate below it holds, with evidence. A claim is not evidence.

### Phase 2a: Foundation

**Goal:** the repo, the gates, PoF's view of Godot, and the hardened city technology. **Without them, nothing in the slice can be built honestly.**

| Ticket | What | Done when |
|---|---|---|
| **F-01** Repo bootstrap | STANDARDS §22 steps 1-13; the test-framework shootout; the evidence writer | The `gtai-phase-2` WP3 exit: LF check, gdlint clean, a sample test green headless, evidence files at HEAD |
| **F-02** PoF evidence adapter | `pof.godot-evidence/1` reader; the godot L2 branch; harness `godot-test`/`godot-export` gates | WP2 acceptance criteria; PoF reads F-01's evidence as `pass` (the seam smoke) |
| **F-03** GitHub remote (**owner**) | Create the private repo, `git remote add`, push, enable LFS, run CI once | A green CI run on GitHub |
| **F-04** Event bus and composition root | The `Events` autoload (typed signals, `events.json`), `WorldContext`, the autoload budget of 7 or fewer | ARC-0x rules; a unit test per signal contract |
| **F-05** Determinism core | A fixed 60 Hz tick, one seeded RNG per system, a replay log | SIM-01..08; a replay test reproduces a recorded 60 s run bit-identically |
| **F-06** City port | Port `cityscale` (streamer, bubble, the native `city_sim` as a GDExtension with pinned godot-cpp, MultiMesh crowds) into feature folders | NAT rules; the parity gate is in CI; the bench evidence (`bench.json`) is green on the hard budgets |
| **F-07** City hardening | Profile the 165-440 ms stall (WPR or PIX on an idle machine); the crowded-drive bench; the police flow field | No unexplained frame over 50 ms in 3 consecutive benches; a crowded-drive scenario in the bench suite |
| **F-08** D4 art lane: world | Codex in D4 hybrid: roof sheets, ground, props for one district; the `--look=wash` print pass productionised | The 32 px/m and 48 px/m crop gates beat or match D1; the provenance log is filled |
| **F-09** D4 art lane: characters | Rivet's parts and the slice's cop and pedestrian parts in D4 on the cutout rig; the rig port with LOD and pooling | Rivet reads at 32 px/m in the 3x crop test; the 50- and 200-rig stress is within budget |
| **F-10** PoF build-health page | A Game home panel plus `GET /api/games/[gameId]/build-health`, reading every evidence kind | It renders in dev from the main checkout; it shows pass, fail, stale and absent honestly |
| **F-11** PoF GTAI story map | Connect `buildCampaignGraph` to `/story` for GTAI; quests and arc beats become walkable | `/story?g=gtai` renders the campaign graph from `games/gtai/quests` |
| **F-12** Quest runtime port | Port `game/quest/` from `evolve/project-quest` (the unmerged branch) as a feature with tests | A `gtai.quest/1` fixture plays headless in a scenario test |
| **F-13** Texel-density decision | An A/B gate at 64-96 px/m against 128 px/m for world art | The VRAM and readability numbers are recorded in `docs/decisions.md` (AST-06) |

**Exit:** F-01 to F-13 are done. CI is green on GitHub. PoF shows the game's evidence. The city port meets the §20 hard budgets on the PC and the throttle proxy.

### Phase 2b: Vertical slice (D4)

**One path, every layer real:**
1. A prologue cut, the in-engine top-down takedown, kept short.
2. **The Clock-Out tutorial:** movement, roll, electroshock melee, and the first pistol taken off a cop.
3. **The first contract**, chosen with the owner through `/gta --quest`. It is generated by the council, passes the PoF guards, and is played by the ported quest runtime.
4. **The Gearbox soul** unlocks, with its real ability (remote-hijack a car in view) and its first upgrade tier.

On the way, every layer is real:
- heat levels 1-3 (the heat ladder with real escalation, not scripted wanted);
- Madness band 1, with barks from the voice bibles;
- one streamed district;
- a checkpoint save and load (SAV rules);
- achievements unlocking on the local mirror;
- the arena camera, if the contract has a fight target.

**Exit gates (owner, all four):**
1. **The owner plays it start to finish.** Nothing is scripted or faked on the path.
2. **The STANDARDS §20 hard budgets hold** on the PC and the CPU-throttle proxy:
   - 1% low above 45 fps;
   - CPU p99 at or below 7 ms;
   - no swap frame over 50 ms;
   - the hitch log is clean or every hitch is attributed.
3. **All gates are green in CI:** lint, typed code, unit and scenario tests, the parity gate, the export audit, and the achievements generator.
4. **It is visible in PoF.** The build-health page and the pipeline steps show the slice's state from game-written evidence. Nothing is deferred or hand-set on the path.

**At slice exit:**
- Create the Steam app (as RTAI), including the legal entity question.
- Choose Next Fest and the release window.
- Set the calendar for Phases 3-5.

### Phase 3: Act 1

**Design gates before entry** (the open points in `pitch.md`, decided through `/gta` and `/gta --quest`):
- the act antagonist order and allegiance (King is in a later act, per the owner);
- the district count and Act 1's district;
- Act 1's friendly bosses;
- the Krump radio questline opening.

**Exit:** Act 1 is playable start to end. The real Steam app has achievements, cloud saves and the overlay, smoke-tested.

### Phase 4: Campaign

Acts 2-4, the Pentagon finale, and all four souls.

**Design gates before entry:**
- the fourth soul;
- the betrayer;
- the final punchline.

**Exit:** about 5 hours, complete, and the owner has played it through.

### Phase 5: Ship

- **Store:** the store page, capsules and the content survey (the AI disclosure from `docs/provenance.md`).
- **Platform:** the Deck (bought now) and its Verified review, the regional decisions, and the release checklist (STANDARDS §18-19).
- **Exit:** released.

---

## 3. Way of work

### The day and night loop (`/gta`)
1. **Handshake.** `/gta` reads STATE.md and this plan, shows the state brief, and agrees today's or tonight's tickets with the owner.
2. **Lanes.**
   - **Code lanes** are Claude builders on file-disjoint tickets in the game repo, one worktree per lane.
   - **The art lane** uses Codex `image_gen` (recipe: `research/chatgpt-pro-image-route.md` §8; layout-template technique: `gtai-spike/cutout/JOURNAL.md` "Codex round").
   - **PoF lanes** follow PoF's own `/spark` rules.
3. **Every lane ends on evidence**, never a claim: green gates, frames and clips, bench JSON, all written as `pof.godot-evidence/1` where a kind exists.
4. **Morning.** The owner reviews the evidence in PoF (the build-health page) and on disk. `/gta` writes STATE.md.
5. **Billing:** the API key first, then failover to the subscription, as in the spike runner.

### Ticket discipline
- **One ticket, one lane, one feature folder.** No ticket edits another ticket's folder.
- **Ports move one system at a time:** a test first, then the port, then the evidence. Nothing is bulk-copied. `main.gd` is never copied (STANDARDS §21).
- **Every new content type enters the right PoF pipeline first**:
  - contracts go to `contracts` through `/gta --quest`;
  - art goes to the catalog art steps;
  - the story goes to `/story`.

  The owner sees the state there (the `/gta` doctrine).
- **Deviations** from STANDARDS are recorded in `docs/decisions.md` with a reason. A silent deviation is a defect.

### Design flow
- **Contracts and characters:** the `/gta --quest` handshake only. The council produces paths, the PoF guards check them, and the owner fuses the result.
- **Pitch `[open]` items** are decided at the phase entry that needs them (§2), never by a builder.

---

## 4. Test strategy

| Layer | What | Tool | Where it runs | Evidence kind |
|---|---|---|---|---|
| Lint and format | gdlint, gdformat, file and function size limits | gdtoolkit | pre-commit plus CI | `lint` |
| Typed code | Warnings as errors | Godot import | CI | (part of `lint`) |
| Unit | Pure logic: data tables, the economy, the platform mirror, quest parsing | The shootout winner (gdUnit4 or GUT) | CI | `unit-tests` |
| Scenario | Headless playthrough scripts: the tutorial path, a contract fixture, heat escalation, a soul ability | Godot headless plus scripted input | CI | `scenario-tests` |
| Parity | The native sim against the GDScript reference, bit-identical; planted-mutation check | Godot headless | CI | `parity` |
| Golden frames | Fixed-seed frames for the look and HUD; a diff threshold | Headless render plus image diff | Nightly | `selftest` (with `artifacts`) |
| Bench | The crowded drive, the riot, swap frames, the hitch log | An exported release build | Nightly plus the slice gate | `bench` |
| Export audit | Only runtime files ship; split PCKs; no dev data | An export plus a manifest check | CI | `export-audit` |
| Achievements | Schema, all-ages lint, emitter wiring, icon spec | `tools/achievements/gen.mjs` | CI | `achievements` |
| Human | The owner plays the path | — | At each phase exit | Recorded in STATE.md |

PoF reads every evidence kind. A missing kind is `deferred` and a stale kind is `deferred (stale)`. **Neither ever counts as pass.**

---

## 5. Owner questions: when each gets asked

These are the questions from STANDARDS §23. Q1 (the title) is resolved by the RTAI rebrand.

| Question | Asked at |
|---|---|
| Legal entity and country | Slice exit (Steam app creation) |
| Languages at 1.0; voice-over | Phase 3 entry |
| AI-disclosure wording | Phase 5 (the provenance log is kept from F-01) |
| Germany and Australia content | Phase 4 entry |
| Joke-profanity defaults and VO variants | Phase 3 entry |
| Texel density | F-13 (evidence gate; the owner signs off on the numbers) |
| NG+ or mission select (missable achievements) | Phase 4 entry |
| Sentry and the privacy page | Before the first external playtest |
| Price and regional pricing | Phase 5 |
| Repo hosting and LFS budget | **Answered:** GitHub private with LFS |

---

## 6. PoF work inside Phase 2

| PoF capability | Ticket | Why the game needs it |
|---|---|---|
| Godot evidence adapter and harness gates | F-02 (spark `gtai-phase-2` WP2) | Night lanes are verifiable, and acceptance stops reading `deferred` for every Godot step |
| Build-health page | F-10 | The owner's morning review in one place |
| GTAI story map | F-11 | Contracts and arc beats visible and walkable |
| UE Packaging tails on GTAI pipelines | Backlog | They stay `deferred` with a reason. A Godot export-audit step replaces them per pipeline, as each pipeline is first used |

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| The D4 slice puts art on the critical path | High | The art lane starts in F-08 and F-09; there are crop gates at 32 and 48 px/m; the fallback is D3, decided at the first failed gate |
| No Deck until release; the proxy may mislead | Medium | Budgets carry headroom (40 fps target over a 30 fps limit); the proxy runs on every bench; buy earlier if a bench nears a limit |
| The 165-440 ms stall has no known cause | Medium | F-07 profiles it on an idle machine before the slice |
| Game-written evidence is self-reported | Medium | A commit-staleness rule; CI writes the evidence; the owner plays at every phase exit |
| gdUnit4 and GUT on 4.7.2 are unverified | Low | The F-01 shootout |
| `.po` code execution (Godot 4.1-4.7.2) | Medium | LOC-03: only our own linted PO ships; re-check at each Godot upgrade |
| Codex quota or tier changes | Medium | A layout-template technique that is portable to any image model; Leonardo is the fallback |
| Planner drift into breadth | Medium | This plan's slice-first gates; `/gta` refuses breadth tickets before the slice exits |
