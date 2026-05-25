# Context Scan Report

**Date**: 2026-05-24
**Project**: pof (Pillars of Fortune)
**Project ID**: 994c4d7f-5b3e-42be-b345-ef6421f4ee3e
**Project Path**: C:\Users\kazda\kiro\pof
**Type**: Next.js 16 (App Router) + React 19 + Zustand + better-sqlite3

## Execution Summary

| Metric | Value |
|--------|-------|
| Context Groups | 12 |
| Contexts | 30 |
| Group Relationships | 15 |
| Files referenced by contexts | 501 |
| Total source files (excl. tests) | 1283 |
| Approx. coverage | ~39% (representative vertical slices) |

Contexts are **business-domain vertical slices** (UI + API + lib + store + types per user
capability), not exhaustive file listings — each names the most representative ~10–23 files
for that capability. Coverage by design favours entry points over every leaf component.

## Groups & Contexts

### 1. ARPG Combat & Abilities  `group_1779613037834_8z9badi`
| Context | Files | ID |
|---------|-------|----|
| Combat Choreography & Action Maps | 16 | ctx_1779613086356_qpaucpb |
| GAS Abilities, Damage & Balance | 16 | ctx_1779613756280_5y9kotc |

### 2. ARPG Character & Progression  `group_1779613756302_cl40elo`
| Context | Files | ID |
|---------|-------|----|
| Character Blueprint & Feel Tuning | 13 | ctx_1779613756308_yusy3j6 |
| Genome Editing & Progression Curves | 19 | ctx_1779613756316_pp83mwx |

### 3. Loot, Items & Economy  `group_1779613756323_cd7bi2o`
| Context | Files | ID |
|---------|-------|----|
| Loot Tables & Item Catalog | 18 | ctx_1779613756329_resxava |
| Item Economy & Balance Simulation | 14 | ctx_1779613756336_74glz0q |

### 4. Enemies, AI & World Design  `group_1779613756343_l1man0z`
| Context | Files | ID |
|---------|-------|----|
| Enemy Bestiary & AI Behavior | 16 | ctx_1779613756349_wamhna1 |
| Quests & Zone Mapping | 11 | ctx_1779613756354_4m4zzvk |

### 5. Visual Generation — 2D & Materials  `group_1779613756361_yzbe888`
| Context | Files | ID |
|---------|-------|----|
| Leonardo & Scenario Texture Generation | 17 | ctx_1779613756367_pod913g |
| Material Lab & Post-Process Studio | 16 | ctx_1779613756373_hnfet7v |

### 6. Visual Generation — 3D & Blender Pipeline  `group_1779613756405_gfih1mx`
| Context | Files | ID |
|---------|-------|----|
| Blender MCP Integration | 18 | ctx_1779613756411_ylsw4x6 |
| Asset Forge, Rigging & Procedural Worlds | 17 | ctx_1779613756417_9dtr3d2 |

### 7. Content Authoring  `group_1779613756423_ea49e7k`
| Context | Files | ID |
|---------|-------|----|
| Animation State Graphs & Montages | 16 | ctx_1779613756429_005h5dv |
| Audio & Spatial Sound | 17 | ctx_1779613756434_g9nfhg5 |
| Level Design & Procedural Generation | 17 | ctx_1779613756441_ss06my2 |

### 8. Engine Bridge, Build & Gameplay Systems  `group_1779613756447_075mzan`
| Context | Files | ID |
|---------|-------|----|
| UE5 / PoF Bridge & Live Sync | 23 | ctx_1779613756452_ebiifv6 |
| Build & Packaging Pipeline | 19 | ctx_1779613756458_or2n3oz |
| Gameplay Systems (Physics, Net, Save, Input, Blueprint) | 12 | ctx_1779613756465_9vtbjie |

### 9. Quality, Evaluation & Diagnostics  `group_1779613756470_fp23s1h`
| Context | Files | ID |
|---------|-------|----|
| Code Evaluation & GDD Compliance | 21 | ctx_1779613756476_by2hlhv |
| Crash & Error Analysis | 11 | ctx_1779613756481_0kfqulk |
| Performance & Project Health | 15 | ctx_1779613756487_ajicj1r |

### 10. Planning, Feature Matrix & Game Director  `group_1779613756492_dtst70z`
| Context | Files | ID |
|---------|-------|----|
| Feature Matrix & Next-Best-Action | 18 | ctx_1779613756498_7temp2e |
| Implementation Planning & Roadmap | 18 | ctx_1779613756503_fyh2rln |
| Game Director, Sessions & Telemetry | 22 | ctx_1779613756510_duyz5n4 |

### 11. AI Assistant — CLI, Prompts & Adaptive UI  `group_1779613756515_wfqke89`
| Context | Files | ID |
|---------|-------|----|
| Claude CLI Terminal & Task System | 19 | ctx_1779613756519_zpxgml0 |
| Prompt Builder, Knowledge & Evolution | 20 | ctx_1779613756524_e7lqe5v |
| DZIN Adaptive UI Engine | 21 | ctx_1779613756531_m6c89es |

### 12. Platform — App Shell, Marketplace & Localization  `group_1779613756536_4bbkp8t`
| Context | Files | ID |
|---------|-------|----|
| Application Shell & Project Setup | 22 | ctx_1779613756540_exy3436 |
| Asset Marketplace & Pattern Catalog | 12 | ctx_1779613756546_im7h6mx |
| Localization Pipeline | 7 | ctx_1779613756553_yvrjjnw |

## Group Relationships (15)

| Source | → | Target | Type | Meaning |
|--------|---|--------|------|---------|
| Combat & Abilities | → | Character & Progression | depends_on | Combat consumes character attributes & feel |
| Combat & Abilities | → | Content Authoring | depends_on | Combat drives animation montages & combos |
| Combat & Abilities | → | Engine Bridge/Build | feeds | Exports GAS/combat C++ to the UE5 project |
| Loot, Items & Economy | → | Character & Progression | depends_on | Items modify character attributes & genome |
| Enemies, AI & World | → | Loot, Items & Economy | depends_on | Enemies reference loot drop tables |
| Enemies, AI & World | → | Combat & Abilities | depends_on | Enemy AI uses combat abilities & damage |
| Visual Gen 2D | → | Visual Gen 3D | feeds | Textures/materials applied to 3D meshes |
| Visual Gen 3D | → | Content Authoring | feeds | 3D assets populate levels & animation content |
| Content Authoring | → | Engine Bridge/Build | feeds | Authored content synced/imported into UE5 |
| Engine Bridge/Build | → | Quality & Diagnostics | feeds | Builds & live state feed crash/perf diagnostics |
| Quality & Diagnostics | → | Planning/Matrix/Director | feeds | Evaluation findings inform feature planning |
| Planning/Matrix/Director | → | AI Assistant (CLI) | depends_on | Planning dispatches CLI tasks for next actions |
| AI Assistant (CLI) | → | Engine Bridge/Build | feeds | CLI orchestrates builds & code generation |
| Platform Shell | → | AI Assistant (CLI) | contains | Shell hosts the CLI terminal & DZIN UI |
| Platform Shell | → | Planning/Matrix/Director | depends_on | Shell surfaces the feature matrix & NBA |

## Coverage Notes

Areas intentionally represented by their entry points rather than every file (the modules
contain hundreds of leaf chart/panel components):

- `core-engine/unique-tabs/**` — only each tab's `index.tsx` + key data/codegen files are
  referenced; the dozens of per-tab chart sub-components are implied by the slice.
- `lib/dzin/core/**` — represented by intent/layout/llm/chat hubs; type-only and demo files omitted.
- `src/components/ui/**`, `src/components/shared/**` — generic shared primitives, not domain slices.
- `src/__tests__/**` — excluded (tests, not capabilities).

## Verification

```bash
curl -s "http://localhost:3000/api/context-groups?projectId=994c4d7f-5b3e-42be-b345-ef6421f4ee3e"
curl -s "http://localhost:3000/api/contexts?projectId=994c4d7f-5b3e-42be-b345-ef6421f4ee3e"
curl -s "http://localhost:3000/api/context-group-relationships?projectId=994c4d7f-5b3e-42be-b345-ef6421f4ee3e"
```

All entities verified present: **12 groups, 30 contexts, 15 relationships**.
