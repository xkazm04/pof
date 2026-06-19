# UE concepts & followups

Durable, future-session-oriented notes for PoF's **Unreal Engine integration** —
the autonomy/tooling work that turns UE into something PoF can drive headlessly and
verify. Unlike `docs/superpowers/specs/` (per-change design artifacts) these are the
**maintained reference**: what exists, how to drive it, the hard-won recipes, and the
open followups a future session should pick up.

## Contents

| Doc | Covers |
|-----|--------|
| [l4-autonomous-visual-capture.md](l4-autonomous-visual-capture.md) | The L4 visual-verification gate: how PoF autonomously launches headless UE 5.8, renders a frame, and feeds it to the Gemini check — the architecture, the proven headless-launch recipe + gotchas, what works, and the open content gap. |
| [followups.md](followups.md) | The running backlog of UE-side followups for future sessions (L4 content gap, Phase 2 long-tail tools, RefreshTools measurement, lit-map alignment, …). |

## Related (elsewhere in docs/)

- [`../../ue58-mcp-convergence-plan.md`](../../ue58-mcp-convergence-plan.md) — the UE 5.8 first-party MCP convergence plan (Phases 0–3).
- [`../../ue58-mcp-phase2-tool-map.md`](../../ue58-mcp-phase2-tool-map.md) — per-tool DROP/PORT verdict vs Epic's toolsets.
- [`../../ue5-companion-plugin-design.md`](../../ue5-companion-plugin-design.md) — the `:30040` PoF Bridge plugin (verification surface).
- `src/lib/ue-launch/` — the reusable autonomous UE launcher (engine-version aware).
- Memory: `project_ue58_official_mcp`, `project_ue58_upgrade`, `project_llm_ue_interface`.
