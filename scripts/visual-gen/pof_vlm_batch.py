"""PoF VLM batch critique — loads an open VLM ONCE and scores many 2D game-art renders
from a manifest, so a fan-out gate over N images pays the model load a single time.
Emits one POF_VLM_ITEM= json line per entry + POF_VLM_BATCH_DONE. Sibling of
pof_vlm_critique.py (single-image, 3D-framed); this one is 2D-art framed and batched.

  python pof_vlm_batch.py --manifest gate.json --model Qwen/Qwen3-VL-4B-Instruct
    manifest = [{"id": "...", "file": "abs.jpg", "subject": "what it should be + criteria"}]
"""
import argparse
import json
import os
import sys


# `python -I` drops the script directory from sys.path; put it back for the shared parser.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pof_vlm_reply import parse_fields, parse_score  # noqa: E402


def manifest_problem(items):
    if not isinstance(items, list) or not items:
        return "manifest must be a non-empty list"
    for i, it in enumerate(items):
        if not isinstance(it, dict) or any(k not in it for k in ("id", "file", "subject")):
            return f"manifest entry {i} needs id, file and subject"
    return None


def judge(it, model, proc, torch, Image, max_new_tokens):
    img = Image.open(it["file"]).convert("RGB")
    prompt = (
        f"This image is an AI-generated 2D game asset that should be: {it['subject']}. "
        "Judge it strictly as a shippable GAME ASSET (icon/art). Reply on ONE line EXACTLY as: "
        "SCORE=<0-10 integer>; DEFECTS=<comma-separated visual problems>; VERDICT=<one short sentence>."
    )
    messages = [{"role": "user", "content": [
        {"type": "image", "image": img},
        {"type": "text", "text": prompt},
    ]}]
    inputs = proc.apply_chat_template(
        messages, add_generation_prompt=True, tokenize=True, return_dict=True, return_tensors="pt",
    ).to(model.device)
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False)
    gen = proc.batch_decode(out[:, inputs["input_ids"].shape[1]:], skip_special_tokens=True)[0].strip()
    gen = gen.replace("\n", " ").strip()
    rec = {"id": it["id"], "raw": gen[:400]}
    for key, value in parse_fields(gen).items():
        rec[key.lower()] = value
    score = parse_score(rec.get("score"))
    rec["score"] = int(score) if score is not None else None
    if score is None:
        rec["error"] = "no 0-10 score in the reply"
    return rec


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--max-new-tokens", type=int, default=200)
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # a piped Windows stdout is cp1252
    try:
        import time
        import torch
        from PIL import Image
        from transformers import AutoModelForImageTextToText, AutoProcessor

        with open(args.manifest, "r", encoding="utf-8") as fh:
            items = json.load(fh)
        problem = manifest_problem(items)
        if problem:  # before the model load: an empty run must not finish "ok"
            print("POF_VLM_BATCH_ERROR=" + problem)
            return 1

        t0 = time.time()
        model = AutoModelForImageTextToText.from_pretrained(args.model, dtype="auto", device_map="cuda")
        proc = AutoProcessor.from_pretrained(args.model)
        print(f"POF_VLM_LOAD_S={time.time() - t0:.1f}")

        for it in items:
            try:
                rec = judge(it, model, proc, torch, Image, args.max_new_tokens)
            except Exception as e:  # noqa: BLE001 - one item's failure costs that item only
                rec = {"id": it["id"], "score": None, "error": repr(e)}
            print("POF_VLM_ITEM=" + json.dumps(rec))
            sys.stdout.flush()

        print("POF_VLM_BATCH_DONE=ok")
        return 0
    except Exception as e:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        print("POF_VLM_BATCH_ERROR=" + repr(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
