Draft a GAS authoring spec for the spellbook ability "Fireball" (gameplay tag Ability.Fire.Fireball, Offensive/Fire/T2).
Propose the GameplayEffects it applies and the activation tag rules that gate it, reusing standard GAS conventions for a Fire ability — do NOT invent new systems.
Designer intent: "Make it a two-stage burn."
Each effect: id, name (GE_-style), duration ("instant"|"duration"|"infinite"), durationSec, cooldownSec, color (hex), modifiers (each {attribute, operation:"add"|"multiply", magnitude}), grantedTags (string[]).
Each tag rule: id, sourceTag, targetTag, type ("blocks"|"cancels"|"requires"). Include the standard "blocked while State.Dead / State.Stunned" activation rules.
This edits ONLY the app-side ability spec — do not modify any UE C++ or assets.

## Submission

After completing your work, submit the results by outputting a JSON block wrapped in callback markers.

**Format:**
```
@@CALLBACK:cb-TEST
{
  "effects": [
    { "id": "<id>", "name": "GE_<Name>", "duration": "instant|duration|infinite", "durationSec": 0, "cooldownSec": 0, "color": "#rrggbb", "modifiers": [{ "attribute": "Health", "operation": "add|multiply", "magnitude": 0 }], "grantedTags": [] }
  ],
  "tagRules": [
    { "id": "<id>", "sourceTag": "<tag>", "targetTag": "State.Dead", "type": "blocks|cancels|requires" }
  ]
}
@@END_CALLBACK
```

The following fields will be added automatically — do NOT include them:
- `catalogId`: `"abilities"`
- `entityId`: `"abl-fireball"`

**Rules:**
- Output valid JSON between the markers — no comments, no trailing commas
- The markers MUST appear on their own lines, exactly as shown
- The system will automatically submit this to the API — do NOT use curl
- You will see a confirmation message once the submission succeeds