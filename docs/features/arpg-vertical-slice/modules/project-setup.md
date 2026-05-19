# `project-setup` — vertical-slice readiness

## 1. One-line purpose

Project Setup enables PoF to detect and manage UE5 projects, verify build status, and provide project context to downstream modules.

## 2. Files of record

- **UI:** 
  - `src/components/modules/project-setup/ProjectSetupModule.tsx:1-165` — Main layout with project scanning, status checklist, and conditional panels
  - `src/components/modules/project-setup/SetupWizard.tsx:1-286` — Project discovery and creation UI
  - `src/components/modules/project-setup/StatusChecklist.tsx:1-250` — Left-rail checklist of environment/project status
  - `src/components/modules/project-setup/CreateProjectPanel.tsx:1-80` — Prompt builder for C++ project scaffolding
  - `src/components/modules/project-setup/BuildVerifyPanel.tsx:1-150` — Prompt builder for build & verification
  - `src/components/modules/project-setup/ToolingBootstrapPanel.tsx:1-44` — Dev environment bootstrap
  - `src/components/modules/project-setup/useProjectScan.ts:1-214` — Hook managing project detection state machine

- **API routes:**
  - `src/app/api/filesystem/browse/route.ts` — Detect projects, engines, tooling, directory structure
  - `src/app/api/filesystem/scan-project/route.ts` — Scan UE5 project for classes, plugins, dependencies

- **Module registry entry:** 
  - `src/lib/feature-definitions.ts:354-362` — Category definition for "Project Setup" (Rocket icon, accent green)
  - Module marked as having no sub-modules per CATEGORIES array (id: 'project-setup')

- **Store slice:** 
  - `src/stores/projectStore.ts:1-100` — Manages project path, name, UE version, completion state, and module progress save/restore

- **Feature definitions:** 
  - Project Setup has no formal sub-module checklist items in `ARPG_CHECKLISTS` (unlike arpg-character, arpg-gas, etc.)
  - No feature definitions in `MODULE_FEATURE_DEFINITIONS` for project-setup

- **Evaluator prompts:** 
  - _(none)_ — No module-specific eval context in `src/lib/evaluator/module-eval-prompts.ts`

## 3. Vertical-slice relevance

Required UE5 artifact: **UE5 project at `C:\Users\kazda\Documents\Unreal Projects\PoF` is detected by PoF, build is verified green, project context loaded into the app**

Acceptance bullets for this module specifically:
- [ ] SetupWizard detects UE5 projects in the system and filters by engine version (5.5/5.6/5.7)
- [ ] PoF detects the PoF project at `C:\Users\kazda\Documents\Unreal Projects\PoF` via project scan
- [ ] BuildVerifyPanel runs build verification and reports green status (no blockers)
- [ ] StatusChecklist shows all items passing (engine ✓, tooling ✓, project path ✓, .uproject ✓, Source/ ✓)
- [ ] Project context (classes, plugins, dependencies) is scanned and available to downstream modules

## 4. Current state

ProjectSetupModule integrates project detection (SetupWizard), environment validation (StatusChecklist), project creation/build panels, and project scanning. The PoF project at C:\Users\kazda\Documents\Unreal Projects\PoF is already detected on system startup. SetupWizard filters projects by UE major.minor version. The scanning hook (useProjectScan) checks for UE engines, developer tools (VS, .NET, SDK), .uproject existence, Source/, and build files. BuildVerifyPanel generates a build prompt using detected engine path and project settings. No formal checklist items are defined for this module in the registry (unlike aRPG core modules), so readiness is measured by successful operation of the UI components and API routes.

## 5. Gaps blocking the slice

- (severity: M) (blocking: N) (category: testId-missing) — SetupWizard tabs and project list items lack testIds for Playwright navigation. Notes: `src/components/modules/project-setup/SetupWizard.tsx:144-230`.
- (severity: M) (blocking: N) (category: testId-missing) — StatusChecklist items (engine, tooling, path, project) lack testIds for assertion. Notes: `src/components/modules/project-setup/StatusChecklist.tsx:50-160`.
- (severity: M) (blocking: N) (category: testId-missing) — CreateProjectPanel and BuildVerifyPanel buttons lack testIds. Notes: `src/components/modules/project-setup/CreateProjectPanel.tsx:46-65`, `src/components/modules/project-setup/BuildVerifyPanel.tsx:21-150`.

## 6. testId touchpoints

| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| `src/components/modules/project-setup/SetupWizard.tsx` | Mode selector (Existing/Fresh tabs) | `pof-setup-wizard-tab-existing` | N | Navigate to open existing projects |
| `src/components/modules/project-setup/SetupWizard.tsx` | UE version pill (5.5/5.6/5.7) | `pof-setup-wizard-version-pill-5.5` | N | Select engine version |
| `src/components/modules/project-setup/SetupWizard.tsx` | Project list item button | `pof-setup-wizard-project-item-${projectName}` | N | Click to open detected project |
| `src/components/modules/project-setup/SetupWizard.tsx` | Project name input (Start Fresh) | `pof-setup-wizard-project-name-input` | N | Enter new project name |
| `src/components/modules/project-setup/SetupWizard.tsx` | Create & Launch button | `pof-setup-wizard-create-btn` | N | Submit new project creation |
| `src/components/modules/project-setup/StatusChecklist.tsx` | Checklist container | `pof-setup-wizard-checklist` | N | Scroll/assert visible checklist items |
| `src/components/modules/project-setup/StatusChecklist.tsx` | Engine status item | `pof-setup-wizard-checklist-item-engine` | N | Assert engine ✓ |
| `src/components/modules/project-setup/StatusChecklist.tsx` | Tooling status items | `pof-setup-wizard-checklist-item-tool-${toolId}` | N | Assert tooling status (vs, msvc, wsdk, dotnet) |
| `src/components/modules/project-setup/StatusChecklist.tsx` | Project path status | `pof-setup-wizard-checklist-item-path` | N | Assert project path ✓ |
| `src/components/modules/project-setup/StatusChecklist.tsx` | UE Project status | `pof-setup-wizard-checklist-item-uproject` | N | Assert .uproject found ✓ |
| `src/components/modules/project-setup/StatusChecklist.tsx` | Scan button | `pof-setup-wizard-scan-btn` | N | Trigger manual rescan |
| `src/components/modules/project-setup/CreateProjectPanel.tsx` | Create project button | `pof-setup-wizard-create-project-btn` | N | Trigger project scaffolding prompt |
| `src/components/modules/project-setup/BuildVerifyPanel.tsx` | Build & Verify button | `pof-setup-wizard-build-verify-btn` | N | Trigger build verification prompt |
| `src/components/modules/project-setup/ToolingBootstrapPanel.tsx` | Fix All Missing Tools button | `pof-setup-wizard-fix-tools-btn` | N | Trigger tool installation prompt |
