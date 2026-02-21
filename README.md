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

**Module System** — 25+ domain modules (character, combat, loot, animation, materials, level design, AI, multiplayer, etc.) each with checklists, quick actions, and knowledge tips.

**Integrated CLI Terminal** — Spawns Claude Code directly from the UI. Domain-specific skill packs are injected into prompts based on context (souls-combat, loot-itemization, projectile-systems, etc.).

**Feature Matrix** — Per-feature implementation tracking with statuses (implemented / improved / partial / missing), quality scores 1-5, and historical review snapshots.

**Evaluator** — 3-pass deep evaluation (structure, quality, performance) with cross-module correlation, pattern extraction, and a finding collector that rolls up issues into actionable fix plans.

**Game Director** — Session-based analysis that reviews your project holistically, tracks findings over time, and detects regressions between sessions.

**Prompt Builder** — Composable 6-section prompt architecture (project context, domain context, task instructions, UE5 best practices, output schema, success criteria) ensures consistent, high-quality AI interactions.

**NBA Engine** — Next Best Action recommendations based on module progress and cross-module dependency resolution.

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
npm run validate     # typecheck + lint + test
```

## Project Structure

```
src/
├── app/                 # Next.js App Router + 40+ API routes
├── components/
│   ├── cli/             # Terminal UI, task queue, skills
│   ├── layout/          # App shell (TopBar, Sidebar, ModuleRenderer)
│   ├── modules/         # All feature modules by category
│   │   ├── content/     # animations, audio, materials, level-design, models, ui-hud
│   │   ├── core-engine/ # aRPG modules + unique visualization tabs
│   │   ├── evaluator/   # Quality dashboards, pattern library, GDD compliance
│   │   ├── game-director/ # Session tracking, regression detection
│   │   ├── game-systems/  # AI, physics, multiplayer, dialogue, packaging
│   │   └── shared/      # FeatureMatrix, QuickActions, RoadmapChecklist
│   └── ui/              # Reusable primitives
├── hooks/               # Custom React hooks
├── lib/                 # Core business logic, DB layers, prompt builders
├── services/            # Cross-store bridges
├── stores/              # Zustand stores
└── types/               # TypeScript definitions
```
