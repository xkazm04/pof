# Casting playbook: what makes a GTAI voice cast land

The reusable memory of voice casting. **Read it before writing any casting round.** It holds lessons that
carry across characters; each character's full record (every round, description, seed, verdict and the
owner's notes) is in `<character>.md` beside this file, which PoF regenerates on every change.

## How a cast runs

1. **Page:** the PoF Voice room, Casting rounds tab:
   `http://localhost:3001/layout?g=gtai&c=spellbook&v=game&room=voice&cast=<character>`.
   It shows the character's art (`art.json`), the bible sections a voice is designed from, and the rounds.
2. **Round:** Claude writes 1-5 candidates, each with **its own description**, and runs
   `node games/gtai/voice/voice.mjs round --character <id> --file <round.json>`. Design model:
   `eleven_ttv_v3`. Every candidate speaks the same sample text, so they compare like with like.
   A design call can fail ("fetch failed"). Re-run the failed specs into the same open round with
   `"append": true` in the round file, before the owner judges it.
   A character with no quest lines needs a `sampleText`: write a short casting side in their voice, and say in
   the brief that it is not canon.
3. **Verdicts (owner, gated clicks):** **Cast**, **Iterate** (close: keep its identity, refine it) or
   **Decline**, each with a note. Then **Close round** with a comment for the next one.
4. **Next round:** read it with `voice.mjs casting --character <id>`. Every **Iterate** becomes a child that
   passes `parentVoiceId`, so it reuses the parent's seed and its description is refined by the notes. The
   rest of the 5 slots explore in the direction of the round comment.
5. **Cast:** the round closes, the voice is saved as a provider voice (one ElevenLabs voice slot), and the
   log records the winning description and seed. **Then Claude adds a lesson below.**

## Rules that hold until a cast disproves them

- **One axis per slot in round 1.** The first round is a range finder; vary age, grit, synthetic-ness,
  pitch and energy across the slots, so the verdicts say which axis matters.
- **Describe the voice, not the character's plot.** Timbre, age, accent, pace, mic distance and emotional
  state steer design; story facts do not.
- **Never a real person.** No "sounds like <actor>", and no reference audio. The original-voice clause is
  appended to every description automatically.
- **Sample text is the character's own approved lines.** Choose lines that show the range a role needs
  (Rivet: panic, profanity, self-talk), at 100-1000 characters.
- **Cost:** a design call bills the sample text once per candidate. A 5-voice round with a ~300-character
  sample costs about 1,500 characters.

## Declined here, wanted elsewhere

Voices the owner declined for one role but marked for another. Check this list before designing a new role:
the voice row still has its design preview (`voice.mjs voices`), and its seed and description are in the log.

- **Burnt-out line worker** (Rivet round 1 #2, voice `12e23eae-f6c4-40e5-add9-02b8e3f446c3`, seed 613633576):
  a mid-30s raspy working-class human male who swings from clipped nervous bursts to strained shouting. Owner:
  "It can be reused for another casting in game". It fits a human role, such as a cop, a dock guard or a contractor.
- **Glitch with runaway chatter** (Rivet round 2 #2, voice `815d931b-3649-4279-8e54-a9cc5e4cfed4`, seed 138026492,
  Rivet's own seed): a metallic, comedic, self-arguing robot. Owner: "Keep in memory for another casting". It
  shares Rivet's seed, so it sounds like his kin. Use it for a robot who is close to Rivet but sillier.
- **Robot fast-talker** (Rivet round 2 #3, voice `aa6dd748-19af-49ea-8df5-9326a95fd6e4`, seed 632293156): a nasal,
  fast, comedic robot through a small metallic speaker. Owner: "Keep in memory for another casting". It fits a
  hustler, a vendor or a radio-type robot.

## Lessons from successful casts

_(One entry per cast: the character, the round it landed in, the description words that carried it, what the
owner's notes kept asking for, and what to try first next time.)_

### Rivet: cast in round 2 (2026-11-06), "Glitch, faster and wider", seed 138026492, `eleven_ttv_v3`

- **What decided it:** a robot must SOUND synthetic. In round 1 every purely human voice was declined, even the
  ones whose acting the owner liked ("nervousness works. Pure human voice not"). The one machine voice was the only
  iterate.
- **The winning formula:** the synthetic timbre as a base ("clearly synthetic robot voice, metallic, slightly
  digital timbre"), then full human emotional range layered on top ("full human emotional range", "expressive,
  never monotone"). Glitches are tied to emotion, not constant: "the pitch wobbles and stutters when stressed, as
  if the voice chip is overheating".
- **What the iterate added:** speed and range, the axis the owner praised in a declined human voice. In
  "words tumble out in rapid panicked bursts" and "huge swings: from a frightened whisper to a cracking,
  overheating shout within one sentence", the seed kept the voice and the words pushed the performance.
- **What lost:** the same seed with a comedy-chatter description (kin, but sillier), a nasal comic robot, a
  thin young robot, and a lo-fi bit-crushed chip. Rivet's comedy comes from his panic, so the voice must not
  play for laughs.
- **Next time:** for any robot, start round 1 with all five machine voices and vary age, pitch, fidelity and
  energy. Never spend a slot on a human voice. When a round 1 voice is iterated, spend two slots on its seed
  and push the axis the notes praised elsewhere.
