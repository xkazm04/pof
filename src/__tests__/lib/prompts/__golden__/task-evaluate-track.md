Evaluate the "Logic" production track for the items entity "Rusty Sword".

Track scope: Gameplay C++/Blueprint — the ability, item, loot roll, or widget code.

Assess what exists today (in the UE project + this catalog entity's data), then judge whether the "Logic" track is not-started / in-progress / done / blocked, and list the concrete next steps to bring it to a playable "done" state. Be specific about file paths, asset names, and which existing PoF systems to reuse.

## Submission

After completing your work, submit the results by outputting a JSON block wrapped in callback markers.

**Format:**
```
@@CALLBACK:cb-TEST
{
  "state": "not-started|in-progress|done|blocked",  // your assessed coverage of this track
  "note": "<one-line summary of current state / the key next step>"
}
@@END_CALLBACK
```

The following fields will be added automatically — do NOT include them:
- `catalogId`: `"items"`
- `entityId`: `"itm-rusty-sword"`
- `trackId`: `"logic"`

**Rules:**
- Output valid JSON between the markers — no comments, no trailing commas
- The markers MUST appear on their own lines, exactly as shown
- The system will automatically submit this to the API — do NOT use curl
- You will see a confirmation message once the submission succeeds