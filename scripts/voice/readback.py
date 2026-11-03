"""Voice room read-back (PoF lane pof-voice): transcribe voice takes with a LOCAL Whisper model, offline.

stdin:  JSON [{"id": "<take id>", "file": "<absolute audio path>"}]
stdout: JSON {"model": "<model id>", "results": [{"id": ..., "text": "<transcript>" | null, "error": null | "<reason>"}]}

An ear proxy only: it hears whether the WORDS came out (a stray syllable, a dropped word, an audio tag
read aloud), never the acting, pacing or timbre. The model comes from the local Hugging Face cache
(HF_HUB_OFFLINE=1, nothing is downloaded); override with POF_READBACK_MODEL. ffmpeg decodes the audio.
"""
import json
import os
import subprocess
import sys

os.environ.setdefault("HF_HUB_OFFLINE", "1")
MODEL = os.environ.get("POF_READBACK_MODEL", "openai/whisper-base.en")


def decode(path):
    import numpy as np
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.float32).copy()


def main():
    items = json.loads(sys.stdin.read() or "[]")
    try:
        from transformers import pipeline
        asr = pipeline("automatic-speech-recognition", model=MODEL, chunk_length_s=30, device=-1)
    except Exception as e:  # no transformers, no cached model: every item says why
        print(json.dumps({"model": MODEL, "results": [{"id": i["id"], "text": None, "error": f"model unavailable: {e}"} for i in items]}))
        return
    out = []
    for i in items:
        try:
            text = asr({"raw": decode(i["file"]), "sampling_rate": 16000})["text"].strip()
            out.append({"id": i["id"], "text": text, "error": None})
        except Exception as e:
            out.append({"id": i["id"], "text": None, "error": str(e)[:200]})
    print(json.dumps({"model": MODEL, "results": out}))


if __name__ == "__main__":
    main()
