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
