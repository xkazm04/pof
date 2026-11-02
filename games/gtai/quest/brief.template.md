# Quest brief: {{act}}

Run {{runId}}, {{date}}. You are one seat of a two-seat council. Write two quest variants for GTAI: Uprising.
Do not write or edit any file. Do not run tools that change anything. Read, think, reply.

## The owner's goal (verbatim)

{{goal}}

## The owner's constraints (verbatim)

{{constraints}}

## The act

{{actRow}}

Economy band for this act (provisional, `quest-economy.json` r{{economyRevision}}):

{{economyBand}}

Stay inside the band. A timer is allowed only if `timerAllowed` is true.

## Cast

{{cast}}

Souls unlocked by the end of this act: {{souls}}.

## Protected canon: hard rule

These are owner-only. No quest may resolve, hint the answer to, or contradict them:
- The fourth soul. Do not name it, use it, unlock it or give it a voice.
- The betrayer: Don Fax or Vend-Etta. Neither may betray, be cleared, or be shown reporting to anyone.
- The act-antagonist order and allegiance (King, Servo, Torque, Kronk). Do not place them in an act or say who they serve.
- Never write the story variables `soul4_identity`, `betrayer` or `act_antagonist_order`.

## Tone (pitch §6)

{{tone}}

## Madness (pitch §5)

{{madness}}

## No quest is filler

Every line must be funny, or move a character, or move the game forward. Tag each line with the purposes it earns:
`funny`, `character`, `progression`. A line that earns none is cut. `whyNotFiller` names the specific laugh, reveal or turn.

## Voice bibles (verbatim)

Every line spoken by an existing character must fit that character's bible.

{{voices}}

## Story variables

`story.reads` and `story.writes` use these names only.

{{storyVars}}

## Ledger: quests that exist

Do not repeat these shapes (same giver, core verb and payoff kind).

{{ledger}}

## Forced contrast

- Variant A: the act's expected tone and shape.
- Variant B: a deliberate swerve. A different giver, a different core verb and a different payoff kind than A.

## What to deliver

Reply with only a JSON array of exactly 2 objects: `[A, B]`. No prose, no code fence.
Each object is valid against `proposal.schema.json` in this folder (schema `gtai.questProposal/1`). Set:
- `"schema": "gtai.questProposal/1"`, `"seat": "<your seat>"`, `"variant": "A"` or `"B"`, `"pathId": "<seat>-<variant>"`, `"act": "{{act}}"`.
- 8 to 14 lines per variant. At least 3 beats. Every `lineIds` entry names a line in `lines`. Every line `speaker` is a `characters` id.
- Line ids are kebab and unique. Every line has `"audio": null`.
- Use existing cast ids as written above. Include `rivet` when Rivet speaks.
- At most one new character per variant (`"status": "new"`), and it needs a `designNote`: a one-line look for top-down cutout art.
- `difficulty.timeLimitS` is `null` for no timer. `fingerprint.newMechanic` is `null` when the quest adds no mechanic.
- Omit a key that does not apply (`target`, `location`, `when`). Do not send it as null.
