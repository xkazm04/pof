# Phase 4 · CLI Rail + Two-Way Binding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Make the CLI Rail functional. It lists live sessions (entity-scoped or project-scoped), shows status indicators, and the EntityHeader's (Re)generate button dispatches into it. Two-way binding works via the existing `useGeneration` → `@@CALLBACK` → `/api/catalog` → catalogStore refetch path — the inspector cell re-renders automatically when the store updates because every panel reads from the store.

**Scope discipline:** Phase 4 lands the MINIMAL architectural deliverable: rail shows sessions, dispatch from inspector works, callbacks flow back. The per-task diff review (`a89549dc`), agent flight recorder (`8db7a7ed`), persistent run history (`4974ec2c`), one-click finding-fix (`f340c77b`), and the other ~12 CLI-rail KEEP-CORE ideas land in **Phase 4b** (a follow-up plan) — those each warrant their own bite-sized TDD cycle and can't be done justice as one task.

**Architecture:** No new transport. Reuses `cliPanelStore` (sessions + lifecycle), `useGeneration` (entity-aware dispatch already exists for all 8 catalogs), and `TaskFactory.generate`. The Rail subscribes to `cliPanelStore.sessions`, filters by `moduleId` ↔ `useGeneration.CATALOG_MODULE[activeCatalogId]` when an entity is selected.

---

## Files

### Create
- `src/components/ecw/cli/SessionList.tsx` — list of sessions in the rail body, filtered by scope.
- `src/components/ecw/cli/SessionRow.tsx` — one session with status dot + label + last activity.
- `src/components/ecw/cli/useRailScope.ts` — hook returning the active scope filter (`{ kind: 'entity', catalogId, entityId } | { kind: 'project' }`).
- Tests for each.

### Modify
- `src/components/ecw/CliRail.tsx` — mount `SessionList` in the body instead of the "Phase 4" placeholder text.
- `src/components/ecw/inspector/EntityHeader.tsx` — add a real (Re)generate button wired to `useGeneration`.
- `src/__tests__/components/ecw/inspector/EntityHeader.test.tsx` — assert the button + dispatch behavior.

---

## Task 1: `useRailScope` hook

Returns `{ kind: 'entity', catalogId, entityId } | { kind: 'project' }` from `ecwStore`.

Commit: `feat(ecw-cli): useRailScope hook (ECW Phase 4.1)`

## Task 2: `SessionRow`

Status dot (green=idle, amber=running, red=failed) + label + relative-time last activity. Click selects the session in `cliPanelStore` (sets activeTabId).

Commit: `feat(ecw-cli): SessionRow with status dot + label (ECW Phase 4.2)`

## Task 3: `SessionList`

Reads `cliPanelStore.sessions`, filters by entity scope when set. "No sessions yet — dispatch from an entity inspector" empty state.

Commit: `feat(ecw-cli): SessionList in CliRail (ECW Phase 4.3)`

## Task 4: Wire SessionList into CliRail

Replace placeholder text with `<SessionList />`. Update CliRail test.

Commit: `feat(ecw-cli): mount SessionList in CliRail body (ECW Phase 4.4)`

## Task 5: Wire (Re)generate in EntityHeader

Use `useGeneration(entity)` + a "Generate" button. Disabled while running. Header gets a small button next to the LifecycleBadge.

Commit: `feat(ecw-inspector): EntityHeader (Re)generate button via useGeneration (ECW Phase 4.5)`

## Task 6: Phase 4 verification + tag

Targeted vitest, tsc, eslint. Tag `ecw-phase-4-complete`.
