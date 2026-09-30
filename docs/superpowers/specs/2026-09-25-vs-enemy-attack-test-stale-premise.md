# Test defect: VSEnemyAttackTest asserts a hit that now lands ~4 s later (handoff from /diablo W12)

**Status:** open · **Owner:** PoF combat track (handed off by the /diablo loop, operator decision D34, 2026-09-25) ·
**Not caused by /diablo W12** — proven by a baseline rebuild, below.

## Symptom

```
UnrealEditor-Cmd PoF.uproject -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VSEnemyAttack;Quit" -unattended -nopause -nullrhi
→ Result={Fail}  "player should have taken damage from the enemy: start=100.0 now=100.0"  (Source/PoF/Test/VSEnemyAttackTest.cpp:83)
```

## Proof it predates W12

W12 changed only AARPGAIController, the BT nodes, and GA_Enemy{Ranged,Melee}Attack logging/spawn. The W12 sources were set
aside (backed up, reverted to HEAD, untracked files moved out), the editor was rebuilt, and the test rerun: **the same failure
with the same message**. BP_VSEnemy is wired to `ARPGSimpleAIController` (Content/Python/setup_enemy_ai.py), which W12 did not
touch.

## Cause (measured, `-LogCmds="LogTemp Verbose"`)

```
[GA_EnemyMelee] swing: canPlayMontage=1 montage=AM_SwordSlashC len=5.83
[SimpleAI] attack attempt tag=Ability.Enemy.Melee activated=1
```

- The enemy attacks at once, as the test expects. But BP_VSEnemy's swing montage is now `AM_SwordSlashC`, **5.83 s** long.
- It carries no `Event.MeleeHit` notify, so `UGA_EnemyMeleeAttack::OnMontageCompleted` lands the front-arc damage when the
  montage **completes or blends out**. That is about 5.8 s after activation at play rate 1.
- The test was written for the gray-box path (`FallbackAttackWindow`, "immediate first attack + 0.3 s fallback window"). It
  asserts at `PhaseTime >= 1.5 s` and finishes, so it reads health before the hit can land.

## Options for the owner

1. Put the hit where the swing connects: add a MeleeHit notify to AM_SwordSlashC (or to whichever montage BP_VSEnemy should
   use), so the damage lands mid-swing rather than at the end.
2. Make the test wait for the montage's own hit time (read from the montage) instead of a fixed 1.5 s. Do not simply raise
   the literal: that hides the next montage swap the same way.
3. If the 5.83 s montage was not meant for BP_VSEnemy at all, restore the intended swing.
