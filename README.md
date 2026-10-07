# Pillars of Fortune (PoF)

An AI-powered companion for building Unreal Engine 5 C++ games. PoF provides structured checklists, intelligent prompts, feature tracking, and quality evaluation — all designed to keep a large-scale game project on track from first prototype to polish pass.

## Philosophy

Game development in UE5 C++ is a multi-year, multi-system endeavor. PoF exists to reduce the cognitive overhead by:

- **Breaking the work down** — every module (combat, animation, loot, UI, audio, etc.) has a curated checklist of implementation steps with embedded UE5 best-practice prompts.
- **Tracking what's done** — a Feature Matrix records implementation status and quality scores across all modules, so you always know where you stand.
- **Connecting the dots** — a dependency graph between features surfaces the Next Best Action and prevents building on missing foundations.
- **Learning from mistakes** — build errors are fingerprinted and stored so the same mistake isn't repeated twice.
- **Evolving prompts** — an A/B testing engine measures prompt effectiveness and promotes winners automatically.

## Key Features

**Module System** — 37 domain modules across 7 categories (character, combat, loot, animation, materials, level design, AI, multiplayer, asset generation, etc.) each with checklists, quick actions, and knowledge tips. Over 170 checklist items and 100+ quick actions total.

**Integrated CLI Terminal** — Spawns Claude Code directly from the UI. Domain-specific skill packs are injected into prompts based on context (souls-combat, loot-itemization, projectile-systems, etc.). A callback system (`@@CALLBACK:<id>` markers) lets Claude submit structured results back to the app automatically.

**Feature Matrix** — Per-feature implementation tracking with statuses (implemented / improved / partial / missing), quality scores 1-5, and historical review snapshots. Tracks 300+ unique features with cross-module dependency resolution.

**Evaluator** — 4-pass deep evaluation (ground-truth, structure, quality, performance; plus a 5th combat-trace pass for arpg-combat) with cross-module correlation, pattern extraction, and a finding collector that rolls up issues into actionable fix plans.

**Game Director** — Session-based analysis that reviews your project holistically, tracks findings over time, and detects regressions between sessions.

**Prompt Builder** — Composable 6-section prompt architecture (project context, domain context, task instructions, UE5 best practices, output schema, success criteria) ensures consistent, high-quality AI interactions.

**NBA Engine** — Next Best Action recommendations scored 0-100 across five dimensions: urgency (dependency blockers), success probability (pattern track record), impact (features unblocked), recency (evaluator recommendations), and readiness (dependencies met).

**PoF Bridge** — Live connection to the UE5 companion plugin for real-time manifest data, test execution, snapshot management, live coding, and compilation feedback.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16, React 19 |
| State | Zustand 5 (with persist) |
| Database | better-sqlite3 (WAL mode, stored at `~/.pof/pof.db`) |
| Styling | Tailwind CSS 4, Framer Motion |
| Testing | Vitest |
| Validation | Zod 4 |
| Code Highlighting | Shiki |
| Icons | Lucide React |
| Virtualization | react-window |
| Notifications | Sonner |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs entirely locally — all data is stored in a SQLite database in your home directory.

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run test         # Run tests
npm run test:watch   # Vitest in watch mode
npm run validate     # typecheck + lint + test (full CI check)
```

## Project Structure

```
src/
├── app/                 # Next.js App Router + 140+ API routes
├── components/
│   ├── cli/             # Terminal UI, task queue, skills, UE5 build parser
│   ├── layout/          # App shell (TopBar, Sidebar, ModuleRenderer, CLI panel)
│   ├── modules/         # All feature modules by category
│   │   ├── content/     # animations, audio, materials, level-design, models, ui-hud
│   │   ├── core-engine/ # aRPG modules + unique visualization tabs
│   │   ├── evaluator/   # Quality dashboards, pattern library, GDD compliance
│   │   ├── game-director/ # Session tracking, regression detection
│   │   ├── game-systems/  # AI, physics, multiplayer, dialogue, packaging
│   │   ├── project-setup/ # Project wizard, path browser, build verification
│   │   ├── visual-gen/    # Asset Studio: forge, material lab, Blender pipeline, scene composer
│   │   └── shared/      # FeatureMatrix, QuickActions, RoadmapChecklist
│   └── ui/              # Reusable primitives (Badge, Card, ProgressRing, etc.)
├── hooks/               # 30+ custom React hooks
├── lib/                 # Core business logic, DB layers, prompt builders
│   ├── claude-terminal/ # CLI service, session manager, stream-json parser
│   ├── evaluator/       # Deep eval engine, finding collector, correlation
│   ├── pof-bridge/      # UE5 plugin bridge client, connection manager
│   ├── prompts/         # Per-module prompt builders (animation, material, etc.)
│   └── *.ts             # NBA engine, event bus, lifecycle, feature defs, etc.
├── services/            # Cross-store bridges
├── stores/              # 20 Zustand stores
└── types/               # TypeScript definitions
```

---

## Documentation

This README covers what PoF is and how to run it. The module catalog, subsystem
internals, database/store schemas, and the full API surface live in
[`docs/`](docs/README.md) — start at
[docs/architecture/overview.md](docs/architecture/overview.md), which links
everything else.

| Destination | What's there |
|---|---|
| [docs/architecture/overview.md](docs/architecture/overview.md) | System map: the app↔SQLite↔UE contract, subsystem index, a catalog row's lifecycle |
| [docs/architecture/module-system.md](docs/architecture/module-system.md) | The full module registry (checklists, quick actions, visualization tabs) across Core Engine, Content, Game Systems, Evaluator, Game Director, and Project Setup; the feature dependency graph + NBA engine scoring |
| [docs/architecture/prompts-and-cli.md](docs/architecture/prompts-and-cli.md) | The 6-section prompt builder, the `CLITask`/`TaskFactory` abstraction, the `@@CALLBACK` result-capture flow, skill packs |
| [docs/architecture/state-and-persistence.md](docs/architecture/state-and-persistence.md) | The Zustand store layer, the SQLite `*-db.ts` tables, the `{success,data}` API envelope used across all routes |
| [docs/architecture/runtime-patterns.md](docs/architecture/runtime-patterns.md) | The typed event bus, the `Lifecycle` protocol, the suspend/LRU cache pattern |
| [docs/ue5-companion-plugin-design.md](docs/ue5-companion-plugin-design.md) | The PoF Bridge editor plugin: live manifest sync, test runner, snapshots, live coding |
| [docs/features/README.md](docs/features/README.md) | The full catalog pipeline map — every tracked feature domain, one folder each |

