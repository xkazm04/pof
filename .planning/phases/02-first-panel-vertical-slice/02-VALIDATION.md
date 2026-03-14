---
phase: 02
slug: first-panel-vertical-slice
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom environment) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/__tests__/dzin/` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/dzin/ -x`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | DENS-01 | unit | `npx vitest run src/__tests__/dzin/panel-registration.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | DENS-02 | unit | `npx vitest run src/__tests__/dzin/core-panel-density.test.tsx -x` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | DENS-12 | unit | `npx vitest run src/lib/dzin/core/layout/__tests__/density.test.ts -x` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 2 | INTG-01 | smoke | Manual -- Next.js page route test | Manual-only | ⬜ pending |
| 02-02-02 | 02 | 2 | INTG-02 | unit | `npx vitest run src/__tests__/dzin/core-panel-data.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/dzin/panel-registration.test.ts` — stubs for DENS-01 (registry has CorePanel, all PanelDefinition fields populated)
- [ ] `src/__tests__/dzin/core-panel-density.test.tsx` — stubs for DENS-02 (render CorePanel at each density, verify correct content per level)
- [ ] `src/__tests__/dzin/core-panel-data.test.tsx` — stubs for INTG-02 (panel renders with real featureMap data from props)

*Existing infrastructure covers DENS-12 — vendored Dzin density tests already exist.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/prototype` page renders with Core panel in DzinLayout | INTG-01 | Next.js App Router page routing requires runtime server | Navigate to `/prototype`, verify page loads with panel visible |
| Resize mode triggers auto-density reassignment | DENS-12 | ResizeObserver + slot dimension calculation requires browser | Use resize preset buttons, verify density label changes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
