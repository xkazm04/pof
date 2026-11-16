# Local TTS provider — spec + backlog delta

> Source: `/research` run 2026-09-07 on *Dynamic NPC Dialogue in Unity (Local LLM + TTS)*
> (Building Aeon, 9:40) — a Unity package pairing a local GGUF LLM server with a local
> TTS server for runtime NPC dialogue and speech.
> Status: **NOT built — blocked on an unavailable dependency.** Descoped-reopenable.

## The gap, precisely

`AudioKind` is `'sfx' | 'ambient' | 'music' | 'tts'` (`src/lib/audio-gen/types.ts:6`).
**`tts` appears nowhere else in `src/` outside that declaration.** `AUDIO_PROVIDERS`
(`src/lib/audio-gen/registry.ts`) holds exactly one provider, ElevenLabs, whose
`capabilities` are `['sfx', 'ambient']` and which refuses `tts` in writing:

> "Text-to-speech needs /v1/text-to-speech/{voice_id} and a chosen voice; PoF integrates
> neither, so speech cannot be produced here." — `providers/elevenlabs.ts`

So PoF declares a speech modality that **no provider serves**. This is the root cause of
two separately-recorded `/status` defects, both already in `step-facts.json`:

| Step | Recorded fact |
|---|---|
| `dialog-trees` → VO Script | declares 5 `/Game/Audio/VO/Dialog/SC_*` SoundCue assets; "no generator (ElevenLabs or otherwise) actually creates" them |
| `cutscenes` → VO | `trueEngine: None`; "no VO/lipsync pipeline exists" |

**PoF's honesty machinery is already correct here and needs no work** — the capability gate
(`supportsKind`) refuses before any billed call, `unsupportedReason` carries the provider's own
words, and `SoundForgePanel` renders unserved kinds *disabled with their reason*. The audit
knows, the UI says so, and the packaging truth-engine already reports the VO declarations as
unrealized. What is missing is the **engine**, not the disclosure.

## Why it was not built in this run

No local TTS server is reachable on this machine (probed :8880 Kokoro-FastAPI, :5002 Coqui,
:59125 / :10200 Piper, :8020 — all refused). Ollama **is** live on :11434 with five models,
so the LLM half of the video's stack exists locally; the speech half does not.

Per the standing preference rule (GUI-only / unrunnable dependencies → spec, not a build) and
the consumer-census rule (a provider adapter with no reachable server is a module nothing can
call), this ships as a recipe rather than a green-tested no-op.

## Integration shape (when unblocked)

Adding a provider is deliberately cheap — `types.ts` says so: *"Adding a new provider = a new
file under providers/ + a registry entry."*

```ts
// src/lib/audio-gen/providers/localTts.ts
export const LocalTtsProvider: AudioProvider = {
  id: 'local-tts',
  label: 'Local TTS',
  capabilities: ['tts'],
  commercialLicense: { tts: /* see the two-axis rule below */ },
  unsupported: {
    sfx: 'Local TTS synthesises speech from text; it has no sound-effect model.',
    ambient: 'Local TTS synthesises speech from text; it has no ambience model.',
    music: 'Local TTS synthesises speech from text; it has no music model.',
  },
  async generate(req) { /* POST {base}/v1/audio/speech */ },
};
```

- **Endpoint:** target the OpenAI-compatible `POST /v1/audio/speech`
  (`{model, input, voice, response_format}` → audio bytes). Kokoro-FastAPI, LM Studio and
  several Piper wrappers all expose it, so one adapter covers the field. Base URL from
  `POF_LOCAL_TTS_URL`, defaulting to `http://127.0.0.1:8880`.
- **Route change needed:** `src/app/api/audio-gen/route.ts` maps generation failures to 503
  only via `msg.includes('ELEVENLABS_API_KEY')` — a provider-specific string. A local
  provider's "server not running" is the same class of condition (dependency absent, nothing
  billed) and should also be a 503. Generalise that branch when the second provider lands.
- **`durationSeconds`** is meaningless for TTS (length follows the text). Return the measured
  duration, or 0 — never echo the request.

## The two-axis licence rule (the finding that outlived the tool)

The video states the TTS models are "all Apache licensed, so distribution is totally fine if
you want to use them in your own game" — and then bakes its custom voice from **an ElevenLabs-
generated sample** ([06:30]). Both halves can be true and the shipped audio still not be
redistributable.

**A generated voice carries two licences, and PoF's `commercialLicense` field records only one:**

1. **The model weights.** Genuinely licence-mixed, and cloning capability correlates with the
   worse terms: Kokoro is Apache but *cannot clone*; F5-TTS is CC-BY-NC; Coqui XTTS-v2 is CPML
   (non-commercial). Permissive *and* cloning-capable exists (Chatterbox MIT, Fish Speech and
   Qwen3-TTS Apache-2.0) but must be checked per model, not assumed from "it's open source".
2. **The reference sample.** A cloned voice inherits the terms of whatever produced the clip it
   was conditioned on. Cloning an Apache model from a commercial-TTS-generated sample, a
   YouTube clip, or an actor's recording binds that source's terms to every line produced.

This axis is now enforced as knowledge rather than as a field: it ships in the new `audio`
`MODULE_CONTEXTS` entry (`module-eval-prompts.ts`), so every audio evaluation prompt asks for
both. Adding a `voiceProvenance` field to `AudioProvider` should wait until a provider exists
to populate it — an unpopulated field is decoration.

## Reconsider trigger

A local TTS server reachable from this machine (Kokoro-FastAPI on :8880 is the cheapest path —
Apache-2.0 weights, CPU-viable, no cloning), **or** the user asking for VO. At that point the
adapter is roughly an afternoon, and the proof is an artifact diff, not a passing test:
generate one line, play/measure the bytes, and flip the two `step-facts.json` VO notes.

## Related

- `docs/research/systemic-dialog-solutions-note.md` — the standing XL note on systemic dialog
  (Cain batch, 2026-08-12). This video is a working demo of that note's premise: an NPC with a
  bounded knowledge set (persona + world facts) generating lines at runtime. The *runtime* LLM
  question belongs there, not here; this spec covers only the speech engine.
- Runtime pipelining, if a runtime path is ever built: the video begins TTS on the **first
  completed sentence** rather than the full response, so perceived latency is the larger of the
  two models rather than their sum (3-6 s end-to-end on an RTX 5070). Captured as a check in
  the `audio` eval context.
- `src/lib/model-policy.ts` is Claude-CLI-scoped by construction (`ClaudeModel` → `--model`);
  a local-LLM tier does **not** belong there. Ollama is live on :11434 if a local authoring
  path is ever wanted, but that is a separate seam.

## 2026-11-06 update: a local path for voice casting, read from an open voice studio

> Source: registry intake `intake-voicebox-mg-1106` of github.com/jamiepine/voicebox at `8af7efe`
> (release 0.6.0 plus one month). Registry technique:
> `media-generation/audio-generation/character-voice-design/freeze-the-design-into-a-reference`.
> Status: **knowledge and a plan, nothing built.** The reconsider trigger above still holds:
> no local speech weights are on the registry machine, and the installed `qwen_tts` package does
> not import there (torchaudio native library).

Since this spec was written, PoF grew a full casting and takes pipeline on ElevenLabs (rounds on
`eleven_ttv_v3`, takes on `eleven_v3`, see `games/gtai/voice/casting/CASTING.md`). The question is
no longer "is there a TTS engine" but "what replaces each ElevenLabs step without breaking the cast".

### The three provider calls are already seams

| PoF dependency | ElevenLabs call today | Local replacement |
|---|---|---|
| `RoundDeps.design` (`src/lib/voice/castingRound.ts:47-48`) | `designVoice` - description in, previews out | an open **design** model: description (+ optional instruct) in, audio out. No preview id. |
| `TakeDeps.createVoice` (`src/lib/voice/takes.ts:22`) | `createDesignedVoice` - **the save step**: preview becomes a stored voice slot | **the freeze**: render one neutral reference clip from the cast design, store it, return a local voice handle that points at it |
| `TakeDeps.synth` (`src/lib/voice/takes.ts:22`) | `synthesizeSpeech` on the stored voice, direction as inline v3 tags | a **clone** engine conditioned on the frozen reference |

The voice module imports `elevenlabs-speech` directly rather than through `AUDIO_PROVIDERS`, so a
local path is a second set of these three functions, not a registry entry.

### Why the freeze is not optional on open models

Open design models have **no save step**: the description is the voice and is re-read on every
render. A fixed seed repeats one line; it does not keep the person across lines. The open studio
read here ships exactly that (a "designed" profile is its description, re-designed per line, with
per-line instruct appended into the identity prompt), so every directed line is drawn from a
slightly different voice. The model family it wraps documents the fix itself ("Voice Design then
Clone": design a short reference clip, build a clone prompt from it, generate every line from that
prompt, "especially useful when you want a consistent character voice across many lines").

### The engine matrix that decides it (as read in that tree, dated)

| Role | Engine (weights licence, and where that statement comes from) | Direction it accepts |
|---|---|---|
| design | Qwen3-TTS 1.7B VoiceDesign (Apache-2.0 per the studio's changelog), 10 languages | free-text instruct (shares the prompt with identity) |
| clone | Qwen3-TTS Base 0.6B / 1.7B (repository Apache-2.0; the README states no weights licence - check the model card) | **none** - drops instruct silently |
| clone | Chatterbox multilingual (MIT per this spec's 2026-09-07 survey; the studio states none), 23 languages | fixed per-language exaggeration default only |
| clone | Chatterbox Turbo (same family; licence not stated in the studio), English only | inline non-verbal tags: `[laugh]`, `[cough]`, `[chuckle]` |
| clone + design + direction | OmniVoice | free-text instruct - **CC-BY-NC weights, unusable for a commercial game** |
| preset | Kokoro 82M (Apache-2.0 per the studio's preset docs) | none; cannot clone |

So a licence-clean local cast trades away ElevenLabs v3's inline direction. What carries delivery
then: the line text and punctuation (already PoF's practice, see the line-craft rules), tags on the
English-only clone engine, and, for a character whose range must span a whisper and a shout,
**one frozen reference per register**, rendered from the same design and seed with different delivery
instructions and checked against each other for speaker similarity before they ship together.

### Porting the existing cast

The seven cast voices (Rivet, Dent, Kerf, Ohm, Tonnage, King, General Krump) port unevenly:

- **The winning descriptions port.** They are the most valuable output of the rounds; re-run them as
  a casting round on the local designer.
- **The seeds do not.** `eleven_ttv_v3` seeds mean nothing to another model.
- **The previews port only under ElevenLabs' terms.** Cloning a cast preview locally gives the closest
  match and binds the provider's terms to every line (the two-axis rule above). Re-designing locally
  gives a cast whose terms are the open weights' alone, at the cost of one round per character.
- **The robot treatment.** CASTING.md's lesson is that a robot must sound synthetic and that the
  synthetic layer was written into the description. On a freeze path, render the reference clean and
  apply the machine layer as a finishing chain after the clone read; a reference clip with the
  treatment baked in is cloned with its artefacts into every line.

### A local server that matches the integration shape above

The studio read here exposes an OpenAI-compatible `POST /v1/audio/speech` (`voice` = a studio profile,
`instructions` = the engine's instruct, `speed` = pitch-preserving time stretch), which is the exact
shape this spec's adapter targets. It would serve `synth` for preset and cloned profiles. It does not
implement the freeze: its designed profiles re-design per line, so the `createVoice` step stays PoF's
job (render the reference, then create a cloned profile from it).

### What would prove it

Queued as a held render proof in the registry (`vbmg-001`): Rivet's winning description with the
treatment removed, five quest lines; arm A re-designs per line, arm B freezes and clones; measure
speaker similarity of each line to the reference within one embedding model, a second seed per arm as
the floor, and an owner blind board on "same person?" and on range. PoF's existing Whisper read-back
and pause screen apply unchanged to both arms.
