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

## Lessons from successful casts

_(One entry per cast: the character, the round it landed in, the description words that carried it, what the
owner's notes kept asking for, and what to try first next time.)_
