# PoF Backlog · Idea Verdicts vs Entity-Centric Workspace Refactor

Generated 2026-05-24 from 6 parallel categorization agents over 331 idea files in `.claude/commands/`.

## Counts

| Verdict | Approx count | Action |
|---|---|---|
| **KEEP-CORE** | ~80 | Folded into a refactor phase. Files retained. |
| **KEEP-ENHANCE** | ~67 | Folded into a per-catalog enhancement phase after the foundation lands. Files retained. |
| **KEEP-INFRA** | ~37 | Folded into the cross-cutting design-system / a11y / observability phase. Files retained. |
| **DROP-OOS** | ~128 | Out of refactor scope (Blender pipeline, marketplaces, federated AI, audio middleware, asset library, localization, niche moonshots). Files deleted. |
| **DROP-STUB** | ~18 | Touches a module slated for removal/rebuild (DebugDashboard, PP Studio, Evaluator god-tab, BP Transpiler textarea, etc.). Files deleted. |
| **Total** | 331 | ~184 keepers, ~147 drops, ~56% retain rate. |

## KEEP-CORE → which refactor phase

(consolidated from the 6 agent outputs)

| Phase | KEEP-CORE ideas (sample) |
|---|---|
| Mission Control (L1 tab) | 043728da (cook log), 08d07649 (regression diff), 0a08d250 (gated pipeline), 0a9fe477 (cost dashboard), 13107c70 (holistic health), 15defbed (crash matching), 1e301d12 (UE-readiness gate), 21cea6d3 (cook forecaster), 26a2c5f7 (health timeline), 2c4da945 (dep DAG), 2c5de488 (predictive MC), 2cba6df6 (bulk plan→DAG), 34b53407 (UE time-travel → Live State), 3f4977fb (live-shareable MC), 4e8d7fda (anticipatory copilot), 6237f43c (ask-your-game), 675dc44d (universal intent shell), 7b6ccedf (cinematic MC), 75fe1f1a (critical-finding alerts), 7df95d2a (director mode NL), 8603d0d6 (fragility radar), 8a45533b (velocity forecast), 925151c6 (playable-by forecast), 96f25afc (project NBA queue), 9e354881 (build diff), ae20a945 (success oracle), b2668699 (home dashboard), b7927f28 (critical path), c7cff73a (value-vs-effort), ce5b130d (NL roadmap oracle), d67fa562 (ship-date sim), e1d1b89b (milestone bundles), ef237c77 (multi-agent DAG), f0f6e2e3 (self-healing FM), ff53b742 (autopilot), 6d9c9b9a (auto-adopt winning prompt) |
| Live State (L1 tab) | 53d018a8 (live UObject), a23c6e6d (crash ingestion), a615e7f7 (PIE bridge), a65d0226 (project digital twin), 9e354881 (session diff), 4328916d (3D zone twin), fff73bb0 (crash watchtower), d876056b (bridge health) |
| Catalog Hub + Entity Inspector | 23d79c4d (auto dep graph), e9255c2c (versioned design library), ad320c67 (C++↔genome round-trip), f0797199 (bidirectional GDD), d5e081f5 (UE import → inspector), a920346d (constraint validator), ace62976 (sentence→UE asset) |
| CLI integration / two-way binding | 04a08364 (visual prompt builder), 0ee551b8 (prompt history+diff), 135ee09d (one-click fix), 4974ec2c (run history+replay), 5144e216 (live progress), 6d9c9b9a (auto-adopt), 7bc512b9 (one-click fixes), 8db7a7ed (agent flight recorder), a465ebf2 (learning task engine), a89549dc (per-task diff), af5fbfe9 (closed-loop world→UE), dafd6380 (NL prompt composer), e0ed7c04 (NL intent→prompt), f340c77b (one-click fix), fe9b39ab (crash-fix CLI wire), 9eebaf16 (hot-patch history) |
| Command Palette / search | 18ad7099 (Ctrl+K actionable), 41c61ebf (Ask-PoF NL), 675dc44d (universal intent shell), a79bc1c5 (NL asset finder), c09e7172 (palette upgrade), c59b4ae9 (Cmd-K instant) |
| Evaluator consolidation | ab134014 (group 26 tabs into 5) |
| Onboarding | bb068439 (first-run guided tour) |

## KEEP-ENHANCE → which catalog gets it post-foundation

| Catalog | Enhancement ideas (sample) |
|---|---|
| spellbook | 058687cb (C++↔BP roundtrip), 158f9e5e (auto-balance pipe), 21f15b68 (sentence→ability), 99292419 (effect param decoder) |
| items | 05f25f33 (XP curve morph), 327e3733 (closed-loop balance), 3f7e7c81 (curve library), 5eee9409 (sensitivity sweep), 84abc79e (faucet/sink tables) |
| loot-tables | 0b7d17a0 (self-driving economy), 1aa2d0a2 (loot economy balancer), 1ae5a8f8 (economy multiverse), 1d82300f (goal-seek balancer), 448c5209 (plain-English economy), 56f5c3dc (loot linter), 5b1db241 (filter rule builder), 884b95bd (live economy twin), cc0b91ba (AI loot designer), f88f6bbf (conv loot designer), eed3b9d2 (auto-balancer), ff6ff0d2 (concept→combat-loot) |
| bestiary | 1e6353c7 (perception tuner), 375a9f88 (balance baselines), 3bf34f3d (sensitivity), 3e817d61 (LLM combat director), 40a97970 (archetype guardrails), 42f7d140 (frame data timeline), 7d150641 (describe-a-boss), 7f745e3c (describe-your-hero), acca239f (NL enemy AI), ce107528 (custom archetype lib) |
| combat-map | 01131c98 (dramatic tension), 0545ec6c (combat auto-tuner), 1d6c71ad (encounter sim), 1d108361 (A/B scenarios), 3d267f25 (difficulty topology), 43c47c8b (self-balancing encounters), 5f579b32 (NL encounter design), 61e19e05 (combo library), 6bf2f7a3 (bot playtesting), 7b5e0a4a (pacing curve), b59a3d1d (touch/kbd timelines), c3d28b98 (LLM combo chor), d098f8dc (difficulty budget), e1a395e5 (live PIE feel sync) |
| screen-flow | c9dd5463 (branching dialogue), 79afa857 (game master quests) |
| zone-map | 0b977d4d (procgen preview), 2a2e30d7 (radiant quests), 2cca4005 (quest overlay), 3d267f25 (difficulty topology), 671327ea (text-to-world), 6ceabe12 (quest DAG), 8fe58af0 (procgen preview), 9a559a37 (3D walkthrough), c2d7c71c (NL world), def6a488 (NL level dir), ee2fd596 (seed gallery) |
| state-graph | 141c2420 (AI node completion), 1d108361 (A/B state graph), 381106a5 (combo state machine), 4a0cf97d (hydrate from BP scan), 6ef3584f (programmatic AnimBP), 9c3f9b79 (graph kbd), dbe71c3d (BP graph viewer) |

## KEEP-INFRA → design-system / a11y / observability phase

0e92c0c3 (SVG a11y), 143ff660 (glossary), 15133ebe (graph kbd), 15c6b41d (unified planning headers), 19e9e14d (stat-card unify), 1a0c060d (type+status tokens), 22128354 (range slider primitive), 2cbadfe1 (knowledge inbox), 3b8efd65 (retry/DLQ for CLI), 3e4198df (NotifyTrack primitive), 44258ac1 (kbd+SR a11y), 5258d1c7 (Shiki highlight), 53283c35 (BP design-system extract), 53af0c30 (glossary tooltips), 57d2e3ce (adapter code highlight), 5dacc4ff (legibility floor), 6c133627 (unified chart a11y), 7ee002af (type-scale floor), 874fca7f (typo+contrast tokens), 8c... (assorted token cleanup), accb9971 (tooltip primitive), ae37291c (card+color unify), a2af29d5 (persist chat/layout), b09719f3 (harmonize evolution UI), b9507567 (autosave→radio), bd48e23d (panel transitions), bd6e00e8 (cook toggle a11y), c9ca41c5 (pipeline stepper), ce85ff81 (bridge status strip), d3b45c2e (TopBar de-jargon), da8d4fef (asset picker), dbe94b74 (focus ring/ARIA), df8cc965 (disclosure kbd/ARIA), e4e85439 (image ID picker), fa9c6bcf (combat slider a11y)

## DROP-OOS — to be deleted from `.claude/commands/`

Categories: Blender pipeline, audio middleware, asset/material libraries, marketplace/community, federated AI, localization tooling, telemetry moonshots, niche material/texture polish, BP transpiler details, narrow art-direction features.

## DROP-STUB — to be deleted from `.claude/commands/` (module being removed/rebuilt)

DebugDashboard sub-nav, PP Studio sliders, Evaluator 26-tab regroup variants, BP transpiler textarea, genome/progression unify, game-systems consolidation, audio module regroup, level-design tab regroup, sprint builder, feel studio, Gantt/planning module.
