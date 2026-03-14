---
phase: 3
slug: all-panels
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (latest, configured) |
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
| 03-01-01 | 01 | 0 | DENS-03 | unit | `npx vitest run src/__tests__/dzin/attributes-panel-density.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | DENS-04 | unit | `npx vitest run src/__tests__/dzin/tags-panel-density.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 0 | DENS-05 | unit | `npx vitest run src/__tests__/dzin/abilities-panel-density.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 0 | DENS-06 | unit | `npx vitest run src/__tests__/dzin/effects-panel-density.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 0 | DENS-07 | unit | `npx vitest run src/__tests__/dzin/tag-deps-panel-density.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 0 | DENS-08 | unit | `npx vitest run src/__tests__/dzin/effect-timeline-panel-density.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-01-07 | 01 | 0 | DENS-09 | unit | `npx vitest run src/__tests__/dzin/damage-calc-panel-density.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-01-08 | 01 | 0 | DENS-10 | unit | `npx vitest run src/__tests__/dzin/tag-audit-panel-density.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-01-09 | 01 | 0 | DENS-11 | unit | `npx vitest run src/__tests__/dzin/loadout-panel-density.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 0 | INTG-04 | unit | `npx vitest run src/__tests__/dzin/panel-registration.test.ts -x` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/dzin/attributes-panel-density.test.tsx` — stubs for DENS-03
- [ ] `src/__tests__/dzin/tags-panel-density.test.tsx` — stubs for DENS-04
- [ ] `src/__tests__/dzin/abilities-panel-density.test.tsx` — stubs for DENS-05
- [ ] `src/__tests__/dzin/effects-panel-density.test.tsx` — stubs for DENS-06
- [ ] `src/__tests__/dzin/tag-deps-panel-density.test.tsx` — stubs for DENS-07
- [ ] `src/__tests__/dzin/effect-timeline-panel-density.test.tsx` — stubs for DENS-08
- [ ] `src/__tests__/dzin/damage-calc-panel-density.test.tsx` — stubs for DENS-09
- [ ] `src/__tests__/dzin/tag-audit-panel-density.test.tsx` — stubs for DENS-10
- [ ] `src/__tests__/dzin/loadout-panel-density.test.tsx` — stubs for DENS-11
- [ ] Extend `src/__tests__/dzin/panel-registration.test.ts` — covers all 9 new registrations (INTG-04)

*Existing infrastructure covers framework setup; only test files need creation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Panel chrome matches PoF dark theme | INTG-04 | Visual appearance | Open each panel, verify borders/backgrounds/headers match existing theme |
| Density swap shows correct content transitions | DENS-03 to DENS-11 | Visual transitions | Toggle density for each panel, verify micro=metric, compact=intermediate, full=interactive |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
