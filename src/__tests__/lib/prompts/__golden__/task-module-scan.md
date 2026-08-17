You are evaluating the "arpg-combat" module of UE5 project "PoF".

## Focus Area
Melee attacks, combo system, hit detection, damage, reactions, death

## Evaluation Pass: Structure
Analyze code organization, file layout, class hierarchy, and module boundaries. Are classes in the right files? Is the inheritance correct? Are responsibilities properly separated?

## What to Check
- Melee attack should be a GameplayAbility, not raw code
- Combo system should advance via anim notify, not timer
- Hit detection should use anim notify state windows
- Damage should flow through GAS (GE application), not direct attribute set
- Death flow should use State.Dead tag to block all abilities
Additionally: on death, the character must apply the State.Dead gameplay tag via GE_Death and rely on the tag to block subsequent ability activations. Disabling input alone is not sufficient — abilities triggered by other systems must also be blocked.

## Instructions
1. Read the source files under Source/PoF/ relevant to this module
2. Analyze against the checks listed above
3. For each issue found, note the specific file and line number
4. Rate severity based on impact: critical (crashes/data loss), high (incorrect behavior), medium (suboptimal), low (style/convention)
5. Estimate fix effort: trivial (< 5 min), small (< 30 min), medium (< 2 hours), large (> 2 hours)

Output ONLY a JSON array of findings. Each finding:
{
  "category": "string — the area of concern",
  "severity": "critical" | "high" | "medium" | "low",
  "file": "relative path from Source/ (or null if general)",
  "line": number | null,
  "description": "what the issue is",
  "suggestedFix": "specific fix description",
  "effort": "trivial" | "small" | "medium" | "large"
}

Rules:
- Output ONLY the JSON array, no markdown, no explanation
- If no findings, output: []
- Be specific about file paths and line numbers when possible
- suggestedFix should be actionable — say exactly what to change

---

You are evaluating the "arpg-combat" module of UE5 project "PoF".

## Focus Area
Melee attacks, combo system, hit detection, damage, reactions, death

## Evaluation Pass: Quality
Analyze UE5 best practices, coding conventions, correctness, and anti-patterns. Is the code following Unreal conventions? Are there bugs, incorrect usage, or missed edge cases?

## What to Check
- Hit detection should use TSet for deduplication (hit each actor once per swing)
- Weapon trace should use sweep, not line trace for accurate melee
- Combo timeout should reset combo count (not just on miss)
- Hit reaction montage should interrupt current montage properly
- Camera shake and hitstop should be proportional to damage
Additionally: verify GA_MeleeAttack stores HitActors as TSet<AActor*> on the ability instance (not on the notify), and clears the set at ability activation. Multi-hit-per-swing without dedup is a regression.
Additionally: detect parallel Health bookkeeping — a plain float Health/MaxHealth member on the character (e.g. AARPGPlayerCharacter::GetHealth) alongside the GAS Health attribute (UARPGAttributeSet). The HUD and damage pipeline use GAS; the float is a latent inconsistency. Flag it and recommend: deprecate the plain float OR sync it from GAS in PostGameplayEffectExecute. Two Health systems must not drift.
Additionally — real-time design semantics (this is a real-time ARPG; flag turn-based rules ported unchanged):
- Every AoE or ranged targeted ability must define its moving-target behavior: either a ground-marked telegraph resolved where it was aimed (it CAN whiff when the target moves — compensate with radius/power) or a homing projectile that tracks the target after launch. A cast that resolves against a target picked earlier with neither telegraph nor tracking is a turn-based rule leaking into real time.
- Timed effects (buffs, DoTs, hazards, delayed explosions) must count in real-time seconds, not turn-style counters, and hazards must present a visible telegraph with an escapable radius/window — overlapping timers should force spatial decisions under pressure, never resolve without counterplay.
- Active defenses (dodge, block, parry) must split the two skill axes: the trigger is a player-timed input (player reaction decides IF it fires), while the magnitude — mitigation %, i-frame duration, cooldown, resource cost — scales from character stats (character progression decides HOW WELL it works). Flag defenses that fire fully automatically with no input, and binary stat-less defenses that ignore progression.

## Instructions
1. Read the source files under Source/PoF/ relevant to this module
2. Analyze against the checks listed above
3. For each issue found, note the specific file and line number
4. Rate severity based on impact: critical (crashes/data loss), high (incorrect behavior), medium (suboptimal), low (style/convention)
5. Estimate fix effort: trivial (< 5 min), small (< 30 min), medium (< 2 hours), large (> 2 hours)

Output ONLY a JSON array of findings. Each finding:
{
  "category": "string — the area of concern",
  "severity": "critical" | "high" | "medium" | "low",
  "file": "relative path from Source/ (or null if general)",
  "line": number | null,
  "description": "what the issue is",
  "suggestedFix": "specific fix description",
  "effort": "trivial" | "small" | "medium" | "large"
}

Rules:
- Output ONLY the JSON array, no markdown, no explanation
- If no findings, output: []
- Be specific about file paths and line numbers when possible
- suggestedFix should be actionable — say exactly what to change

## Submission

After completing your work, submit the results by outputting a JSON block wrapped in callback markers.

**Format:**
```
@@CALLBACK:cb-TEST
{
  "findings": [
    {
      "pass": "structure|quality|performance",
      "category": "string",
      "severity": "critical|high|medium|low",
      "file": "relative/path.h or null",
      "line": null,
      "description": "what the issue is",
      "suggestedFix": "specific fix",
      "effort": "trivial|small|medium|large"
    }
  ]
}
@@END_CALLBACK
```

The following fields will be added automatically — do NOT include them:
- `moduleId`: `"arpg-combat"`

**Rules:**
- Output valid JSON between the markers — no comments, no trailing commas
- The markers MUST appear on their own lines, exactly as shown
- The system will automatically submit this to the API — do NOT use curl
- You will see a confirmation message once the submission succeeds