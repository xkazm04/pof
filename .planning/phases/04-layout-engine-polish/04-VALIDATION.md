---
phase: 4
slug: layout-engine-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + jsdom |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/__tests__/dzin/` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/dzin/ -x`
- **After every plan wave:** Run `npm run validate`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | LAYT-05 | unit | `npx vitest run src/__tests__/dzin/composition-presets.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | INTG-03 | unit | `npx vitest run src/__tests__/dzin/cross-panel-selection.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 0 | LAYT-01, LAYT-02 | unit | `npx vitest run src/__tests__/dzin/multi-panel-layout.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 0 | DENS-13 | unit | `npx vitest run src/__tests__/dzin/density-animation.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 0 | LAYT-03 | unit | `npx vitest run src/__tests__/dzin/template-picker.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 0 | LAYT-04 | unit | `npx vitest run src/__tests__/dzin/layout-animation.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 0 | LAYT-06 | unit | `npx vitest run src/__tests__/dzin/preset-switcher.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/dzin/composition-presets.test.ts` — stubs for LAYT-05
- [ ] `src/__tests__/dzin/cross-panel-selection.test.tsx` — stubs for INTG-03
- [ ] `src/__tests__/dzin/multi-panel-layout.test.tsx` — stubs for LAYT-01, LAYT-02
- [ ] `src/__tests__/dzin/density-animation.test.tsx` — stubs for DENS-13
- [ ] `src/__tests__/dzin/template-picker.test.tsx` — stubs for LAYT-03
- [ ] `src/__tests__/dzin/layout-animation.test.tsx` — stubs for LAYT-04
- [ ] `src/__tests__/dzin/preset-switcher.test.tsx` — stubs for LAYT-06

*Existing framework infrastructure covers setup; only test files need creation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Layout switch animates smoothly (no jank) | LAYT-04 | Visual animation quality | Switch templates, verify smooth panel position/size transitions |
| Density crossfade looks clean (no flash) | DENS-13 | Visual transition quality | Change density, verify fade out/in with no content flash |
| Cross-panel dimming feels like "focus mode" | INTG-03 | Visual opacity/styling | Click ability/tag, verify non-related items dim to ~0.4 opacity |
| Template thumbnails are recognizable | LAYT-03 | Visual minimap quality | Check SVG icons show grid proportions clearly at ~24px |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
