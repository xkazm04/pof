# 02 · Character

## Scope

Characters: the player pawn, enemy pawns, their skeletal meshes + skeleton,
animations, and enemy AI / behaviour. Closing the long-standing "no skeleton
/ empty anim shells" gap in the UE project and making PoF able to drive
character creation, not just *systems*.

## Current state

After the Characters sub-project (2026-05-22):

- Both player and enemy use the **UE Mannequin** from UE 5.7's experimental
  `MoverTests` plugin (`SKM_Manny` player, `SKM_Manny_Simple` enemy with a
  red `M_EnemyRed` material).
- They animate (idle / walk / run) via the ready-made `ABP_Manny`.
- Enemy is **passive** — `AARPGEnemyCharacter` has AI scaffolding (BT host,
  squad manager, EQS contexts, BT tasks/services) but **no Behaviour Tree
  asset** is assigned, so the enemy stands still.
- The melee **attack plays no real swing animation** — `AM_MeleeCombo` is an
  empty montage shell with no skeleton-bound sequences. The ability fires
  and applies damage via `GA_MeleeAttack`'s fallback timer window, not via
  a montage notify.
- `UARPGAnimInstance` (the project's rich data-provider) is not used. The
  full state machine (Locomotion / Attacking / Dodging / HitReact / Death)
  + upper-body blends + all the project's AnimNotify classes are present in
  code but not driving anything — the ready-made `ABP_Manny` was chosen
  instead, to sidestep the AnimBP-authoring wall.

## Key lessons

1. **`SKM_Mannequin` in `MoverTests` is the no-download fast path.**
   Enabling the engine plugin gets a rigged + animated character with no
   downloads, no Blender, no AnimBP authoring.
2. **AnimBP graphs cannot be authored from Python** — same wall as UMG
   Widget Blueprints. A *custom* AnimBP using `UARPGAnimInstance` either
   needs the editor or a pure-C++ `UAnimInstance` subclass that does the
   pose-driving directly (very rare).
3. **Mixamo is the fast path to real attack animations** — but it has no
   API. The existing `Content/Python/mixamo_*.py` pipeline is complete; it
   needs FBX files dropped on disk + a target skeleton (now provided by the
   mannequin).
4. **Real `AnimInstance` changes the GAS code paths.** PS-1's
   `GA_MeleeAttack` worked with a no-mesh capsule via the fallback window;
   the mannequin's live AnimInstance flipped a different branch and
   surfaced a `OnInterrupted` sync-callback race. Any character change
   needs the gameplay-ability path re-verified.
5. **`AARPGEnemyCharacter` death + loot needs `OnEnemyDeath`** — the loot
   component binds that specific delegate. `AARPGCombatTestDummy` looks
   like a target but doesn't fire it.

## Isolated-CLI session focus

A session assigned this concern works on:
- **UE project (`pof-exp` repo):**
  `Source/PoF/Player/`, `Source/PoF/Character/`, `Source/PoF/AI/`,
  `Source/PoF/Animation/`, `Content/Characters/`, `Content/AI/`,
  `Content/Python/mixamo_*.py`, `Content/Python/setup_characters_ue.py`.
- **PoF app (this repo):**
  `src/components/modules/core-engine/arpg-character/`,
  `src/components/modules/core-engine/arpg-animation/`,
  `src/components/modules/game-systems/ai-behavior/`,
  `src/lib/module-registry.ts` (the character/animation/AI entries).

It does *not* touch HUD/UI, combat abilities, environment, or packaging
— those have their own folders.
