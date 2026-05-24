# Phase 6 · Live State — Implementation Plan (focused scope)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Replace `LiveStateTabPlaceholder` with a functional Live State surface showing what's actually in UE right now. **Focused scope** for Phase 6: bridge connection status + asset manifest summary + per-catalog asset-count comparison. The richer surfaces (live UObject inspector, crash watchtower, 3D zone twin, time-travel replay, PIE bridge) each warrant their own substantial plan and land in **Phase 6b** / **Phase 10** enhancements — they're all still reachable via the legacy shell at `/`.

**Architecture:** Read-only against `usePofBridgeStore` (connection + manifest) and `useCatalogStore` (defined-here counts). No new transport. Computes a per-catalog diff: "defined here X · in UE Y" using the existing manifest's assetCount as a coarse proxy (richer per-catalog matching lands in Phase 6b once we wire `manifest.assets[].path` matching against `entity.ueAssets[]`).

**Tech Stack:** React 19, Zustand v5 (existing stores), lucide-react.

---

## Files

### Create
- `src/components/ecw/live/LiveStateTab.tsx` — top-level body for the Live State L1 tab.
- `src/components/ecw/live/BridgeStatusCard.tsx` — connection status + plugin info.
- `src/components/ecw/live/AssetManifestCard.tsx` — total assets + per-catalog defined/in-UE table.
- `src/components/ecw/live/LiveStatePlaceholderCards.tsx` — placeholders for Live UObject Inspector, Crash Watchtower, 3D Zone Twin, time-travel replay (each as Phase 6b/P10 anchors).
- Tests for each.

### Modify
- `src/components/ecw/NewAppShell.tsx` — swap `LiveStateTabPlaceholder` for `LiveStateTab`.

### Delete
- `src/components/ecw/tabs/LiveStateTabPlaceholder.tsx`.

---

## Task 1: `BridgeStatusCard`

Reads `usePofBridgeStore`. Shows connection dot (green/amber/red), plugin name + version, asset count, last sync timestamp.

Commit: `feat(ecw-live): BridgeStatusCard with connection + plugin info (ECW Phase 6.1)`

## Task 2: `AssetManifestCard`

Per-catalog table: `defined here X · in UE ?` (the in-UE count is "?" until Phase 6b adds path matching). Sums defined across all 8 catalogs.

Commit: `feat(ecw-live): AssetManifestCard with per-catalog asset summary (ECW Phase 6.2)`

## Task 3: `LiveStatePlaceholderCards`

A grid of 4 placeholder cards labeling the Phase 6b/P10 enhancement targets.

Commit: `feat(ecw-live): LiveStatePlaceholderCards for Phase 6b anchors (ECW Phase 6.3)`

## Task 4: `LiveStateTab` composition

Header + BridgeStatusCard + AssetManifestCard (2-col on lg) + LiveStatePlaceholderCards below.

Commit: `feat(ecw-live): LiveStateTab composition (ECW Phase 6.4)`

## Task 5: Wire into NewAppShell + delete placeholder

Commit: `feat(ecw-live): wire LiveStateTab into NewAppShell (ECW Phase 6.5)`

## Task 6: Phase 6 verification + tag `ecw-phase-6-complete`
