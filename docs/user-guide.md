# PoF User Guide — Using Pillars of Fortune with Unreal Engine 5

## Table of Contents

1. [Introduction](#1-introduction)
2. [Project Setup](#2-project-setup)
3. [Navigating the App](#3-navigating-the-app)
4. [Working with Checklists](#4-working-with-checklists)
5. [Using the CLI Terminal](#5-using-the-cli-terminal)
6. [Feature Matrix](#6-feature-matrix)
7. [UE5 Connection (Remote Control Bridge)](#7-ue5-connection-remote-control-bridge)
8. [PoF Bridge Plugin (Deep UE5 Integration)](#8-pof-bridge-plugin-deep-ue5-integration)
9. [Build Pipeline](#9-build-pipeline)
10. [Evaluator & Quality Scans](#10-evaluator--quality-scans)
11. [Game Director](#11-game-director)
12. [Typical Development Workflow](#12-typical-development-workflow)
13. [Tips & Troubleshooting](#13-tips--troubleshooting)

---

## 1. Introduction

Pillars of Fortune (PoF) is an AI-powered companion for building Unreal Engine 5 C++ games. It provides structured checklists with embedded prompts, an integrated Claude Code terminal, feature tracking, quality evaluation, and build management — all designed to keep a large-scale game project organized from first prototype to polish pass.

### Prerequisites

| Requirement | Purpose |
|---|---|
| **Node.js 20+** | Runs the PoF web app |
| **Unreal Engine 5.5+** | Your game project |
| **Visual Studio 2022** | C++ compilation (with "Game development with C++" workload) |
| **Claude Code CLI** | AI assistant that executes checklist prompts |

### Quick Start

```bash
git clone <repo-url> && cd pof
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs entirely locally — all data is stored in a SQLite database at `~/.pof/pof.db`.

---

## 2. Project Setup

When you first launch PoF, the **Setup Wizard** guides you through project configuration.

### Step 1: Select UE Version

Choose the Unreal Engine version installed on your machine:

| Version | Notes |
|---|---|
| **5.5** | Best AI coverage — most prompts and patterns tested here |
| **5.6** | Good coverage, web search used for newer API changes |
| **5.7** | Latest — some prompts may reference APIs that changed |

The version you select determines which prompts and best practices are injected into your CLI sessions.

### Step 2: Open or Create a Project

**Open Existing Project** — PoF scans your `Documents\Unreal Projects` folder and lists all `.uproject` files matching your selected UE version. Click any project to load it.

**Start Fresh** — Enter a project name. PoF generates the project path and can launch UE5 to create the project structure.

### Step 3: Project Scan

After selecting a project, PoF automatically scans the project directory and detects:

- **C++ classes** grouped by prefix (A = Actors, U = Objects, F = Structs, E = Enums)
- **Installed plugins** and their enabled/disabled status
- **Build dependencies** (public and private module references in `.Build.cs`)
- **Source file count** and directory structure

This scan result is cached for 5 minutes and injected into every CLI prompt so Claude Code always knows what already exists in your project.

### Step 4: Environment Verification

The **Status Checklist** on the Project Setup page verifies your development environment:

- UE5 Engine installation
- Visual Studio 2022 with C++ workload
- Windows SDK
- .NET 8.0 Runtime

If anything is missing, click **Fix All Missing** to generate bootstrap commands.

### Switching Projects

PoF remembers your recent projects. Use the project switcher to move between them. When you switch:

1. Current module progress is saved to the database
2. The target project's progress is restored
3. A fresh project scan runs automatically

---

## 3. Navigating the App

### Layout

```
┌─────────────────────────────────────────────────────┐
│  TopBar — Category tabs (Core Engine, Content, ...)  │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │                                          │
│          │  Module Content Area                     │
│ Module   │  (Checklist, Quick Actions, Feature      │
│ list     │   Matrix, module-specific views)         │
│ with     │                                          │
│ progress │                                          │
│ rings    │──────────────────────────────────────────│
│          │  CLI Terminal Panel (bottom)              │
└──────────┴──────────────────────────────────────────┘
```

### Categories

| Category | What it covers | Example modules |
|---|---|---|
| **Core Engine** | Genre-specific game systems | Character, Combat, Loot, Inventory, AI, Progression |
| **Content** | Art and asset pipelines | Animations, Audio, Materials, Level Design, Models, UI/HUD |
| **Game Systems** | Cross-genre technical systems | Physics, Multiplayer, Save/Load, Input, Dialogue, Packaging |
| **Evaluator** | Quality analysis tools | Deep Eval, Pattern Library, GDD Compliance, Health Dashboard |
| **Game Director** | Holistic project review | Session tracking, Findings explorer, Regression detection |
| **Project Setup** | Configuration and environment | Setup Wizard, Status Checklist, Build verification |

### Module Navigation

- Click a category tab in the TopBar to switch categories
- The sidebar shows all modules in that category with a **progress ring** (percentage of checklist items completed)
- Use **Arrow Up/Down** keys to cycle through modules
- The sidebar is resizable (drag the edge) — width is remembered per category

---

## 4. Working with Checklists

Each module has a **RoadmapChecklist** — an ordered list of implementation steps designed to build your game systems in the right order.

### Checklist Items

Every item includes:

- **Label** — What you're building (e.g., "Character foundation package")
- **Description** — What the step covers and why it matters
- **Prompt** — A detailed, multi-paragraph UE5 C++ prompt that Claude Code will execute when you click "Run"
- **Verification criteria** — How to know the step is complete

### Using a Checklist Item

1. **Read the description** to understand what will be built
2. **Check the NBA badge** — a score (0–100) showing how ready you are to tackle this item based on dependencies, past success rates, and evaluator recommendations
3. **Click "Run"** to send the embedded prompt to the CLI terminal
4. **Watch the terminal** as Claude Code reads your existing files, creates new C++ classes, and runs build commands
5. **Mark complete** when the build succeeds and you're satisfied

### NBA (Next Best Action) Recommendations

The NBA engine analyzes your entire project state and recommends what to work on next. Scores are based on:

| Factor | Weight | What it measures |
|---|---|---|
| Urgency | 30% | Are other features blocked waiting for this? |
| Success probability | 25% | Based on past task outcomes and pattern matches |
| Impact | 20% | How many downstream features does this unblock? |
| Evaluator priority | 15% | Did a quality scan flag this as important? |
| Readiness | 10% | Are all prerequisites met? |

Items with high NBA scores (green badge, 70+) are your best next steps. Low scores (red, <40) usually mean dependencies aren't met yet.

### Metadata

You can annotate each checklist item with:

- **Priority**: Critical / Important / Nice-to-have
- **Notes**: Free-text observations
- All metadata is persisted and searchable

---

## 5. Using the CLI Terminal

The CLI terminal is PoF's core interaction point — it's where AI-assisted code generation happens.

### How It Works

When you run a checklist item or quick action, PoF builds a **composite prompt** that includes:

1. **Project context** — Your project path, UE version, engine installation path
2. **Existing code** — Classes, plugins, and dependencies detected by the project scan
3. **Error history** — Past build errors that were fingerprinted, so Claude avoids repeating mistakes
4. **Domain context** — Module-specific best practices and UE5 API guidance
5. **Task instructions** — The actual checklist prompt (what to build)
6. **Success criteria** — How to verify the result

This prompt is sent to the Claude Code CLI, which streams its response in real-time.

### What You See

The terminal shows:

- **Thinking blocks** — Claude's reasoning process
- **Tool calls** — File reads, writes, and shell commands being executed
- **Build output** — Compilation results with structured error/warning cards
- **Completion status** — Success or failure with next steps

### Multi-Session Support

You can run multiple CLI sessions in parallel:

- Each module gets its own session tab
- Sessions persist across page navigation
- Click the tab bar at the bottom to switch between active sessions

### Quick Actions

Every module has a **Quick Actions** panel with pre-built operations:

- **Complexity levels**: Beginner / Intermediate / Advanced
- **Run** button sends the action prompt to the CLI
- **Copy** button copies the prompt to clipboard for manual use
- **Custom prompt** input lets you type freeform requests with module context auto-injected

---

## 6. Feature Matrix

The Feature Matrix tracks the implementation status of every feature across all modules.

### Feature Statuses

| Status | Meaning |
|---|---|
| **Implemented** | Feature is complete and working |
| **Improved** | Feature was enhanced beyond the baseline |
| **Partial** | Some functionality exists but incomplete |
| **Missing** | Not yet started |
| **Unknown** | Hasn't been reviewed yet |

### Working with Features

1. **Browse**: View features grouped by category or as a flat list
2. **Filter**: Search by name, filter by status, filter by quality score range
3. **Review**: Click a feature to expand details — edit status, add notes, set quality score (1–5)
4. **Batch review**: Select multiple features for bulk status updates
5. **Dependencies**: View which features depend on others via the cross-module dependency graph

### Dependency Graph

Features can depend on other features, even across modules. The format is `moduleId::featureName`. For example, the Combat module's "Damage System" might depend on `arpg-character::Health Component`.

The dependency graph shows:

- Which features are **blocked** (prerequisites not met)
- Which features are **blocking** others (high-impact items to complete first)
- Critical paths through the implementation

### Export

Feature data can be exported as CSV or JSON for reporting or team sharing.

---

## 7. UE5 Connection (Remote Control Bridge)

PoF can connect directly to a running UE5 Editor instance via the **Web Remote Control** plugin.

### Prerequisites

1. Open your project in UE5 Editor
2. Enable the **Web Remote Control** plugin:
   - Edit > Plugins > search "Web Remote Control" > Enable > Restart Editor
3. The plugin starts an HTTP server on port **30010** by default

### Connecting from PoF

1. PoF settings (accessible from the UI) let you configure:
   - **Host**: Default `127.0.0.1` (localhost)
   - **HTTP Port**: Default `30010`
   - **Auto-connect**: Toggle to automatically connect when PoF loads
2. Click **Connect** — PoF pings the Remote Control server and reports the UE5 version

### What You Can Do

| Capability | Description |
|---|---|
| **Read properties** | Query any UObject property in the Editor (e.g., actor transform, material parameter) |
| **Write properties** | Set property values remotely (e.g., change a light's intensity) |
| **Call functions** | Invoke any `UFUNCTION` on Editor objects |
| **Search assets** | Find assets in your Content/ directory by name or class |
| **Describe objects** | Get the full property/function list of any UObject |

### Connection Health

- PoF runs a health check every **30 seconds**
- If 3 consecutive checks fail, the connection drops and reconnect begins
- Reconnect uses exponential backoff: 2s → 4s → 8s → ... (max 30s)
- The connection status indicator shows: Connected (green) / Connecting (yellow) / Disconnected (gray) / Error (red)

### When to Use Remote Control

- **During development**: Query your Editor's live state to verify checklist items
- **Asset exploration**: Search Content/ for Blueprints, Materials, Animations
- **Live tweaking**: Adjust parameters in the running Editor from PoF
- **Game Director sessions**: The Game Director uses Remote Control to analyze your running game

---

## 8. PoF Bridge Plugin (Deep UE5 Integration)

While Section 7's Remote Control bridge queries **live runtime state** (actor properties, UObject functions), the **PoF Bridge plugin** provides **deep project introspection** — asset manifests, blueprint structure, automated tests, visual snapshots, and live coding. Both bridges coexist and complement each other.

| Capability | Remote Control (Section 7) | PoF Bridge Plugin (this section) |
|---|---|---|
| **Port** | 30010 | 30040 |
| **Scope** | Runtime actor/object queries | Project-wide asset introspection |
| **Asset manifest** | No | Full project manifest with content hashes |
| **Blueprint inspection** | Limited (UObject describe) | Full graph, nodes, variables, state machines |
| **Test runner** | No | Runs custom test specs + UE5 automation tests |
| **Snapshot capture** | No | Camera-preset screenshots with baseline diffing |
| **Live coding** | No | Trigger hot-reload compiles from PoF |
| **Auto-verification** | No | 40+ rules verify Feature Matrix against real project state |

### Prerequisites

| Requirement | Purpose |
|---|---|
| **Unreal Engine 5.4+** | Plugin uses 5.4+ HTTP server APIs |
| **PoF web app running** | `npm run dev` on localhost:3000 |
| **PillarsOfFortuneBridge plugin** | C++ Editor plugin installed in your UE5 project |

### Installing the Plugin

1. **Copy the plugin folder** into your UE5 project:
   ```
   YourProject/
     Plugins/
       PillarsOfFortuneBridge/
         PillarsOfFortuneBridge.uplugin
         Source/
           PillarsOfFortuneBridge/
             Public/
             Private/
   ```

2. **Regenerate project files** — right-click your `.uproject` file > "Generate Visual Studio project files"

3. **Open the project** in Unreal Editor. The plugin loads automatically (it's an Editor-only plugin).

4. **Verify** — go to Edit > Plugins, search "Pillars of Fortune Bridge". It should show as Enabled.

### Plugin Configuration

Open **Project Settings > Plugins > Pillars of Fortune Bridge**:

| Setting | Default | Description |
|---|---|---|
| **ServerPort** | `30040` | HTTP port the plugin listens on |
| **AuthToken** | *(empty)* | Optional shared secret — must match PoF's setting |
| **AllowedOrigins** | `http://localhost:3000` | CORS origins for the web app |
| **bAutoRegenerateManifest** | `true` | Rebuild manifest when assets change in the Editor |
| **ManifestRegenerationInterval** | `30.0` | Seconds between auto-regeneration checks |

### Connecting from PoF

1. **Open your UE5 project** in the Editor (the plugin starts its HTTP server automatically)
2. **Launch PoF** (`npm run dev`, open localhost:3000)
3. The **TopBar** shows a green "Bridge" indicator when connected:
   - **Green pill** (e.g., "Bridge v1.0.0") — connected, plugin healthy
   - **Amber with spinner** — connecting or reconnecting
   - **Red** — connection error (hover for details)
   - **Hidden** — no connection attempt (auto-detect off, no manual connect)

4. If the indicator doesn't appear, go to PoF settings and verify:
   - **Port** matches the plugin's `ServerPort` (default: 30040)
   - **Auth token** matches (both blank, or both the same string)
   - **Auto-detect** is enabled, or manually click Connect

### Connection Health

- PoF pings the plugin every **10 seconds** via `GET /pof/status`
- If **3 consecutive** health checks fail, the connection drops
- Automatic reconnection starts with **exponential backoff**: 2s, 4s, 8s, ... (max 30s)
- When the Editor is closed and re-opened, PoF reconnects automatically

### What You Get When Connected

| Feature | Where in PoF | What changes |
|---|---|---|
| **Asset Manifest** | Content > Models > Asset Inventory | Real asset counts from UE5 replace estimates — shows blueprints, materials, animations, data tables |
| **Animation State Machines** | Content > Animations > State Machine tab | Live state machine graph sourced from AnimBlueprint data (green "BRIDGE" badge) |
| **Material Parameters** | Content > Materials > Parameter Configurator | "Live from Bridge" section shows actual shader parameters from your project |
| **Dependency Cross-References** | Evaluator > Dependency Graph | Manifest cross-references overlay per-module reference counts |
| **Auto-Verify Feature Matrix** | Feature Matrix > Auto-Verify button | 40+ verification rules check Feature Matrix entries against real project state |
| **Test Runner** | CLI Terminal / API | Submit test specs or run UE5 automation tests from PoF |
| **Snapshot Capture** | CLI Terminal / API | Capture camera-preset screenshots, compare against baselines |
| **Live Coding** | CLI Terminal / API | Trigger hot-reload compiles in the Editor without leaving PoF |

### Important: Read-Only Bridge

The PoF Bridge plugin **reads** your UE5 project state (assets, blueprints, material parameters) — it does **not** create or modify assets in UE5. It is a one-way data pipeline from UE5 into PoF.

**Can I compose levels from code?** The Level Design module in PoF generates **planning artifacts and Claude prompts** (room layouts, difficulty arcs, streaming zones). These produce C++ snippets, Blueprint node descriptions, and Data Table schemas that you then implement manually in UE5. The bridge plugin enriches this workflow by providing real asset counts and dependency data, but it does not generate or place actors in a level automatically.

### Testing the Integration

After installing the plugin and connecting, verify the integration with these 10 steps:

**Step 1 — Plugin responds**
```bash
curl http://localhost:30040/pof/status
```
You should see JSON with `pluginVersion`, `engineVersion`, `projectName`, and `editorState`.

**Step 2 — TopBar indicator is green**
Open PoF in your browser. The TopBar should show a green "Bridge vX.Y.Z" pill on the right side.

**Step 3 — Asset Inventory shows bridge data**
Navigate to Content > Models. The Asset Inventory should display a "Bridge Manifest" card with real counts (Blueprints, Materials, Animations, Data Tables, Other).

**Step 4 — Animation State Machine loads bridge states**
Navigate to Content > Animations > State Machine tab. If your project has AnimBlueprints with state machines, you should see states loaded with a green "BRIDGE" badge and "LIVE FROM BRIDGE" subtitle.

**Step 5 — Material Parameters show live data**
Navigate to Content > Materials > Parameter Configurator. If your project has materials, you should see a "Live from Bridge" section listing actual shader parameters.

**Step 6 — Dependency Graph shows cross-refs**
Navigate to Evaluator > Dependency Graph. The legend should show a bridge badge, and module nodes should display manifest cross-reference counts.

**Step 7 — Manifest endpoint returns assets**
```bash
curl http://localhost:30040/pof/manifest
```
The response should contain arrays of blueprints, materials, animations, and data tables from your project.

**Step 8 — Checksum-only endpoint works**
```bash
curl "http://localhost:30040/pof/manifest?checksum-only=true"
```
Should return a response with `checksumSha256` but minimal asset data.

**Step 9 — Live Coding compile triggers**
```bash
curl -X POST http://localhost:30040/pof/compile/live -H "Content-Type: application/json" -d "{}"
```
Should trigger a hot-reload compile in the Editor. Check the Editor's output log for compilation activity.

**Step 10 — Graceful degradation**
Close the UE5 Editor. PoF should:
- Show the TopBar indicator turn amber (reconnecting), then disappear
- Continue working normally — all modules remain functional without bridge data
- No error popups or console errors

Re-open the Editor — PoF reconnects automatically and the green indicator returns.

### Troubleshooting

| Problem | Solution |
|---|---|
| No "Bridge" indicator in TopBar | Verify the plugin is enabled in UE5 (Edit > Plugins), check that the Editor is running, and that PoF auto-detect is on |
| "Bridge err" (red indicator) | Hover for details. Usually a port mismatch or auth token mismatch between PoF settings and plugin settings |
| Manifest shows zero assets | The plugin may still be generating the initial manifest. Wait 30s and refresh. Check `bAutoRegenerateManifest` is enabled |
| CORS errors in browser console | Add `http://localhost:3000` to the plugin's `AllowedOrigins` setting in Project Settings |
| Port 30040 already in use | Another process is using the port. Change the plugin's `ServerPort` and update PoF settings to match |
| Auth failure (401 responses) | Ensure the auth token in PoF settings exactly matches the plugin's `AuthToken` (both empty = no auth) |
| State machines empty despite AnimBPs | The manifest only includes AnimBlueprints that have at least one state machine. Verify your AnimBP has states defined |

---

## 9. Build Pipeline

PoF can trigger UE5 C++ builds without needing the Editor open.

### How It Works

The build pipeline invokes **UnrealBuildTool** (UBT) as a headless process:

1. PoF constructs the UBT command using your project path and UE installation
2. The build runs as a child process, capturing stdout and stderr
3. Output is parsed in real-time, extracting `[N/M]` progress markers
4. When complete, errors and warnings are parsed into structured diagnostics

### Starting a Build

Builds are typically triggered by:

- A checklist prompt that includes a "verify build" step
- Manually via the build API
- After code generation to confirm the new code compiles

### Build Queue

Only one build runs at a time. Additional requests are queued and processed in order. You can:

- **Monitor progress** — see the current compilation step and percentage
- **Abort** — cancel a running or queued build

### Error Cards

Build output is parsed into structured cards showing:

- **Severity**: Error or Warning
- **Category**: Compile, Linker, UBT, or General
- **File and line**: Direct reference to the source of the issue
- **Quick fix prompt**: One-click to send a targeted fix prompt to the CLI

### Error Memory

Every build error is **fingerprinted** and stored in the error memory database. This means:

- If the same error occurs again, PoF recognizes it
- Future CLI prompts include the error context so Claude avoids the same mistakes
- You can track which errors are recurring vs. one-time issues

### Build History

Build results are persisted per project. You can review past builds to see:

- When each build ran and how long it took
- Error and warning counts over time
- Which builds were triggered by which module

---

## 10. Evaluator & Quality Scans

The Evaluator performs automated quality analysis across your entire project.

### 3-Pass Evaluation

Each module is evaluated in three passes:

| Pass | Focus | What it checks |
|---|---|---|
| **Structure** | Architecture | File organization, class hierarchy, module separation, dependency direction |
| **Quality** | Best practices | Error handling, memory management, UE5 API usage patterns, SOLID principles |
| **Performance** | Optimization | Tick function overhead, garbage collection pressure, asset streaming, draw calls |

### Key Evaluator Views

**Project Health Dashboard** — Aggregate scores across all modules with red/yellow/green indicators and top findings.

**Deep Eval Results** — Per-module breakdown with specific recommendations, severity levels, and suggested fix prompts.

**Dependency Graph** — Visual map of feature dependencies showing blockers, critical paths, and implementation order.

**Cross-Module Correlation** — Identifies systemic patterns that span multiple modules (e.g., "error handling is weak across all combat-related modules").

**Pattern Library** — Successful implementation patterns extracted from past CLI sessions. When you complete a checklist item, the implementation approach is captured and can be reused for similar tasks.

**GDD Compliance** — Checks your implementation against your Game Design Document to ensure features match the design spec.

### Running a Scan

1. Navigate to the **Evaluator** category
2. Select the evaluation type (Deep Eval, Health, Compliance, etc.)
3. Click **Run Scan** — the evaluator analyzes your project
4. Results appear with actionable recommendations
5. Click any recommendation to send a fix prompt to the CLI terminal

---

## 11. Game Director

The Game Director provides session-based holistic project analysis — think of it as an automated QA reviewer.

### Creating a Session

1. Navigate to **Game Director** > **New Session**
2. Configure what to analyze:
   - Which gameplay systems to review (combat, economy, progression, etc.)
   - Focus areas and priorities
3. Launch the session

### What Happens During a Session

The Game Director:

1. Reviews your project's current state across all modules
2. Cross-references feature matrix data with checklist progress
3. Identifies gaps, imbalances, and potential issues
4. Generates structured **findings** with severity levels

### Findings Explorer

Browse findings by:

- **Severity**: Critical / Warning / Info
- **Category**: Balance, Bug, UX, Performance, Architecture
- **Module**: Which part of the game is affected

Each finding includes:

- Description of the issue
- Evidence and context
- Recommended fix with a one-click prompt to the CLI

### Regression Tracking

The Game Director compares findings between sessions:

- **New issues** — Problems that appeared since the last session
- **Fixed issues** — Problems that were resolved
- **Recurring issues** — Problems that keep coming back

This gives you a clear picture of whether your project is improving or regressing over time.

---

## 12. Typical Development Workflow

Here's a step-by-step walkthrough of a typical development session:

```
┌─────────────────────────────────────────┐
│  1. Launch PoF, open your UE5 project   │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  2. Check NBA: which module to work on? │
│     (highest-scoring checklist item)    │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  3. Open the module, review checklist   │
│     Read the item description           │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  4. Click "Run" — CLI generates code    │
│     Creates C++ files, runs build       │
└──────────────┬──────────────────────────┘
               ▼
       ┌───────┴───────┐
       ▼               ▼
  Build passes     Build fails
       │               │
       ▼               ▼
  Mark item        Error cards shown
  complete         Click "Fix" → new
       │           CLI session
       │               │
       │               ▼
       │           Fix applied,
       │           rebuild
       │               │
       ▼               ▼
┌─────────────────────────────────────────┐
│  5. Move to next checklist item         │
│     NBA updates recommendations         │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  6. Periodically: run Evaluator scan    │
│     Review quality across modules       │
│     Fix flagged issues                  │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  7. Run Game Director session           │
│     Compare with previous sessions      │
│     Address regressions                 │
└─────────────────────────────────────────┘
```

### The Feedback Loop

The core development loop is:

**Code** (via CLI) → **Build** (headless or Editor) → **Evaluate** (quality scan) → **Fix** (targeted prompts) → **Repeat**

Each iteration makes PoF smarter:

- Error memory prevents repeating mistakes
- Pattern library captures successful approaches
- NBA scoring gets more accurate with each completed item
- Evaluator recommendations get more targeted as more modules mature

---

## 13. Tips & Troubleshooting

### Database Location

All persistent data is stored in SQLite at:

```
~/.pof/pof.db     (Windows: C:\Users\<you>\.pof\pof.db)
```

### Resetting Project State

To start fresh with a project:

1. Switch to a different project or reset via Project Setup
2. The database retains historical data — only the active project context changes

### UE5 Remote Control Not Connecting

1. Verify the **Web Remote Control** plugin is enabled in UE5 Editor
2. Check the port — default is `30010`, but you can change it in UE5's Project Settings > Plugins > Web Remote Control
3. Ensure nothing else is using port 30010 (run `netstat -ano | findstr 30010`)
4. PoF defaults to `127.0.0.1` — if UE5 is on another machine, update the host

### Build Errors

When a build fails:

- **Error cards** in the terminal show structured diagnostics
- Each card has a **Quick Fix** button that generates a targeted fix prompt
- Errors are automatically fingerprinted and added to error memory
- Future prompts will reference these errors to prevent recurrence

### Common Issues

| Problem | Solution |
|---|---|
| Project scan finds no classes | Ensure your project has a `Source/` directory with `.cpp`/`.h` files |
| CLI terminal not responding | Check that Claude Code CLI is installed (`claude --version`) |
| Build fails with "engine not found" | Verify UE version in Project Setup matches your installed engine |
| Feature Matrix shows all "unknown" | Run a Feature Matrix review via the batch review panel |
| Evaluator scan is empty | Ensure at least one module has some checklist items completed |
| PoF Bridge not connecting | Verify plugin is enabled, Editor is running, port 30040 is open, auth tokens match (see Section 8) |
| Bridge connected but no manifest data | Wait 30s for initial manifest generation, check `bAutoRegenerateManifest` in plugin settings |

### Keyboard Shortcuts

| Key | Action |
|---|---|
| Arrow Up/Down | Navigate modules in the sidebar |
| Enter | Open selected module |
| Escape | Close expanded panels |

### Data Flow Summary

```
Project Setup (projectStore)
    ↓ project path, UE version
Module Navigation (navigationStore)
    ↓ active module
Checklist Progress (moduleStore)
    ↓ completion state
CLI Terminal (cliPanelStore)
    ↓ prompts with injected context
Build Pipeline (build-queue)
    ↓ compilation results
Error Memory (error-memory-db)
    ↓ fingerprinted errors
Feature Matrix (feature-matrix-db)
    ↓ implementation status
PoF Bridge (pofBridgeStore)
    ↓ asset manifest, test results, snapshots
Evaluator (evaluator stores)
    ↓ quality recommendations
NBA Engine (nba-engine)
    ↓ prioritized next steps
Game Director (game-director-db)
    ↓ holistic findings
```

Each layer feeds into the next, creating a progressively smarter development assistant that learns from your project's history.
