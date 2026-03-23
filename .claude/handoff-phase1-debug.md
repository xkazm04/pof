# Handoff: Phase 1 Chat + LLM Advisor — Remaining Bug

## Context
PoF prototype (`/prototype`) has a Dzin chat overlay that lets users compose workspace panels via natural language. The advisor system uses Gemini 2.0 Flash to interpret user requests and call `compose_workspace` tool to rearrange panels.

## Current State
- Chat UI works (send/receive messages)
- Two-turn Gemini strategy works (Turn 1: AUTO, Turn 2: ANY forces tool call)
- Gemini IS returning `compose_workspace` tool calls now
- Tool call handler in `useIntentDispatch.ts` receives the call and builds panel state

## The Bug
`handleComposeToolCall()` in `src/hooks/useIntentDispatch.ts` (~line 297) builds a `patches` array and calls `system.stateEngine.dispatch(patches, 'llm', 'Advisor compose_workspace')`. This fails with:

```
OPERATION_VALUE_CANNOT_CONTAIN_UNDEFINED
operation: { "op": "replace", "path": "/panels", "value": [...] }
```

The `fast-json-patch` library rejects `replace` operations where the value contains `undefined` properties. The panel objects in the array have `dataSlice: undefined` (and possibly `uiState: {}` issues).

### Root Cause
In `handleComposeToolCall`, the `newPanels` array is built from Gemini's tool call args but also spreads existing `state.panels` entries. These panel objects have optional `dataSlice` property that is `undefined`. `fast-json-patch` `dispatch` (via `applyPatch`) validates that no `undefined` values exist in operation values.

### Fix Required
In `handleComposeToolCall` (~line 258-293 of `src/hooks/useIntentDispatch.ts`), strip `undefined` values from panel objects before passing to `dispatch`. Specifically, when building `newPanels`, ensure `dataSlice` is omitted (not set to `undefined`) from panel objects. A simple approach:

```ts
// Before creating the patches, strip undefined values
const cleanPanels = newPanels.map(p => {
  const clean: Record<string, unknown> = {
    id: p.id,
    type: p.type,
    slotIndex: p.slotIndex,
    density: p.density,
    role: p.role,
    uiState: p.uiState ?? {},
  };
  if (p.dataSlice !== undefined) clean.dataSlice = p.dataSlice;
  return clean;
});
```

Then use `cleanPanels` in the patches array instead of `newPanels`.

### Key Files
- `src/hooks/useIntentDispatch.ts` — `handleComposeToolCall` function (bottom of file)
- `src/app/api/agents/advisor/route.ts` — Two-turn Gemini strategy
- `src/lib/dzin/advisor/AdvisorClient.ts` — HTTP client with processing guard
- `src/lib/dzin/core/state/engine.ts` — State engine `dispatch` uses `fast-json-patch`

### What NOT to Change
- The two-turn strategy in the route is working — don't revert
- The processing guard in AdvisorClient (replaced abort-on-new-call) — don't revert
- The `onMessage` handler fix (finalizes streaming message instead of creating duplicate) — don't revert
- ConversationShell and VoiceControls theme changes (user modified to use --dzin-* tokens) — don't revert

### After Fixing the Patch Bug
1. Verify: send "show abilities" in chat → abilities panel appears
2. Verify: send "display spellbook" → loadout panel appears
3. Then continue to Phase 2 verification (voice) and Phase 3 (Dzin extraction)

## Plan Location
Full implementation plan: `C:\Users\kazda\.claude\plans\wobbly-doodling-clarke.md`
